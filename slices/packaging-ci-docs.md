Parent spec: [tabby-fleet specification](../spec.md)

# tabby-fleet — packaging-ci-docs

## §1 Summary

Ships the plugin: the user-facing README (install, quickstart, settings reference, troubleshooting, platform notes), the GitHub Actions workflow that runs unit tests on Windows / Ubuntu / macOS, and the npm publish process. After this slice, `tabby-fleet` is installable via `npm install tabby-fleet` and CI runs on every push.

## §2 Codebase reconnaissance

> Greenfield: no existing system to reconcile. Decisions below are unconstrained.

References:
- [`plan.md`](../plan.md) §17 Phase 8 ("README; npm publish; Manual integration tests; GitHub Actions running unit tests on Windows / Ubuntu / macOS").
- [`plan.md`](../plan.md) Verification section: 12-step end-to-end test plan; this slice's README documents step-by-step setup so a developer can reproduce it.
- Sibling slice contracts already settled — every settings, command, behavior, and failure mode referenced in the README comes from [spec.md](../spec.md) §2/§3/§4 and the per-slice doc.

## §3 Decisions

1. **README structure.** Options considered: single long page, multi-file `docs/` directory, split README + CHANGELOG only. **Chosen:** single long page with anchor links. Rationale: npm renders README inline; a single file is the path of least friction for users browsing on npmjs.com; per-section anchors give power users a navigation surface without a multi-file build.

2. **Settings reference format.** Options considered: prose, big table, per-section subheadings. **Chosen:** a single table listing all 27 settings with columns `setting | default | description`. Rationale: matches plan.md Appendix C's existing table; one place to look up any default; copy-paste source for the settings UI's inline hints if needed.

3. **CI matrix.** Options considered: Windows-only (matches v0.1 platform stance), Windows + Ubuntu + macOS, full matrix with multiple Node versions. **Chosen:** Windows + Ubuntu + macOS, Node 20 LTS only. Rationale: plan.md Verification step 12 calls for the three-OS matrix on unit tests; multi-Node adds runtime without value (Tabby ships a fixed Node via Electron); macOS / Linux unit tests verify the pure-function modules even if the v0.1 plugin defaults are Windows-only.

4. **CI test command.** Options considered: `npm test` invoking jest or mocha, `npm run build && npm test`, individual test-file invocations. **Chosen:** `npm test` running the test framework that ships with `tabby-plugin-template` (likely mocha + ts-node; verify at scaffold time). Rationale: one entry point keeps the workflow trivial; the framework's choice is set by [`plugin-scaffold`](plugin-scaffold.md), not redebated here.

5. **CI publish trigger.** Options considered: manual via `npm publish` on a tagged commit, automated on `v*` tag push via Actions, automated on every main push. **Chosen:** automated on `v*` tag push (e.g. `git tag v0.1.0 && git push --tags`). Rationale: tagging is an intentional gesture; matches the npm publishing convention for most plugins; prevents accidental publishes from main pushes.

6. **`npmjs.com` auth.** Options considered: classic npm token in `NPM_TOKEN` secret, granular access token, npm Trusted Publishing via OIDC. **Chosen:** classic `NPM_TOKEN` in GitHub Actions secrets. Rationale: simplest setup for a single-maintainer plugin; can move to Trusted Publishing later if multi-maintainer.

7. **Troubleshooting section content.** Options considered: minimal stub, exhaustive failure-mode walkthrough, spec §2 failure modes verbatim. **Chosen:** distilled from spec §2 failure modes + §5 open questions, plus the watcher-network-share note from plan.md and the v0.1 Windows-defaults caveat. Rationale: every entry corresponds to something the user can encounter and act on; spec §2 already enumerates the closed set.

8. **Version + changelog.** Options considered: `CHANGELOG.md` maintained by hand, GitHub Releases auto-generated notes only, both. **Chosen:** `CHANGELOG.md` maintained by hand (Keep-a-Changelog format). Rationale: npm displays it; GitHub Releases can mirror; hand-maintained gives the author space to note breaking changes per spec §3 In's `fleetVersion: 1` schema.

## §4 Contracts & shapes

**File:** `README.md` — top-level sections:
- **Heading + one-paragraph pitch** — derived from spec §1.
- **Screenshot / GIF** placeholder (deferred; manual capture during dogfooding).
- **Install** — npm install command, manual symlink instructions for local dev, and the post-install steps (restart Tabby, find profile under Settings → Profiles → New → `Agent Fleet`).
- **Quickstart** — six-line walkthrough corresponding to spec §1.2 / §2 acceptance example 1.
- **Settings reference** — the 27-row table from plan.md Appendix C, with one-line descriptions tying each setting to its spec §3 In phrasing.
- **Template variables** — the nine variables enumerated in spec §3 In with one-line definitions and a worked example.
- **Layout modes** — `grid` vs `static-grid`, with the spec §2 "Focus and layout" acceptance examples paraphrased.
- **Filesystem watcher modes** — `fs` vs `poll` vs `off`, with the network-share fallback note from spec §2 failure modes.
- **Troubleshooting** — each entry derived from a spec §2 failure mode:
  - "Launch aborts: not a git repository" → check `repoPath` setting; see spec failure mode.
  - "Pane shows command not found" → the configured `commandTemplate` references a binary not on PATH.
  - "Worktree appeared but pane didn't open" → check filter settings (`includeDetached`, `includePrunable`, `includeLocked`, prefix match).
  - "Watcher silently stopped working on network share" → set `watchMode` to `poll`; see one-time notice for current mode.
  - "Plugin doesn't appear in Tabby" → restart Tabby; check plugin's `package.json` keyword.
  - "macOS / Linux: panes don't open" → override `shell` and `shellArgs` per-profile; v0.1 ships Windows defaults.
