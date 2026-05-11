Parent slice: [packaging-ci-docs](../slices/packaging-ci-docs.md)
Depends on: 023, 024

# Task 025 — npm publish workflow on `v*` tag push

_Tick `[x]` on each Tasks item as you finish it, and on each Acceptance item as it passes. The unticked state is what tells the next planning run that this task is still safe to edit in place._

## Goal
GitHub Actions workflow triggered by `v*` tag push that runs tests, builds, and publishes to npmjs.com via the `NPM_TOKEN` secret.

## Tasks
- [ ] Create `.github/workflows/publish.yml`. Trigger: `on: { push: { tags: ['v*'] } }`.
- [ ] In `.github/workflows/publish.yml`, define a `publish` job with `runs-on: ubuntu-latest`. Steps: `actions/checkout@v4`, `actions/setup-node@v4` with `node-version: '20'` and `registry-url: 'https://registry.npmjs.org'`, `npm ci`, `npm test`, `npm run build`, `npm publish --access public` with `env: NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`.
- [ ] In `.github/workflows/publish.yml`, set `permissions: contents: read, id-token: write` (the `id-token` permission allows future migration to npm Trusted Publishing without changing the workflow shape).

## Acceptance criteria
- [ ] `test -f .github/workflows/publish.yml` exits 0.
- [ ] `grep -nE "tags:\s*\[?'v\*'" .github/workflows/publish.yml` matches one line.
- [ ] `grep -nE 'npm publish' .github/workflows/publish.yml` matches one line.
- [ ] `grep -nE 'NPM_TOKEN' .github/workflows/publish.yml` matches one line.
- [ ] `grep -nE 'npm test' .github/workflows/publish.yml` matches one line (tests run before publish — regression gate).
- [ ] `npm test` exits 0 (final regression check across the full project).

> If a `## Tasks` checkbox can't be completed without changing what the parent slice specifies, stop and update the slice. Do not redesign here.
