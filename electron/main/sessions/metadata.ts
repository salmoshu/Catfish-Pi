import { createReadStream, type Stats } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { Readable } from 'node:stream'
import type { SessionRecord, SessionStatus } from '../../../src/types/api'
import { SESSION_FILE_RECORD_LIMIT_BYTES } from '../jsonl-limits'
import { isRecord } from '../validation'
import { textFromContent, validTimestamp } from './transcript'

export type JsonRecord = Record<string, unknown>

/** Per-file metadata snapshot; the owning SessionService stamps the harness when it builds SessionRecords. */
export interface SessionMetadata extends Omit<SessionRecord, 'harness'> { sessionName?: string }

const MAX_SESSION_FILE_BYTES = 256 * 1024 * 1024
export const MAX_METADATA_RECORDS = 200_000
// The transcript reader of the same file MUST share this per-record tolerance.
const MAX_METADATA_RECORD_BYTES = SESSION_FILE_RECORD_LIMIT_BYTES
const MAX_TRACKED_METADATA_STATES = 5_000
export const METADATA_VERIFY_TAIL_BYTES = 4_096
const LINE_FEED = 0x0a
const CARRIAGE_RETURN = 0x0d

export function statusFrom(
  taskState: string | undefined,
  lifecycle: string | undefined,
  lastRole: string | undefined,
  stopReason: string | undefined,
): SessionStatus {
  if (lifecycle === 'crash') return 'failed'
  if (lifecycle === 'archived') return 'complete'
  if (taskState === 'completed') return 'complete'
  if (taskState === 'needs_input') return 'waiting'
  if (stopReason === 'error') return 'failed'
  if (lastRole === 'assistant' || lastRole === 'toolResult') return 'complete'
  if (lastRole === 'user') return 'idle'
  return 'unknown'
}

/** The subset of accumulator state that `message` records update, shared by every session dialect. */
export interface MessageActivityAccumulator {
  createdAt: string
  lastUserMessageAt?: string
  firstUser: string
  preview: string
  lastRole?: string
  stopReason?: string
}

export function ingestMessageActivity(state: MessageActivityAccumulator, record: JsonRecord): void {
  if (!isRecord(record.message)) return
  const message = record.message
  if (typeof message.role === 'string') state.lastRole = message.role
  if (typeof message.stopReason === 'string') state.stopReason = message.stopReason
  const text = textFromContent(message.content, 4_096)
  if (message.role === 'user') {
    if (!state.firstUser && text) state.firstUser = text
    state.lastUserMessageAt = validTimestamp(message.timestamp, validTimestamp(record.timestamp, state.lastUserMessageAt ?? state.createdAt))
  }
  if ((message.role === 'assistant' || message.role === 'user') && text) state.preview = text
}

interface IncrementalMetadataState<Accumulator> {
  size: number
  mtimeMs: number
  /** Raw bytes of the current unterminated final line, resumed on the next append. */
  pending: Buffer
  /** Last raw bytes of the parsed range, re-read and compared before resuming. */
  tail: Buffer
  accumulator: Accumulator
}

export interface SessionMetadataReaderIo {
  inspect(path: string): Promise<Stats>
  /** Opens a byte-range read of `[start, end]` (inclusive), mirroring createReadStream. */
  openStream(path: string, start: number, end: number): Readable
}

export const nodeMetadataReaderIo: SessionMetadataReaderIo = {
  inspect: stat,
  openStream: (path, start, end) => createReadStream(path, { start, end }),
}

/**
 * Harness-specific JSONL metadata parsing over the shared incremental
 * machinery: the accumulator must be a flat object so a shallow spread yields
 * an independent copy for speculative and resumed parses.
 */
export interface MetadataLineParser<Accumulator> {
  createAccumulator(filePath: string, fileStat: Stats): Accumulator
  ingestLine(accumulator: Accumulator, line: string): void
  snapshot(accumulator: Accumulator, filePath: string, fallbackUpdated: string): SessionMetadata
}

function trimTrailingCarriageReturn(line: string): string {
  return line.endsWith('\r') ? line.slice(0, -1) : line
}

function lastBytes(data: Buffer, max: number): Buffer {
  return data.length <= max ? data : Buffer.from(data.subarray(data.length - max))
}

function ingestBytes<Accumulator extends object>(parser: MetadataLineParser<Accumulator>, state: IncrementalMetadataState<Accumulator>, bytes: Buffer): void {
  state.tail = state.tail.length + bytes.length <= METADATA_VERIFY_TAIL_BYTES
    ? Buffer.concat([state.tail, bytes])
    : lastBytes(bytes.length >= METADATA_VERIFY_TAIL_BYTES ? bytes : Buffer.concat([state.tail, bytes]), METADATA_VERIFY_TAIL_BYTES)
  const data = state.pending.length ? Buffer.concat([state.pending, bytes]) : bytes
  let start = 0
  while (true) {
    const newline = data.indexOf(LINE_FEED, start)
    if (newline < 0) break
    if (newline - start > MAX_METADATA_RECORD_BYTES) throw new Error('JSONL record exceeded the maximum frame size')
    const end = newline > start && data[newline - 1] === CARRIAGE_RETURN ? newline - 1 : newline
    parser.ingestLine(state.accumulator, data.toString('utf8', start, end))
    start = newline + 1
  }
  const rest = data.subarray(start)
  if (rest.length > MAX_METADATA_RECORD_BYTES) throw new Error('JSONL record exceeded the maximum frame size')
  state.pending = Buffer.from(rest)
}

