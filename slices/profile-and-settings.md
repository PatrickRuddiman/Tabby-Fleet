Parent spec: [tabby-fleet specification](../spec.md)

# tabby-fleet — profile-and-settings

## §1 Summary

Defines the `AgentFleetProfileOptions` interface (the contract every other slice reads from), the per-profile editor component shown inside Tabby's standard profile editor for `agent-fleet` profiles, the global-defaults settings tab, and the default-values seeding for new profiles. Owns the surface where the developer configures all 27 behaviors enumerated in spec §3 In.

## §2 Codebase reconnaissance

Local repo: greenfield. No prior profile/settings code exists at `C:\Users\prudd\source\repos\tabby-ai-worktree\src\providers\` or `src\components\`; this slice creates the files.

Tabby host:
- `tabby-core/src/api/profileProvider.ts` — abstract `ProfileProvider<P>` with `settingsComponent?: new (...args) => ProfileSettingsComponent<P, ProfileProvider<P>>` and `configDefaults: Pick<Profile, 'options'>`. Recon for [`tabby-host`](tabby-host.md) cited this verbatim.
- `tabby-settings/src/api.ts` — `SettingsTabProvider` interface: `id: string`, `title: string`, `iconClass?: string`, `getComponentType(): any`. Implementations register as `{ provide: SettingsTabProvider, useClass: AgentFleetDefaultsTabProvider, multi: true }`.
- `tabby-settings/src/components/profileSettings.component.pug` — the per-profile editor mounts a child component class supplied by the ProfileProvider; inputs are `profile: PartialProfile<P>` and `connectableTwoWay()` change emitters.
- `tabby-core/src/services/config.service.ts` — `ConfigService.store` is the persisted-config root; per-plugin defaults read via `config.store.fleet?.defaults` (keyed by plugin id). `config.save()` persists.

Sibling-slice contracts already settled:
- [`tabby-host`](tabby-host.md) §4 instantiates `AgentFleetProfileProvider` and reads `profile.options` of type `AgentFleetProfileOptions`.
- [`worktree-data`](worktree-data.md) §4 reads `worktreePathPrefix`, `includeDetached`, `includePrunable`, `includeLocked`.
- [`shell-launcher`](shell-launcher.md) §4 reads `commandTemplate`, `rootCommandTemplate`, `paneTitlePattern`, `rootTitle`, `shell`, `shellArgs`, `encoding`.
- [`layout-engine`](layout-engine.md) §4 reads `layoutMode`, `zoomFactor`, `minPaneWidth`, `minPaneHeight`, `zoomTransitionMs`.
- [`fs-watcher`](fs-watcher.md) §4 reads `watchMode`, `pollIntervalMs`.
- [`fleet-lifecycle`](fleet-lifecycle.md) §4 reads `repoPath`, `preSpawnCommand`, `autoOpenNew`, `autoCloseRemoved`, `stealFocusOnAdd`, `notifyOnChange`, `spawnMode`, `rootColor`, `paneColor`.

## §3 Decisions

1. **`AgentFleetProfileOptions` shape.** Options considered: one flat interface, nested by concern (`filters`, `templates`, `layout`, `watch`, `notifications`), separate root vs worktree command groups. **Chosen:** one flat interface with all 27 fields named per [`plan.md`](../plan.md) Appendix C. Rationale: matches Tabby's existing profile-options convention (`tabby-ssh`'s `SSHProfileOptions` is also flat); flat shape simplifies the `Pick<Profile, 'options'>` defaults declaration; flat shape is what every sibling slice already reads.

2. **Defaults seeding.** Options considered: hardcode in `AgentFleetProfileProvider.configDefaults`, read from `ConfigService.store` per-tenant, both. **Chosen:** hardcode in `configDefaults`, with the global-defaults settings tab letting the developer override at the `ConfigService.store.fleet.defaults` key. New profiles inherit from `configDefaults` if the store is empty, from `store.fleet.defaults` otherwise. Rationale: matches plan.md Appendix C; out-of-the-box behavior is correct without any user setup; global override is the second layer.

3. **Per-profile editor component.** Options considered: single tabbed editor, accordion sections, flat scrolling form. **Chosen:** accordion sections (using ng-bootstrap's `NgbAccordion`, already a Tabby dependency via the modal subsystem [`fleet-lifecycle`](fleet-lifecycle.md) uses). Sections: "Repo", "Templates", "Filters", "Layout", "Watcher", "Notifications", "Shell". Rationale: 27 settings overflow a single visible form; accordion is the lowest-friction way to group without forcing tab navigation.

4. **Global defaults tab.** Options considered: one settings tab that mirrors the per-profile editor 1:1, separate tabs per concern. **Chosen:** one settings tab that mirrors the per-profile editor 1:1 using the same component. Rationale: zero duplication; the same form bound to `ConfigService.store.fleet.defaults` instead of `profile.options`.

5. **Spec §5 open question — live profile edits.** Spec leaves "does an edit apply live or require relaunch" unresolved. This slice MUST surface the same enum-shape; the *application* of changes is owned by [`fleet-lifecycle`](fleet-lifecycle.md) (which decides whether to subscribe to `ConfigService.changed$`). **Chosen for this slice:** persist via `config.save()` immediately on form change; downstream slices see the new value on next read. Whether running fleets pick it up live is their concern. Slice §7 flags the dependency.

6. **Template-variable hint UI.** Options considered: inline tooltip on each template field, separate "Template variables" reference panel, none. **Chosen:** inline `<small>` hint under each template field listing the 9 available variables (per spec §3 In template variable list). Rationale: the developer is most likely to forget the variable list while typing a template; visible reference reduces support requests.

7. **Color picker mechanism.** Options considered: text input expecting hex, native HTML5 color input, ng-bootstrap color picker. **Chosen:** text input expecting hex with a placeholder example. Rationale: matches how `tabby-ssh` accepts the `color` option (text); the native color input adds chrome that doesn't render consistently inside Tabby's themes; spec only requires "optional color tag".

8. **Validation surface.** Options considered: live validation with error messages, validation on save only, no validation. **Chosen:** minimal live validation on numeric fields (zoom factor, min pane dims, transition duration, poll interval) — clamp to allowed ranges with a hint. No regex validation on templates or commands (the user owns those, and runtime feedback is in the pane). Rationale: spec doesn't require error UI; numeric clamps protect downstream slices from negative/zero values that would break ratio math.

## §4 Contracts & shapes

**File:** `src/api.ts` (shared types — already declared in plan.md's file tree).
- Interface `AgentFleetProfileOptions` — 27 fields per plan.md Appendix C:
  - `repoPath: string`
  - `worktreePathPrefix: string`
  - `includeDetached: boolean`
  - `includePrunable: boolean`
  - `includeLocked: boolean`
  - `rootCommandTemplate: string`
  - `rootTitle: string`
  - `commandTemplate: string`
  - `paneTitlePattern: string`
  - `rootColor: string | null`
  - `paneColor: string | null`
  - `layoutMode: 'grid' | 'static-grid'`
  - `zoomFactor: number`
  - `minPaneWidth: number`
  - `minPaneHeight: number`
  - `zoomTransitionMs: number`
  - `watchMode: 'fs' | 'poll' | 'off'`
  - `pollIntervalMs: number`
  - `autoOpenNew: boolean`
  - `autoCloseRemoved: boolean`
  - `stealFocusOnAdd: boolean`
  - `notifyOnChange: boolean`
  - `spawnMode: 'eager' | 'lazy'`
  - `preSpawnCommand: string`
  - `shell: string`
  - `shellArgs: string[]`
  - `encoding: 'encoded' | 'command'`
- Re-exports `FleetPaneMetadata` (defined by [`tabby-host`](tabby-host.md) Appendix B, mirrored here for convenience).

**File:** `src/providers/profile.provider.ts`.
- Class `AgentFleetProfileProvider extends ProfileProvider<Profile<AgentFleetProfileOptions>>`.
- `id = 'agent-fleet'`.
- `name = 'Agent Fleet'`.
- `configDefaults = { options: { /* all 27 defaults from plan.md Appendix C */ } }`.
- `settingsComponent = AgentFleetProfileSettingsComponent`.
- `getNewTabParameters(profile)`: per [`tabby-host`](tabby-host.md) §4, returns `{ type: SplitTabComponent, inputs: { fleetProfile: profile.options } }`.
- `getBuiltinProfiles()`: returns one suggested profile `{ name: 'Agent Fleet (current dir)', options: configDefaults.options }`.
- `getDescription(profile)`: returns `profile.options.repoPath || '(current directory)'`.

**File:** `src/providers/settings.provider.ts`.
- Class `AgentFleetDefaultsTabProvider implements SettingsTabProvider`.
- `id = 'agent-fleet-defaults'`.
- `title = 'Agent Fleet defaults'`.
- `iconClass = 'fas fa-layer-group'`.
- `getComponentType()`: returns `AgentFleetDefaultsTabComponent` (a thin wrapper around `AgentFleetProfileSettingsComponent` that binds to `ConfigService.store.fleet.defaults` instead of a profile).

**File:** `src/components/settings.component.ts` + `.pug` + `.scss`.
- Class `AgentFleetProfileSettingsComponent implements ProfileSettingsComponent<AgentFleetProfileOptions, AgentFleetProfileProvider>`.
- Input: `profile: PartialProfile<Profile<AgentFleetProfileOptions>>`.
- Template: NgbAccordion with seven sections (Repo, Templates, Filters, Layout, Watcher, Notifications, Shell). Each section's fields bound two-way to `profile.options.<field>`.
- Section "Repo": `repoPath` (text input, placeholder "leave empty for current directory"), `preSpawnCommand` (text input).
- Section "Templates": `rootCommandTemplate`, `rootTitle`, `commandTemplate`, `paneTitlePattern` (each a text input with an inline hint listing the 9 template variables).
- Section "Filters": `worktreePathPrefix` (text input), `includeDetached` / `includePrunable` / `includeLocked` (checkboxes).
- Section "Layout": `layoutMode` (select: `grid` | `static-grid`), `zoomFactor` (number, clamped 1.0–4.0), `minPaneWidth` / `minPaneHeight` (number, clamped 40+), `zoomTransitionMs` (number, clamped 0–1000).
- Section "Watcher": `watchMode` (select: `fs` | `poll` | `off`), `pollIntervalMs` (number, clamped 500–60000), `autoOpenNew` / `autoCloseRemoved` (checkboxes).
- Section "Notifications": `stealFocusOnAdd` / `notifyOnChange` (checkboxes).
- Section "Shell": `shell` (text), `shellArgs` (textarea, one arg per line; serialized as `string[]`), `encoding` (select: `encoded` | `command`), `rootColor` / `paneColor` (text inputs with hex placeholder).

**File:** `src/components/defaults-tab.component.ts` + `.pug`.
- Class `AgentFleetDefaultsTabComponent`.
- On init: reads `ConfigService.store.fleet?.defaults ?? {}`; merges over plan.md Appendix C; binds the same `AgentFleetProfileSettingsComponent` form to that object.
- On change: writes `ConfigService.store.fleet.defaults = options; await this.config.save()`.

**NgModule registration** (extending [`tabby-host`](tabby-host.md) §4):
- `{ provide: ProfileProvider, useClass: AgentFleetProfileProvider, multi: true }`.
- `{ provide: SettingsTabProvider, useClass: AgentFleetDefaultsTabProvider, multi: true }`.
- Declarations: `AgentFleetProfileSettingsComponent`, `AgentFleetDefaultsTabComponent`.
- Imports: `NgbAccordionModule` (already a Tabby dep).

**Failure modes specific to this slice:**
- `shellArgs` parsing: textarea split by newlines, trimmed, empty lines dropped. Sole edge case: a user pasting Windows CRLF — handled by `split(/\r?\n/)`.
- Numeric clamps applied on blur; values outside the clamp range silently snap to the nearest bound.
- The `repoPath` is not validated client-side (the actual git-repo check happens at launch in [`fleet-lifecycle`](fleet-lifecycle.md) §5).
- Color fields accept any string; an invalid hex renders nothing in the pane (Tabby's color application is forgiving — no error UI here).

## §5 Sequence

**Profile creation:**
1. Developer opens Tabby's profile editor and selects "New profile" → "Agent Fleet".
2. `ProfilesService` calls `AgentFleetProfileProvider.configDefaults` → seeds `profile.options` with the 27 defaults from plan.md Appendix C.
3. If `ConfigService.store.fleet.defaults` is present, it overrides field-by-field after `configDefaults` (developer-set defaults win over hardcoded defaults).
4. Tabby renders `AgentFleetProfileSettingsComponent` with the seeded `profile.options`.
5. Developer edits fields; each change writes back to `profile.options.<field>` via two-way binding.
6. Tabby's profile editor calls `config.save()` when the developer clicks Save.

**Global defaults edit:**
1. Developer opens Tabby's settings → "Agent Fleet defaults" tab.
2. `AgentFleetDefaultsTabComponent` reads `ConfigService.store.fleet?.defaults` merged over Appendix C.
3. Same `AgentFleetProfileSettingsComponent` form renders; bound to the local object.
4. On any field change: `ConfigService.store.fleet.defaults = options; await this.config.save()`.
5. Future "New profile" actions use the saved defaults as the seed.

**Profile read (every fleet launch):**
1. [`fleet-lifecycle`](fleet-lifecycle.md) §5 step 1 receives `profile.options` from `getNewTabParameters`.
2. The 27 fields propagate into the FleetController's per-fleet snapshot, and downstream slices read them via that snapshot (not via ConfigService directly — see §6 below).

**Profile delete:**
1. Developer triggers delete in Tabby's profile editor.
2. Tabby calls `ProfileProvider.deleteProfile(profile)` (default no-op inherited from base class).
3. No fleet-specific cleanup required at delete time; any running fleet from that profile keeps its snapshot.

## §6 Out of scope

- Reading config at fleet runtime — owned by [`fleet-lifecycle`](fleet-lifecycle.md), which snapshots `profile.options` at launch.
- Live re-application of edited settings to running fleets — open question in spec §5; if resolved to "apply live", [`fleet-lifecycle`](fleet-lifecycle.md) §3 decision 4 adds the `ConfigService.changed$` subscription. This slice surfaces the settings but does not push them anywhere.
- Validating that `repoPath` points to a real git repo — done at launch in [`fleet-lifecycle`](fleet-lifecycle.md) §5.
- The settings tab's icon SVG — using the existing Font Awesome class `fa-layer-group` already bundled with Tabby; no new asset.
- Hotkey provider — spec §3 Out defers; the file `src/providers/hotkey.provider.ts` is a stub for v0.2.
- Per-profile context-menu actions on panes — spec §3 Out.

## §7 Open questions

- Spec §5: live-edit behavior for the four fields callable out as "live-applicable candidates" (color, min pane dims, layout mode, transition duration). The settings form already writes immediately to `config.save()`; whether the running fleet re-reads them is the dependency. Resolve in spec, then update [`fleet-lifecycle`](fleet-lifecycle.md) accordingly.
- The exact `NgbAccordion` API (Tabby's dependency version of ng-bootstrap pins the accordion class; pre-v15 used `NgbAccordionModule` with `<ngb-accordion>`; v15+ moved to `NgbAccordionDirective`). Resolve during implementation by checking Tabby's `package.json` dep version.
- `shellArgs` serialization: one arg per line is unambiguous for simple strings but fragile for args containing embedded newlines. v0.1 documents the constraint; v0.2 may offer a structured array editor.

> If the parent spec is ambiguous on anything this slice depends on, stop and update the spec. Do not invent behavior here.
