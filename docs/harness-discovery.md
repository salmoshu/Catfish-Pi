# Harness discovery

Catfish-Pi discovers Pi-family harnesses without invoking a shell or evaluating shell startup files. This keeps startup bounded and makes detection independent of whether the user prefers bash, zsh, fish, or no interactive shell at all.

## Resolution order

Each refresh checks, in order:

1. The absolute executable override saved in Harness settings.
2. The harness-specific environment override (`OMP_BINARY` or `PI_BINARY`).
3. Absolute directories in the process `PATH`/`Path` snapshot.
4. Official harness-specific installer locations.
5. Shared system and package-manager locations for npm, Bun, pnpm, mise, Volta, Homebrew, and Linuxbrew. NVM version-manager directories are bounded to 64 entries and sorted by descending version.

Candidates are deduplicated and must be executable. Catfish-Pi then runs a bounded `--version` probe with no shell; only an exit-zero candidate is published to the renderer. A broken override therefore falls through to later automatic candidates, but its own missing, permission, spawn, exit, timeout, or output-limit reason is retained for the settings card. If no candidate works, the card reports the configured override's reason when present, otherwise the last probed candidate's reason. Probe stderr is control-character-stripped and byte-capped before it crosses IPC.

The relevant upstream install layouts are documented by [Pi](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md), [OMP](https://github.com/can1357/oh-my-pi), [npm](https://docs.npmjs.com/files/folders.html), [Bun](https://bun.sh/docs/installation), [pnpm](https://pnpm.io/settings/other#globalbindir), [mise](https://mise.jdx.dev/dev-tools/shims.html), and [Volta](https://docs.volta.sh/guide/getting-started).

## Minimum version floor

Borrowed from apoc/omp-desktop's `MIN_OMP_VERSION` gate: each external harness descriptor declares the oldest release this app validated its RPC protocol against (`docs/omp-integration.md`, `docs/pi-integration.md`). A candidate whose `--version` output parses to a lower `major.minor.patch` is refused: it is not published for launches, and the settings card shows the detected version, the floor, and the harness-specific update command (`omp update`, `npm update -g @earendil-works/pi-coding-agent`). An explicit refusal beats silent protocol drift. A candidate whose version cannot be parsed stays runnable — the RPC handshake reports genuine incompatibility — so development builds are not blocked. Floors: OMP ≥ 17.2.11, Pi ≥ 0.84.1.

## Windows and WSL boundaries

OMP's native Windows installer writes `%LOCALAPPDATA%\omp\omp.exe`, which is checked explicitly so Refresh works even when the running GUI still has the old `Path` snapshot. Native `pi.exe` releases are discoverable through `Path` or an explicit override.

Pi's official npm install on Windows creates a `pi.cmd` shim instead of a native executable. Catfish-Pi recognizes only the shim declared on the harness descriptor, verifies the fixed entrypoint beneath the npm prefix (`@earendil-works/pi-coding-agent/dist/cli.js`), finds a runnable `node.exe`, and launches the entrypoint directly without a command shell. OMP's official Windows install is Bun-based (`@oh-my-pi/pi-coding-agent`, `engines.bun` only), so its `omp.cmd` shim embeds absolute paths to `bun.exe` and the package entrypoint; Catfish-Pi parses that shim, validates the `@oh-my-pi` package marker, and launches `bun.exe` with the entrypoint directly — never Node, since OMP's CLI cannot run under it. Community forks or other layouts (for example a `pi.cmd` outside an npm prefix) are not recognized, use the explicit override with a native executable instead.

A Windows app also does not treat an executable inside a WSL distribution as a native Windows path. WSL execution requires an explicit transport, distribution selection, Windows/Linux cwd conversion, and Linux-owned session roots. If Catfish-Pi itself runs as a Linux application under WSLg, normal Linux discovery applies.