- **Platform support** — Windows fully supported with shipped defaults; macOS / Linux work with developer-supplied shell config (deferred to v0.2 for shipped defaults).
- **Spec and design** — link to `spec.md` and `plan.md` (preserved alongside the package for reference).
- **License** — per the developer's choice; placeholder MIT.

**File:** `CHANGELOG.md` (Keep-a-Changelog).
- `## [Unreleased]` section as the working draft.
- `## [0.1.0] - YYYY-MM-DD` on first publish.
- Entries categorized: `Added`, `Changed`, `Fixed`, `Removed`, `Security`.

**File:** `.github/workflows/ci.yml`.
- Trigger: `push`, `pull_request` on `main`.
- Jobs:
  - `test` (matrix: `os: [windows-latest, ubuntu-latest, macos-latest]`):
    - `actions/checkout@v4`.
    - `actions/setup-node@v4` with `node-version: '20'`.
    - `npm ci`.
    - `npm test`.
  - `build` (depends on `test`; runs on `ubuntu-latest`):
    - `actions/checkout@v4`, `actions/setup-node@v4`, `npm ci`, `npm run build`.
    - Upload `dist/` as a workflow artifact.

**File:** `.github/workflows/publish.yml`.
- Trigger: `push` of tags matching `v*`.
- Job:
  - `actions/checkout@v4`.
  - `actions/setup-node@v4` with `registry-url: 'https://registry.npmjs.org'`.
  - `npm ci`.
  - `npm test`.
  - `npm run build`.
  - `npm publish --access public` with `env: NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`.
  - Optionally `actions/create-release@v1` to mirror to GitHub Releases (deferred).

**Failure modes specific to this slice:**
- `NPM_TOKEN` secret missing: publish job fails with auth error; the README install instructions still work because they reference the published package after a successful publish. First publish must be done manually until the secret is set.
- macOS / Linux unit tests fail because of path-handling differences: spec §3 In specifies case-insensitive on Windows only; unit tests for `worktree-data` must mock `process.platform` to cover both branches. CI flags this.
- README links to `spec.md` and `plan.md` only work in-repo and on GitHub; when rendered on npmjs.com the relative links 404. Acceptable for v0.1; alternative would be absolute GitHub URLs.

## §5 Sequence

**Initial repo setup (after plugin-scaffold ships):**
1. Write `README.md` with all sections from §4.
2. Write `CHANGELOG.md` with `## [Unreleased]` entries describing v0.1 features.
3. Add `.github/workflows/ci.yml` and `.github/workflows/publish.yml`.
4. Push to GitHub; verify the CI workflow runs and passes on the three-OS matrix.

**First publish (after all v0.1 features land and dogfooding completes):**
1. Update `CHANGELOG.md`: move `Unreleased` entries under `## [0.1.0] - YYYY-MM-DD`.
2. Update `package.json` `version` to `0.1.0`.
3. Commit and push to main.
4. Set the `NPM_TOKEN` secret in GitHub repository settings.
5. `git tag v0.1.0 && git push --tags`.
6. GitHub Actions `publish.yml` triggers, builds, tests, and runs `npm publish`.
7. Verify the package appears at https://npmjs.com/package/tabby-fleet within ~2 minutes.
8. Test install via `npm install tabby-fleet` into a clean Tabby plugins directory.

**Post-release (every subsequent version):**
1. Move new `Unreleased` entries under the new version header in `CHANGELOG.md`.
2. Bump `package.json` `version`.
3. Tag + push; CI publishes automatically.

## §6 Out of scope

- Implementation of any feature documented in the README — owned by sibling slices.
- The `package.json`, `webpack.config.js`, `tsconfig.json`, and `src/index.ts` files — owned by [`plugin-scaffold`](plugin-scaffold.md). This slice adds `README.md`, `CHANGELOG.md`, and `.github/workflows/`.
- Test framework choice — set by `plugin-scaffold` when cloning `tabby-plugin-template`.
- Integration tests against a live Tabby instance — only unit tests run in CI; manual integration tests (plan.md Verification steps 1–11) happen on the developer's machine.
- Screenshots / GIFs of the running plugin — captured during manual dogfooding; placeholder in the README until then.
- Trusted Publishing via OIDC — classic `NPM_TOKEN` for v0.1; revisit at v0.2.

## §7 Open questions

None.

> If the parent spec is ambiguous on anything this slice depends on, stop and update the spec. Do not invent behavior here.
