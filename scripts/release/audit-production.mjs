#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { describeAuditEvaluation, evaluateAuditReport, readAuditExceptions } from './audit-exceptions.mjs'
import { resolveCommandInvocation } from './lib.mjs'

// pnpm audit exits non-zero whenever it reports anything at the requested level, so the status is
// no help here: the report itself decides, and only an unparseable report is a runner failure.
function runProductionAudit() {
  const invocation = resolveCommandInvocation('pnpm', ['audit', '--prod', '--json'])
  const result = spawnSync(invocation.file, invocation.args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, shell: invocation.shell })
  if (result.error) throw result.error
  if (!result.stdout?.trim()) throw new Error(`pnpm audit produced no output${result.stderr ? `: ${result.stderr.trim()}` : ''}`)
  let report
  try {
    report = JSON.parse(result.stdout)
  } catch {
    throw new Error(`pnpm audit did not produce JSON${result.stderr ? `: ${result.stderr.trim()}` : ''}`)
  }
  if (!report || typeof report !== 'object' || Array.isArray(report)) throw new Error('pnpm audit produced an invalid report shape')
  if ('error' in report) {
    const error = report.error
    const detail = error && typeof error === 'object' && 'summary' in error ? error.summary : String(error)
    throw new Error(`pnpm audit failed: ${detail}`)
  }
  if (!Object.hasOwn(report, 'advisories')) throw new Error('pnpm audit report has no advisories section')
  return report
}

try {
  const evaluation = describeAuditEvaluation(evaluateAuditReport(runProductionAudit(), readAuditExceptions()))
  if (evaluation.ok) console.log(`Production dependency audit passed: ${evaluation.message}`)
  else {
    console.error(`Production dependency audit failed:\n${evaluation.message}`)
    process.exitCode = 1
  }
} catch (error) {
  console.error(`Production dependency audit could not run: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
