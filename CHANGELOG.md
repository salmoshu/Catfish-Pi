# Changelog

## 0.1.1 — 2026-10-14

### Changed

- Settings navigation moved into the project sidebar: while the settings view is open, the sidebar lists all ten sections with a "Back to session" button, and the main content renders the active section. The old in-page settings rail is removed.
- Package management and CI migrated from npm to pnpm (`pnpm-lock.yaml`, `pnpm-workspace.yaml`); workflows, scripts, and docs updated accordingly.
- Desktop icon replaced with the Catfish-Pi catfish mascot; `assets/icon.png` and platform icons regenerated from the new brand source.

### Removed

- Prime Agent harness support: dependencies, main/renderer integration, assets, vendored tarballs, tests, and docs deleted. Pi and OMP remain the supported harnesses.
- `.cursor/` agent tooling (pstack skills, agents, environment hooks) and the vendored npm document.

### Fixed

- `.gitignore` now covers intermediate build and packaging artifacts produced by the release scripts.
