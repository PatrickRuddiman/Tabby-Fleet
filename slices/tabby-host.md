Parent spec: [tabby-fleet specification](../spec.md)

# tabby-fleet — tabby-host

## §1 Summary

The integration boundary between the plugin and Tabby's host application: registering the `agent-fleet` profile type, opening the fleet's SplitTabComponent, populating it with the root pane plus N worktree panes at launch, wiring focus events for auto-zoom (consumed by the `layout-engine` slice), and persisting fleet metadata across Tabby restart via Tabby's recovery system. This slice owns *only* the host-API plumbing; the watcher, layout math, and per-pane lifecycle live in other slices.

## §2 Codebase reconnaissance

Local repo: greenfield. The plugin tree under `C:\Users\prudd\source\repos\tabby-ai-worktree\src\` does not yet exist; this slice will create the files it names.

Tabby host (the system being integrated with, source on https://github.com/Eugeny/tabby):

- `tabby-core/src/components/splitTab.component.ts` — `SplitTabComponent.addTab(tab: BaseTabComponent|null, relative: BaseTabComponent|null, side: 't'|'r'|'b'|'l'): Promise<void>`; `removeTab(tab)`; `layout(): void` (sync); `focusChanged$: Observable<BaseTabComponent>` (pane-within-split focus); `initialized$` emitted in `ngAfterViewInit()` before child panes are visible; `getAllTabs()`, `getFocusedTab()`, `getParentOf(tab, root?)`. Inner `SplitContainer` has `orientation: 'h'|'v'`, `children: (BaseTabComponent|SplitContainer)[]`, `ratios: number[]` summing to 1.
- `tabby-core/src/api/profileProvider.ts` — abstract `ProfileProvider<P extends Profile>` with `id`, `name`, `configDefaults`, `getBuiltinProfiles()`, `getNewTabParameters(profile): Promise<NewTabParameters<BaseTabComponent>>`, `getDescription(profile)`. Registered as `{ provide: ProfileProvider, useClass: ..., multi: true }`.
- `tabby-core/src/services/profiles.service.ts` — `ProfilesService.openNewTabForProfile(profile)` calls `newTabParametersForProfile()` then delegates to `AppService.openNewTab(params)`. Does not instantiate SplitTabComponent itself.
- `tabby-core/src/services/app.service.ts` — `AppService.openNewTab<T>(params: NewTabParameters<T>): T` is the canonical entry; wraps non-SplitTabComponent tabs in SplitTabComponent automatically. For our case `params.type = SplitTabComponent` directly.
- `tabby-core/src/services/tabRecovery.service.ts` — `TabRecoveryProvider` interface: `applicableTo(token): Promise<boolean>`, `recover(token): Promise<NewTabParameters<T>|null>`. Tokens serialized to `localStorage.tabsRecovery`. `BaseTabComponent.getRecoveryToken(opts?): Promise<RecoveryToken|null>` is overridable per tab.
- `tabby-ssh/src/index.ts` and `tabby-local/src/profiles.ts` — reference ProfileProvider implementations to follow for `agent-fleet` registration.
- Stock terminal pane component used by Tabby's local-terminal profile (under `tabby-local/`) — the pane type each fleet pane will be instantiated as.

## §3 Decisions

1. **Pane population timing.** Options: (A) subscribe to `splitTab.initialized$` and call `addTab` per pane before view renders; (B) construct a pre-built recovery token containing the whole tree and let `ngAfterViewInit` recover it; (C) global `tabsChanged$` listener. **Chosen:** A. Rationale: `initialized$` is the recon's designed-for-this-purpose hook; no token-construction logic to reproduce `addTab`'s internal ratio handling; deterministic order of operations.

2. **Metadata persistence across Tabby restart.** Options: (A) implement `TabRecoveryProvider` that serializes fleet structure + per-pane commands into a recovery token; (B) ConfigService keyed by per-tab UUID; (C) hybrid (recovery token for persistent structure, ConfigService for runtime-only). **Chosen:** A. Rationale: `BaseTabComponent` has no `extras` field per the recon; the recovery-token round-trip is Tabby's idiomatic persistence path and integrates with the existing `recoverTabs()` flow.

3. **Pane addition mechanism.** Options: (A) sequential `addTab` calls; (B) direct mutation of `SplitContainer.children` and `ratios`; (C) mixed (addTab for first, mutate for rest). **Chosen:** A. Rationale: `addTab` handles parent-pointer registration, tab-list bookkeeping, and initial ratio adjustment per the recon; bypassing it risks inconsistent internal state.

4. **Ratio writes.** Options: (A) single post-build pass to overwrite ratios to baseline, then per-`focusChanged$` recompute; (B) recompute after every `addTab`; (C) requestAnimationFrame interpolation loop. **Chosen:** A. Rationale: two well-defined write moments (initial build done, focus changed); `layout()` is sync so re-rendering is cheap; CSS transition (set by `layout-engine` slice) handles the animation without a JS-driven loop.

5. **Per-fleet subscription ownership.** Options: (A) `FleetRegistry` singleton holding a `Map<fleetTabId → FleetController>` with the focus + watcher subscriptions; (B) subclass SplitTabComponent; (C) inline in ProfileProvider. **Chosen:** A. Rationale: two named callsites — focus subscription (this slice) and worktree-watcher subscription (`fleet-lifecycle` slice) — meet the "shared utility needs two callsites" bar; one owner for teardown on tab close.

6. **Pane component for each fleet pane.** Options: (A) stock terminal pane from Tabby's local-terminal profile; (B) subclass it; (C) custom from scratch. **Chosen:** A. Rationale: the pane *is* a terminal running a shell command; no fleet-specific behavior belongs in the pane component itself; dead-pane overlay (spec §2 "Restart and persistence") is a layered concern owned by `fleet-lifecycle`.

## §4 Contracts & shapes

**Plugin module registration** (`src/index.ts`):
- Default-exported NgModule imports `TabbyCoreModule`, `TabbyTerminalModule`.
- Providers: `{ provide: ProfileProvider, useClass: AgentFleetProfileProvider, multi: true }`, `{ provide: TabRecoveryProvider, useClass: AgentFleetRecoveryProvider, multi: true }`, `FleetRegistry` (root-injectable).

**`AgentFleetProfileProvider`** (`src/providers/profile.provider.ts`):
- `id = 'agent-fleet'`.
- `name = 'Agent Fleet'`.
- `configDefaults.options` populated from the defaults table in `plan.md` Appendix C.
- `getBuiltinProfiles()`: returns one suggested profile pre-pointed at "current working directory" (empty `repoPath`).
- `getDescription(profile)`: returns `${profile.options.repoPath || '(current directory)'}` so the profile list shows where each fleet anchors.
- `getNewTabParameters(profile)`: returns `{ type: SplitTabComponent, inputs: { fleetProfile: profile } }`. The `fleetProfile` input is the trigger — see §5.

**`AgentFleetRecoveryProvider`** (`src/providers/recovery.provider.ts`):
- `applicableTo(token)`: returns true iff `token.type === 'agent-fleet'`.
- `recover(token)`: returns `{ type: SplitTabComponent, inputs: { fleetProfile: token.profile, recoveredPanes: token.panes } }`. The `recoveredPanes` input is the dead-pane manifest consumed by `fleet-lifecycle`.

**Recovery token shape** (written by overriding `getRecoveryToken` on the fleet's SplitTabComponent via FleetRegistry):
- `type: 'agent-fleet'`
- `profileId: string`
- `profile: AgentFleetProfileOptions` (the snapshot at launch, so a later profile edit doesn't break the restore)
- `panes: Array<{ role: 'root' | 'worktree'; worktreePath: string; branch: string | null; command: string; title: string; color: string | null }>`
- `tabTitle: string`, `tabColor: string | null` (standard Tabby recovery token fields)

**`FleetRegistry`** (`src/services/fleet.registry.ts`, root-injectable):
- `register(tab: SplitTabComponent, profile: AgentFleetProfileOptions, recoveredPanes?: ...): FleetController` — call site: `AgentFleetProfileProvider`'s post-construction hook.
- `get(tab): FleetController | null` — lookup for slices that need to read fleet state.
- `unregister(tab): void` — called on `tab.destroyed$`.
- Internal `Map<SplitTabComponent, FleetController>`.

**`FleetController`** (returned by `FleetRegistry.register`):
- Holds the `Subscription` for `splitTab.focusChanged$`, the (future) watcher subscription, the `userDismissed` set, and the active pane↔worktree map.
- Exposes `onFocusChange(focused: BaseTabComponent)` — invoked by the focus subscription; delegates to `LayoutService.computeLayoutWeights` (`layout-engine` slice) and writes ratios via `applyRatios()`.
- Exposes `applyRatios(weights: LayoutWeights[])` — single ratio-write entry point. Walks `splitTab.getAllTabs()`, finds each pane's container via `splitTab.getParentOf`, mutates `container.ratios`, calls `splitTab.layout()` once.
- Exposes `addPaneForWorktree(wt)` and `removePaneForWorktree(path)` — used by the `fleet-lifecycle` slice's watcher event handler.

**Failure modes (host-API specific):**
- `splitTab.initialized$` does not fire (Tabby version mismatch): plugin surfaces a NotificationsService error and the empty SplitTabComponent stays open; user can close it manually. No partial state.
- `addTab` rejects (e.g., relative tab no longer parented): controller aborts the launch with a NotificationsService error and closes the half-built tab.
- Recovery token's `panes` references a worktree path no longer on disk: the pane is still recovered with its dead-pane overlay; the command will fail at relaunch, which is the same path as any other dead pane.
- Two fleet tabs open simultaneously for the same repo (spec §2 failure mode): FleetRegistry keys by SplitTabComponent reference, not by repo path, so both register independently.

## §5 Sequence

**Initial launch from profile**

1. User triggers `Open profile → Agent Fleet (...)` in Tabby's profile UI.
2. `ProfilesService.openNewTabForProfile(profile)` calls `AgentFleetProfileProvider.getNewTabParameters(profile)` → returns `{ type: SplitTabComponent, inputs: { fleetProfile: profile } }`.
3. `AppService.openNewTab(params)` instantiates `SplitTabComponent` via `TabsService.create()`, applies the `fleetProfile` input via `Object.assign(instance, params.inputs)`.
4. SplitTabComponent's `ngAfterViewInit` runs, emits `initialized$`.
5. `AgentFleetProfileProvider` (or a small bridge service hooked at step 3 via Angular DI) subscribes to `splitTab.initialized$`, sees `fleetProfile` is present, calls `FleetRegistry.register(splitTab, fleetProfile)`. Registration:
   a. Resolves the repo path (config value or current working directory).
   b. Runs `git -C <repo> worktree list --porcelain` (delegated to the `worktree-data` slice).
   c. Filters and sorts the worktree list per spec §3 In.
   d. Constructs the root pane `NewTabParameters` (stock terminal type, inputs include shell program/args and rendered root command + cwd = repo root).
   e. Calls `splitTab.addTab(rootPane, null, 'r')`.
   f. For each worktree, constructs the pane's `NewTabParameters` and calls `splitTab.addTab(wtPane, previousPane, 'r' for first / 'b' for subsequent)`. First worktree goes to the right of root; subsequent worktrees go below the previous one, building the vertical right column.
   g. After the last `addTab` resolves, calls `controller.applyRatios(baselineWeights)` — overwrites the root SplitContainer's ratios to `[0.5, 0.5]` and the nested vertical container's ratios to `[1/N, 1/N, ...]`.
6. Controller subscribes to `splitTab.focusChanged$`. Each emission triggers `controller.onFocusChange(focused)` → `LayoutService.computeLayoutWeights` → `controller.applyRatios(zoomedWeights)`.
7. Controller subscribes to `splitTab.destroyed$` (or `tabRemoved$` at the AppService level for this specific tab) and on emission calls `FleetRegistry.unregister(splitTab)`, tearing down all subscriptions.

**Recovery on Tabby restart**

1. Tabby's `TabRecoveryService` reads `localStorage.tabsRecovery`, iterates tokens.
2. For each token, calls every registered `TabRecoveryProvider.applicableTo(token)`; `AgentFleetRecoveryProvider` returns true for tokens with `type === 'agent-fleet'`.
3. `AgentFleetRecoveryProvider.recover(token)` returns `{ type: SplitTabComponent, inputs: { fleetProfile: token.profile, recoveredPanes: token.panes } }`.
4. Same flow as initial launch from step 4, except step 5d–f uses `recoveredPanes` to reconstruct panes in their stored shape rather than re-running `git worktree list`. The panes are dead (no command running) — the dead-pane overlay (`fleet-lifecycle` slice) attaches to each.

**Recovery token write**

1. FleetController overrides `splitTab.getRecoveryToken` via a method assignment in `register()` (no subclassing; just `splitTab.getRecoveryToken = () => controller.serialize()`).
2. `controller.serialize()` walks the current pane↔worktree map, snapshots role/path/branch/command/title/color per pane, and returns the token shape from §4.
3. Tabby's `TabRecoveryService.saveTabs()` calls this on save; the token lands in localStorage.

## §6 Out of scope

- Worktree enumeration, filter rules, sort order, and template-variable mapping → `worktree-data` slice.
- Template rendering and PowerShell encoding for the per-pane commands → `shell-launcher` slice.
- Filesystem watch / poll / debounce → `fs-watcher` slice.
- Baseline ratio math and zoom math (the *values* in the ratios arrays) → `layout-engine` slice. This slice owns *writing* ratios; it does not compute them.
- CSS transition wiring on pane host elements → `layout-engine` slice.
- Watcher event handler (diff against current panes, addPaneForWorktree / removePaneForWorktree calls) → `fleet-lifecycle` slice.
- userDismissed set semantics, root-close confirmation modal, dead-pane overlay rendering → `fleet-lifecycle` slice.
- Settings tab UI surfacing the 27 configurable options → `profile-and-settings` slice.
- npm packaging, build pipeline, distribution → `plugin-scaffold` and `packaging-ci-docs` slices.

## §7 Open questions

- The plugin needs to attach a callback to `splitTab.initialized$` after `getNewTabParameters` has returned but before pane construction completes. Two candidates: (a) wrap the `inputs.fleetProfile` setter on the SplitTabComponent instance so the subscription is established the moment Angular assigns inputs, or (b) inject a `FleetBootstrapService` that listens to `AppService.tabsChanged$` and subscribes when a fleet tab appears. The recon doesn't pin down which is idiomatic. Resolve before implementation by reading how `tabby-local` plugin handles per-tab setup.
- Stock terminal pane component name and exact `NewTabParameters` shape (inputs for shell program, args, cwd, environment) is not yet identified by file path. Confirm during implementation by inspecting `tabby-local/src/profiles.ts` and the local-terminal pane component it points at.
- The recovery token's `tabTitle` and `tabColor` are required by Tabby's recovery contract per the recon, but their precise effect on the restored SplitTabComponent (vs. per-pane titles) is unverified. May need adjustment after the first round-trip test.

> If the parent spec is ambiguous on anything this slice depends on, stop and update the spec. Do not invent behavior here.
