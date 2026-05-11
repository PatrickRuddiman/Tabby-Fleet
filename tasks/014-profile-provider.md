Parent slice: [tabby-host](../slices/tabby-host.md)
Depends on: 012, 013

# Task 014 — AgentFleetProfileProvider

_Tick `[x]` on each Tasks item as you finish it, and on each Acceptance item as it passes. The unticked state is what tells the next planning run that this task is still safe to edit in place._

## Goal
Register the `agent-fleet` profile type with Tabby's `ProfileProvider` so a profile of type `agent-fleet` is selectable in the profile UI and opens a `SplitTabComponent` when launched.

## Tasks
- [ ] Create `src/providers/profile.provider.ts` exporting `AgentFleetProfileProvider extends ProfileProvider<Profile<AgentFleetProfileOptions>>` (import `ProfileProvider` and `Profile` from `tabby-core`).
- [ ] In `src/providers/profile.provider.ts`, set `id = 'agent-fleet'`, `name = 'Agent Fleet'`, `configDefaults = { options: DEFAULT_PROFILE_OPTIONS }` (importing `DEFAULT_PROFILE_OPTIONS` from `../api`).
- [ ] In `src/providers/profile.provider.ts`, implement `getNewTabParameters(profile): Promise<NewTabParameters<SplitTabComponent>>` returning `{ type: SplitTabComponent, inputs: { fleetProfile: profile.options } }`. Import `SplitTabComponent` from `tabby-core/src/components/splitTab.component` (or `tabby-terminal`, whichever exports it in the consumed version).
- [ ] In `src/providers/profile.provider.ts`, implement `getDescription(profile)` returning `profile.options.repoPath || '(current directory)'`.
- [ ] In `src/providers/profile.provider.ts`, implement `getBuiltinProfiles()` returning a single suggested profile `{ name: 'Agent Fleet (current dir)', options: DEFAULT_PROFILE_OPTIONS }`.
- [ ] In `src/providers/profile.provider.ts`, set `settingsComponent` to `AgentFleetProfileSettingsComponent` (the import will resolve once task 017 lands; for now use a type-only forward reference via `import type` or set to `null as any` with a TODO).
- [ ] Create `tests/profile.provider.test.ts` with cases: (a) `id === 'agent-fleet'`, (b) `name === 'Agent Fleet'`, (c) `configDefaults.options` deep-equals `DEFAULT_PROFILE_OPTIONS`, (d) `getDescription({options:{...DEFAULT_PROFILE_OPTIONS, repoPath:'C:\\dev\\foo'}})` returns `'C:\\dev\\foo'`, (e) `getDescription({options:{...DEFAULT_PROFILE_OPTIONS, repoPath:''}})` returns `'(current directory)'`, (f) `getNewTabParameters({options:DEFAULT_PROFILE_OPTIONS})` returns an object with `type` set to SplitTabComponent and `inputs.fleetProfile` deep-equal to DEFAULT_PROFILE_OPTIONS.

## Acceptance criteria
- [ ] `npm test -- --grep profile.provider` exits 0 with at least 6 passing cases.
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `grep -nE 'export class AgentFleetProfileProvider' src/providers/profile.provider.ts` matches one line.
- [ ] `grep -nE "id = 'agent-fleet'" src/providers/profile.provider.ts` matches one line.

> If a `## Tasks` checkbox can't be completed without changing what the parent slice specifies, stop and update the slice. Do not redesign here.