function snapshotState<Accumulator extends object>(parser: MetadataLineParser<Accumulator>, state: IncrementalMetadataState<Accumulator>, filePath: string, fallbackUpdated: string): SessionMetadata {
  if (!state.pending.length) return parser.snapshot(state.accumulator, filePath, fallbackUpdated)
  // A full stream read parses the final unterminated line; fold it into a
  // speculative copy so incremental snapshots stay identical without
  // committing a partial record to the retained parse state.
  const speculative = { ...state.accumulator }
  parser.ingestLine(speculative, trimTrailingCarriageReturn(state.pending.toString('utf8')))
  return parser.snapshot(speculative, filePath, fallbackUpdated)
}

async function ingestRange<Accumulator extends object>(io: SessionMetadataReaderIo, parser: MetadataLineParser<Accumulator>, state: IncrementalMetadataState<Accumulator>, filePath: string, start: number, end: number): Promise<void> {
  if (end <= start) {
    state.size = end
    return
  }
  const stream = io.openStream(filePath, start, end - 1)
  try {
    for await (const chunk of stream) {
      ingestBytes(parser, state, typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk as Buffer)
    }
  } finally {
    stream.destroy()
  }
  state.size = end
}

export type SessionMetadataReader = (filePath: string, knownStat?: Stats) => Promise<SessionMetadata>

/**
 * Creates a metadata reader that caches per-file parse state: appends read only
 * the new byte range plus the retained tail, which is verified byte-for-byte
 * before the parse resumes. Truncation, tail mismatch, or a same-size rewrite
 * fall back to a full re-read. `reservedHeaderBytes` excludes a fixed-width
 * mutable prefix (for example the OMP title slot) from the incremental parse:
 * the caller re-reads that prefix itself on every snapshot.
 */
export function createIncrementalMetadataReader<Accumulator extends object>(
  parser: MetadataLineParser<Accumulator>,
  io: SessionMetadataReaderIo = nodeMetadataReaderIo,
  reservedHeaderBytes = 0,
): SessionMetadataReader {
  const states = new Map<string, IncrementalMetadataState<Accumulator>>()
  const locks = new Map<string, Promise<unknown>>()

  const remember = (filePath: string, state: IncrementalMetadataState<Accumulator>): void => {
    states.delete(filePath)
    states.set(filePath, state)
    while (states.size > MAX_TRACKED_METADATA_STATES) {
      const oldest = states.keys().next().value as string | undefined
      if (oldest === undefined) break
      states.delete(oldest)
    }
  }

  const fullRead = async (filePath: string, fileStat: Stats): Promise<SessionMetadata> => {
    const state: IncrementalMetadataState<Accumulator> = {
      size: 0,
      mtimeMs: fileStat.mtimeMs,
      pending: Buffer.alloc(0),
      tail: Buffer.alloc(0),
      accumulator: parser.createAccumulator(filePath, fileStat),
    }
    await ingestRange(io, parser, state, filePath, Math.min(reservedHeaderBytes, fileStat.size), fileStat.size)
    remember(filePath, state)
    return snapshotState(parser, state, filePath, fileStat.mtime.toISOString())
  }

  const perform = async (filePath: string, knownStat?: Stats): Promise<SessionMetadata> => {
    let fileStat: Stats
    try {
      fileStat = knownStat ?? await io.inspect(filePath)
    } catch (error) {
      states.delete(filePath)
      throw error
    }
    if (fileStat.size > MAX_SESSION_FILE_BYTES) {
      states.delete(filePath)
      throw new Error('Session file is too large')
    }
    const state = states.get(filePath)
    if (state && fileStat.size === state.size && fileStat.mtimeMs === state.mtimeMs) {
      remember(filePath, state)
      return snapshotState(parser, state, filePath, fileStat.mtime.toISOString())
    }
    if (state && fileStat.size > state.size) {
      try {
        const verified = state.tail
        const verifyStart = state.size - verified.length
        const resumed: IncrementalMetadataState<Accumulator> = {
          size: state.size,
          mtimeMs: fileStat.mtimeMs,
          pending: state.pending,
          tail: state.tail,
          accumulator: { ...state.accumulator },
        }
        let verifiedBytes = 0
        let mismatch = false
        const stream = io.openStream(filePath, verifyStart, fileStat.size - 1)
        try {
          for await (const raw of stream) {
            let chunk = typeof raw === 'string' ? Buffer.from(raw, 'utf8') : raw as Buffer
            if (verifiedBytes < verified.length) {
              const compare = Math.min(verified.length - verifiedBytes, chunk.length)
              if (!chunk.subarray(0, compare).equals(verified.subarray(verifiedBytes, verifiedBytes + compare))) {
                mismatch = true
                break
              }
              verifiedBytes += compare
              chunk = chunk.subarray(compare)
            }
            if (chunk.length) ingestBytes(parser, resumed, chunk)
          }
        } finally {
          stream.destroy()
        }
        if (!mismatch && verifiedBytes === verified.length) {
          resumed.size = fileStat.size
          remember(filePath, resumed)
          return snapshotState(parser, resumed, filePath, fileStat.mtime.toISOString())
        }
      } catch (error) {
        if (error instanceof Error && (error.message === 'Session file has too many records' || error.message === 'JSONL record exceeded the maximum frame size')) {
          states.delete(filePath)
          throw error
        }
        // A failed range read (rotation, permissions) falls through to a full read.
      }
    }
    try {
      return await fullRead(filePath, fileStat)
    } catch (error) {
      states.delete(filePath)
      throw error
    }
  }

  return (filePath, knownStat) => {
    const previous = locks.get(filePath) ?? Promise.resolve()
    const run = previous.then(() => perform(filePath, knownStat), () => perform(filePath, knownStat))
    const settled = run.then(() => undefined, () => undefined)
    locks.set(filePath, settled)
    void settled.then(() => { if (locks.get(filePath) === settled) locks.delete(filePath) })
    return run
  }
}
