Parent slice: [packaging-ci-docs](../slices/packaging-ci-docs.md)
Depends on: 003, 004, 005, 006, 007, 008, 009, 010

# Task 024 — GitHub Actions CI workflow (Windows + Ubuntu + macOS test matrix)

_Tick `[x]` on each Tasks item as you finish it, and on each Acceptance item as it passes. The unticked state is what tells the next planning run that this task is still safe to edit in place._

## Goal
Workflow that runs the unit-test suite on Windows, Ubuntu, and macOS using Node 20, plus a build job that uploads the `dist/` artifact.

## Tasks
- [ ] Create `.github/workflows/ci.yml`. Trigger: `on: { push: { branches: [main] }, pull_request: { branches: [main] } }`.
- [ ] In `.github/workflows/ci.yml`, define a `test` job with `strategy.matrix.os: [windows-latest, ubuntu-latest, macos-latest]`. Steps: `actions/checkout@v4`, `actions/setup-node@v4` with `node-version: '20'` and `cache: 'npm'`, `npm ci`, `npm test`.
- [ ] In `.github/workflows/ci.yml`, define a `build` job with `needs: test`, `runs-on: ubuntu-latest`. Steps: checkout, setup-node, `npm ci`, `npm run build`, `actions/upload-artifact@v4` uploading `dist/`.
- [ ] In `.github/workflows/ci.yml`, set `permissions: contents: read` at workflow level (least-privilege).

## Acceptance criteria
- [ ] `test -f .github/workflows/ci.yml` exits 0.
- [ ] `grep -nE 'matrix:\s*\n\s*os:' .github/workflows/ci.yml || grep -nE 'os: \[windows-latest, ubuntu-latest, macos-latest\]' .github/workflows/ci.yml` matches one line.
- [ ] `grep -nE 'node-version:.*20' .github/workflows/ci.yml` matches one line.
- [ ] `grep -nE 'npm test' .github/workflows/ci.yml` matches one line.
- [ ] `grep -nE 'upload-artifact@v4' .github/workflows/ci.yml` matches one line.
- [ ] `npx --no-install action-validator .github/workflows/ci.yml >/dev/null 2>&1 || true` — best-effort validation; not blocking if action-validator is not installed.
- [ ] `npm test` exits 0 (regression check — the test suite that CI will run on all three OS still passes locally).

> If a `## Tasks` checkbox can't be completed without changing what the parent slice specifies, stop and update the slice. Do not redesign here.
