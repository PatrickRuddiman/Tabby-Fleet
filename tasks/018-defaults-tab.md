Parent slice: [profile-and-settings](../slices/profile-and-settings.md)
Depends on: 017

# Task 018 — Global defaults settings tab provider + component

_Tick `[x]` on each Tasks item as you finish it, and on each Acceptance item as it passes. The unticked state is what tells the next planning run that this task is still safe to edit in place._

## Goal
A separate settings tab in Tabby's main settings UI titled "Agent Fleet defaults" that reuses the per-profile settings component, bound to `ConfigService.store.fleet.defaults`.

## Tasks
- [x] Create `src/providers/settings.provider.ts` exporting `AgentFleetDefaultsTabProvider implements SettingsTabProvider` (import `SettingsTabProvider` from `tabby-settings`). Set `id = 'agent-fleet-defaults'`, `title = 'Agent Fleet defaults'`, `iconClass = 'fas fa-layer-group'`, `getComponentType() => AgentFleetDefaultsTabComponent`.
- [x] Create `src/components/defaults-tab.component.ts` exporting `AgentFleetDefaultsTabComponent`. On init, read `this.config.store.fleet?.defaults` merged with `DEFAULT_PROFILE_OPTIONS` (imported from `../api`); store as `this.options`.
- [x] Create `src/components/defaults-tab.component.pug` that wraps `<agent-fleet-profile-settings [profile]="{options: options}"></agent-fleet-profile-settings>` to reuse the form from task 017. On change events from the child, write `this.config.store.fleet.defaults = this.options; this.config.save()`.
- [x] In `defaults-tab.component.ts`, inject `ConfigService` from `tabby-core`.
- [x] Create `tests/defaults-tab.test.ts` with cases: (a) on init with empty `config.store.fleet`, `options` deep-equals `DEFAULT_PROFILE_OPTIONS`, (b) on init with partial overrides, the overrides win field-by-field over defaults, (c) change events trigger `config.save()`, (d) `AgentFleetDefaultsTabProvider.id === 'agent-fleet-defaults'`.

## Acceptance criteria
- [x] `npm test -- --grep defaults-tab` exits 0 with at least 4 passing cases.
- [x] `npx tsc --noEmit` exits 0.
- [x] `grep -nE 'export class (AgentFleetDefaultsTabProvider|AgentFleetDefaultsTabComponent)' -r src/providers src/components` matches both exports.
- [x] `grep -nE 'agent-fleet-profile-settings' src/components/defaults-tab.component.pug` matches one line (reuse marker).

> If a `## Tasks` checkbox can't be completed without changing what the parent slice specifies, stop and update the slice. Do not redesign here.
