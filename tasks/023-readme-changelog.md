Parent slice: [packaging-ci-docs](../slices/packaging-ci-docs.md)
Depends on: 022

# Task 023 — README.md and CHANGELOG.md

_Tick `[x]` on each Tasks item as you finish it, and on each Acceptance item as it passes. The unticked state is what tells the next planning run that this task is still safe to edit in place._

## Goal
User-facing README with install, quickstart, settings reference (27 rows), template variables, layout modes, troubleshooting, platform support; CHANGELOG seeded for v0.1.0.

## Tasks
- [ ] Create `README.md` with sections per [packaging-ci-docs slice §4](../slices/packaging-ci-docs.md): heading + pitch, install (npm command + symlink instructions), quickstart (paraphrasing spec §2 acceptance example 1), settings reference (27-row table from plan.md Appendix C with one-line descriptions), template variables (9 entries from spec §3 In with worked example), layout modes (grid vs static-grid), filesystem watcher modes (fs vs poll vs off), troubleshooting (six entries: not-a-git-repo, command not found, worktree excluded by filter, network-share watcher fallback, plugin missing, macOS/Linux), platform support (Windows = full, macOS/Linux = developer-supplied shell config), links to `spec.md` and `plan.md`, MIT license note.
- [ ] Create `CHANGELOG.md` in Keep-a-Changelog format. Add `## [Unreleased]` section with v0.1 entries under `Added`: profile type, watcher, auto-zoom layout, dead-pane overlay, settings UI.
- [ ] In `README.md` settings reference, render the 27-row table with three columns: `Setting`, `Default`, `Description`. The Default column copies values from `DEFAULT_PROFILE_OPTIONS` in `src/api.ts`.
- [ ] In `README.md` troubleshooting "macOS / Linux" entry: explicitly call out that the developer must override `shell` and `shellArgs` per-profile because the v0.1 default `pwsh.exe` is Windows-only.

## Acceptance criteria
- [ ] `test -f README.md && test -f CHANGELOG.md` exits 0.
- [ ] `grep -cE '^\|.*\|.*\|' README.md` returns at least 28 (27 settings rows + header line).
- [ ] `grep -nE '## Install|## Quickstart|## Settings|## Template variables|## Troubleshooting' README.md` matches at least 5 lines.
- [ ] `grep -nE '## \[Unreleased\]' CHANGELOG.md` matches one line.
- [ ] `npm test` exits 0 (regression check — README addition doesn't break tests).
- [ ] `npx markdownlint README.md CHANGELOG.md` exits 0 if markdownlint is installed, otherwise skip (`npx --no-install markdownlint --version >/dev/null 2>&1 && npx markdownlint README.md CHANGELOG.md`).

> If a `## Tasks` checkbox can't be completed without changing what the parent slice specifies, stop and update the slice. Do not redesign here.
