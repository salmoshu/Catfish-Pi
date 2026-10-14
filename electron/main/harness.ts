import { join, win32 } from 'node:path'

import type { HarnessId } from '../../src/types/api'

/**
 * Static description of one agent harness: how its executable is discovered
 * and where its agent state lives on disk. Discovery itself stays in
 * process-utils (`harnessExecutableCandidates`/`findHarnessExecutable`) so
 * every harness shares the same absolute-path and X_OK rules.
 */
export interface HarnessDescriptor {
  id: HarnessId
  productName: string
  agentName: string
  executableName: (platform: NodeJS.Platform) => string
  /** Environment override for the executable; only absolute paths are honored. */
  binaryEnvVar: string
  /** Directories under process.resourcesPath (as path segments) that may bundle the executable. */
  bundledResourceDirs: readonly (readonly string[])[]
  /** Harness-specific locations beyond the shared package-manager and system directories. */
  candidateDirs: (platform: NodeJS.Platform, home: string, env: NodeJS.ProcessEnv) => string[]
  /** Official npm `.cmd` shim on Windows and the package entrypoint below `<shim dir>\node_modules`. */
  windowsNpmShim?: { shim: string; entrypoint: readonly string[] }
  /**
   * Bun-generated `.cmd` shim on Windows (`@"<bun.exe>" "<package cli.js>" %*`).
   * Bun shims embed absolute paths instead of the npm `<shim dir>\node_modules`
   * layout, and the package requires the Bun runtime, so the shim file itself is
   * parsed for its runtime/entrypoint pair (see process-utils).
   * `packageMarker` is a required path segment of the embedded entrypoint.
   */
  windowsBunShim?: { shim: string; packageMarker: string }
  /** Oldest harness release this app validated its protocol against; older versions are refused (see harness-version.ts). */
  minimumVersion?: readonly [number, number, number]
  /** Command shown to users when a harness is below `minimumVersion`. */
  updateCommand?: string
  agentDir: (home: string) => string
  sessionRoot: (home: string) => string
}

export const HARNESSES: Record<HarnessId, HarnessDescriptor> = {
  omp: {
    id: 'omp',
    productName: 'OMP Work',
    agentName: 'OMP',
    executableName: (platform) => platform === 'win32' ? 'omp.exe' : 'omp',
    binaryEnvVar: 'OMP_BINARY',
    bundledResourceDirs: [],
    candidateDirs: (platform, _home, env) => {
      if (platform === 'win32') return env.LOCALAPPDATA ? [win32.join(env.LOCALAPPDATA, 'omp')] : []
      return env.PI_INSTALL_DIR ? [env.PI_INSTALL_DIR] : []
    },
    windowsBunShim: { shim: 'omp.cmd', packageMarker: '@oh-my-pi' },
    minimumVersion: [17, 2, 11],
    updateCommand: 'omp update',
    agentDir: (home) => join(home, '.omp', 'agent'),
    sessionRoot: (home) => join(home, '.omp', 'agent', 'sessions'),
  },
  pi: {
    id: 'pi',
    productName: 'Pi Work',
    agentName: 'Pi',
    executableName: (platform) => platform === 'win32' ? 'pi.exe' : 'pi',
    binaryEnvVar: 'PI_BINARY',
    bundledResourceDirs: [],
    candidateDirs: (platform, home, env) => platform === 'win32' ? [] : [
      join(env.XDG_DATA_HOME ?? join(home, '.local', 'share'), 'pi-node', 'current', 'bin'),
    ],
    windowsNpmShim: { shim: 'pi.cmd', entrypoint: ['@earendil-works', 'pi-coding-agent', 'dist', 'cli.js'] },
    minimumVersion: [0, 84, 1],
    updateCommand: 'npm update -g @earendil-works/pi-coding-agent',
    agentDir: (home) => join(home, '.pi', 'agent'),
    sessionRoot: (home) => join(home, '.pi', 'agent', 'sessions'),
  },
}
