Parent slice: [profile-and-settings](../slices/profile-and-settings.md)
Depends on: 012, 014

# Task 017 — Per-profile settings component (7-section NgbAccordion)

_Tick `[x]` on each Tasks item as you finish it, and on each Acceptance item as it passes. The unticked state is what tells the next planning run that this task is still safe to edit in place._

## Goal
Angular component mounted by Tabby's profile editor that surfaces all 27 `AgentFleetProfileOptions` fields, grouped into seven accordion sections, with two-way data binding to `profile.options`.

## Tasks
- [ ] Create `src/components/settings.component.ts` exporting `AgentFleetProfileSettingsComponent implements ProfileSettingsComponent<AgentFleetProfileOptions, AgentFleetProfileProvider>`. Input: `profile: PartialProfile<Profile<AgentFleetProfileOptions>>`.
- [ ] Create `src/components/settings.component.pug` with an `<ngb-accordion>` containing 7 panels in this order: Repo, Templates, Filters, Layout, Watcher, Notifications, Shell. Bind each input via `[(ngModel)]="profile.options.<field>"`.
- [ ] In `settings.component.pug` Repo panel: text input for `repoPath` (placeholder `"leave empty for current directory"`), text input for `preSpawnCommand`.
- [ ] In `settings.component.pug` Templates panel: text inputs for `rootCommandTemplate`, `rootTitle`, `commandTemplate`, `paneTitlePattern`, each with a `<small>` hint listing the 9 template variables (`{path}`, `{path_native}`, `{branch}`, `{branch_short}`, `{name}`, `{head}`, `{head_short}`, `{repo}`, `{repo_path}`).
- [ ] In `settings.component.pug` Filters panel: text input for `worktreePathPrefix`, three checkboxes for `includeDetached` / `includePrunable` / `includeLocked`.
- [ ] In `settings.component.pug` Layout panel: select for `layoutMode` (options `'grid'` / `'static-grid'`), numbers for `zoomFactor` (clamped 1.0–4.0), `minPaneWidth` (≥40), `minPaneHeight` (≥40), `zoomTransitionMs` (0–1000).
- [ ] In `settings.component.pug` Watcher panel: select for `watchMode` (`'fs'` / `'poll'` / `'off'`), number for `pollIntervalMs` (clamped 500–60000), checkboxes for `autoOpenNew` / `autoCloseRemoved`.
- [ ] In `settings.component.pug` Notifications panel: checkboxes for `stealFocusOnAdd` / `notifyOnChange`.
- [ ] In `settings.component.pug` Shell panel: text input for `shell`, textarea for `shellArgs` (newline-separated; serialize via `value.split(/\r?\n/).filter(s=>s.length>0)`), select for `encoding` (`'encoded'` / `'command'`), text inputs for `rootColor` / `paneColor` (hex placeholder).
- [ ] Create `src/components/settings.component.scss` with minimal styling for accordion panels (panel padding, hint text color).
- [ ] In `settings.component.ts`, implement an `onBlur` handler for numeric fields that clamps the value to the documented range from [slice §3 decision 8](../slices/profile-and-settings.md).
- [ ] Create `tests/settings.component.test.ts` with cases: (a) component instantiates with `DEFAULT_PROFILE_OPTIONS` bound, (b) clamping numeric field below min snaps to min on blur, (c) clamping numeric field above max snaps to max on blur, (d) `shellArgs` textarea serialization splits on newlines and drops empty lines, (e) `shellArgs` round-trip (array → textarea string → array) is identity.

## Acceptance criteria
- [ ] `npm test -- --grep settings.component` exits 0 with at least 5 passing cases.
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `grep -nE 'export class AgentFleetProfileSettingsComponent' src/components/settings.component.ts` matches one line.
- [ ] `grep -cE 'ngb-panel|ngbPanelHeader' src/components/settings.component.pug` is at least 7 (one per section).
- [ ] `grep -cE '\(ngModel\)' src/components/settings.component.pug` is at least 27 (one per field).

> If a `## Tasks` checkbox can't be completed without changing what the parent slice specifies, stop and update the slice. Do not redesign here.
