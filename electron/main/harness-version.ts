import type { HarnessDescriptor } from './harness'

/**
 * Minimum-version floor for external harnesses, modeled on apoc/omp-desktop's
 * `MIN_OMP_VERSION` gate: a harness older than the release this app validated
 * its protocol against is refused with an explicit update hint instead of
 * failing later as silent protocol drift. Each floor mirrors the live-checked
 * version recorded in `docs/omp-integration.md` and `docs/pi-integration.md`.
 */
export type HarnessVersion = readonly [major: number, minor: number, patch: number]

const VERSION_PATTERN = /(\d{1,5})\.(\d{1,5})\.(\d{1,5})/

/** Extracts the first `major.minor.patch` triple from a `--version` token such as `omp/18.9.1` or `v0.84.1`. */
export function parseHarnessVersion(raw: string | null): HarnessVersion | null {
  if (!raw) return null
  const match = VERSION_PATTERN.exec(raw)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])] as const
}

export function formatHarnessVersion(version: HarnessVersion): string {
  return `${version[0]}.${version[1]}.${version[2]}`
}

export function isBelowMinimumVersion(version: HarnessVersion, minimum: HarnessVersion): boolean {
  for (let index = 0; index < 3; index += 1) {
    if (version[index] !== minimum[index]) return version[index] < minimum[index]
  }
  return false
}

/** User-facing reason shown on the settings harness card when a detected harness is refused. */
export function belowMinimumVersionReason(descriptor: HarnessDescriptor, version: HarnessVersion): string {
  const minimum = descriptor.minimumVersion
  if (!minimum) throw new TypeError('belowMinimumVersionReason requires descriptor.minimumVersion')
  const update = descriptor.updateCommand ? ` Run \`${descriptor.updateCommand}\`, then` : 'Update it, then'
  return `${descriptor.agentName} ${formatHarnessVersion(version)} is below the minimum supported version ${formatHarnessVersion(minimum)}.${update} refresh detection in Settings.`
}
