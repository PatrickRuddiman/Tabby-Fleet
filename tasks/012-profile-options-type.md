Parent slice: [profile-and-settings](../slices/profile-and-settings.md)
Depends on: 002

# Task 012 — AgentFleetProfileOptions interface in api.ts

_Tick `[x]` on each Tasks item as you finish it, and on each Acceptance item as it passes. The unticked state is what tells the next planning run that this task is still safe to edit in place._

## Goal
Declare the 27-field `AgentFleetProfileOptions` interface and the matching `DEFAULT_PROFILE_OPTIONS` constant in `api.ts`, so all downstream slices read from one canonical type.

## Tasks
- [x] Edit `src/api.ts`: declare and export the `AgentFleetProfileOptions` interface with all 27 fields from [`plan.md`](../plan.md) Appendix C / [slice §4](../slices/profile-and-settings.md). Field types: `repoPath: string`, `worktreePathPrefix: string`, three booleans for include filters, four string templates, two `string | null` colors, `layoutMode: 'grid' | 'static-grid'`, three numbers for zoom/min-dims/transition, `watchMode: 'fs' | 'poll' | 'off'`, `pollIntervalMs: number`, four booleans for auto/notify/focus/notify, `spawnMode: 'eager' | 'lazy'`, `preSpawnCommand: string`, `shell: string`, `shellArgs: string[]`, `encoding: 'encoded' | 'command'`.
- [x] Edit `src/api.ts`: export `DEFAULT_PROFILE_OPTIONS: AgentFleetProfileOptions` with exactly the values listed in plan.md Appendix C (e.g. `worktreePathPrefix: '.claude/worktrees/'`, `rootCommandTemplate: 'claude'`, `zoomFactor: 2.0`, `minPaneWidth: 120`, `minPaneHeight: 80`, etc.).
- [x] Create `tests/api.test.ts` with cases: (a) `DEFAULT_PROFILE_OPTIONS` has all 27 keys (`Object.keys(DEFAULT_PROFILE_OPTIONS).length === 27`), (b) `DEFAULT_PROFILE_OPTIONS.layoutMode === 'grid'`, (c) `DEFAULT_PROFILE_OPTIONS.shellArgs` is the array `['-NoExit', '-EncodedCommand']`, (d) the interface and constant are type-compatible (assign one to a `Partial<AgentFleetProfileOptions>` variable in the test).

## Acceptance criteria
- [x] `npm test -- --grep api` exits 0 with at least 4 passing cases.
- [x] `npx tsc --noEmit` exits 0.
- [x] `grep -cE '^\s+\w+:' src/api.ts | head -1` returns at least 27 (one line per interface field).
- [x] `grep -nE 'export (interface|const) (AgentFleetProfileOptions|DEFAULT_PROFILE_OPTIONS)' src/api.ts` matches both exports.

> If a `## Tasks` checkbox can't be completed without changing what the parent slice specifies, stop and update the slice. Do not redesign here.
