# Repository engineering guidance

## File size

Keep handwritten production files at or below 750 lines when practical. Treat 750 lines as a review threshold, not a reason to create arbitrary wrapper modules or split cohesive logic.

When changing an existing production file above the threshold, avoid increasing its size unless the change cannot be separated without weakening cohesion. Prefer extracting a complete responsibility with a narrow interface, and explain any intentional exception in the pull request.

This threshold does not apply to tests, generated files, vendored code, lockfiles, fixtures, or data assets. Correctness, security boundaries, and maintainable ownership take precedence over line count.

## Toolchain and headless checks

Canonical toolchain and check commands live in [`docs/validation.md`](docs/validation.md); do not restate versions here. `node` comes from `.nvmrc` and `pnpm` from Corepack (`packageManager` field).

Catfish-Pi is a GUI Electron app with no background services, so there is nothing to auto-start. To run the app or the Playwright Electron e2e suite headlessly on Linux, wrap the command with a virtual display:

```
xvfb-run -a pnpm run dev               # launch the desktop app
xvfb-run -a pnpm run test:e2e:hermetic # build + hermetic Electron e2e
```

Some xterm/PTY-driven e2e cases in `tests/e2e/app.spec.ts` are timing-sensitive under headless `xvfb` and can fail where they pass on the macOS CI runner that owns the `hermetic-e2e` gate.
