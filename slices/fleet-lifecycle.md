Parent spec: [tabby-fleet specification](../spec.md)

# tabby-fleet — fleet-lifecycle

## §1 Summary

Owns the per-fleet runtime behavior: launch sequencing (repo resolution, pre-launch command, initial enumeration), the watcher event handler (diff against current panes, add/remove, focus preservation), the `userDismissed` set, root-pane close confirmation, the dead-pane overlay attached to recovered panes, the one-time watch-mode notice, and per-pane add/remove notifications. All lifecycle methods extend the per-tab `FleetController` defined by [`tabby-host`](tabby-host.md).

## §2 Codebase reconnaissance

Local repo: greenfield. No prior lifecycle module exists at `C:\Users\prudd\source\repos\tabby-ai-worktree\src\services\`; this slice extends `FleetController` and adds two small components.

Tabby host:
- `tabby-core/src/services/notifications.service.ts` — `NotificationsService.info(text, details?)`, `error(text, details?)`, `notice(text)`. Plain-string API.
- `tabby-core/src/components/baseTab.component.ts` — `canClose(): Promise<boolean>` overridable per tab; returning `false` aborts close. `destroyed$: Observable<void>` fires on tear-down.
- `@ng-bootstrap/ng-bootstrap` — `NgbModal.open(ComponentClass)` returns a modal ref; `modal.componentInstance.<input> = value`; `modal.result.then(...).catch(...)`. The convention used by `AppService.renameTab` (`tabby-core/src/services/app.service.ts`).
- `tabby-electron/src/services/electron.service.ts` — `ElectronService.dialog.showOpenDialog({ properties: ['openDirectory'] })` returns `Promise<{ canceled: boolean; filePaths: string[] }>`.
- `tabby-terminal/src/session.ts` — `BaseSession.closed$: Observable<void>` fires when the underlying PTY exits.
- `tabby-core/src/components/splitTab.component.ts` — `addTab(tab, relative, side)` auto-focuses the new tab inside an `onAfterTabAdded()` microtask. `focus(tab)` programmatically restores.
- Plugin convention for instantiating components imperatively: `ComponentFactoryResolver.resolveComponentFactory(...).create(injector)`; append `componentRef.location.nativeElement` to a target DOM element.

Contracts from sibling slices already settled:
- `FleetController.register / addPaneForWorktree / removePaneForWorktree / applyRatios` — defined by [`tabby-host`](tabby-host.md) §4.
- `computeLayoutWeights` — pure function defined by [`layout-engine`](layout-engine.md) §4. This slice calls `FleetController.applyRatios` after any structural change.
- Recovery-token shape — defined by [`tabby-host`](tabby-host.md) §4. Recovered panes carry a `recovered: true` flag set by `AgentFleetRecoveryProvider.recover()`.

## §3 Decisions

1. **Where lifecycle logic lives.** Options considered: extend `FleetController`, separate `FleetLifecycleService` singleton, per-concern handler classes. **Chosen:** extend `FleetController`. Rationale: tabby-host already establishes one owner per fleet tab; lifecycle methods on the same class keep tear-down on one path and avoid a second service that just delegates.

2. **Pre-launch command execution.** Options considered: Node `child_process.exec`, Tabby PTY for visibility, template-rendered exec. **Chosen:** Node `child_process.exec` with `cwd: repoPath` and a 30-second timeout. Rationale: simplest API that captures stdout / stderr / exit code; no UI surface needed because the launch blocks; template support for the pre-launch command is not in spec §3 In.

3. **Notification batching.** Options considered: one toast per pane, summary toast for N ≥ 2, configurable threshold. **Chosen:** one toast per pane. Rationale: spec §4 phrases the requirement per-event; toast library stacks; per-pane visibility outweighs noise from rare large bursts.

4. **Root-close confirmation modal.** Options considered: custom NgbModal component, native browser `confirm()`, prevent root close without a prompt. **Chosen:** custom NgbModal component (`ConfirmFleetCloseModalComponent`). Rationale: matches Tabby's existing modal convention (`RenameTabModalComponent` pattern); themed by Tabby's stylesheet; `canClose()` returning a promise integrates cleanly.

5. **Dead-pane overlay.** Options considered: Angular component appended via ComponentFactoryResolver, subclassed terminal tab, vanilla DOM div. **Chosen:** Angular component (`FleetDeadPaneOverlayComponent`) instantiated via ComponentFactoryResolver, appended to the pane's root DOM element. Rationale: keeps the pane component the stock terminal tab (tabby-host slice decision); Angular templating reuses Tabby's themes/buttons; component-scoped CSS isolates the overlay from the pane content.

6. **Dead-pane overlay trigger.** Options considered: on `session.closed$`, on a `recovered: true` flag from the recovery token, both. **Chosen:** `recovered: true` flag only. Rationale: spec §2 failure mode "A pane's command exits on its own — the pane remains open showing the shell prompt; the system does not close panes in response to command exit" — the overlay is restart-specific. Once the user clicks "Relaunch", the flag is cleared on the pane's controller entry and the overlay is removed.

7. **Watch-mode indicator presentation.** Options considered: NotificationsService.notice once at launch, per-tab color/icon override, both. **Chosen:** `NotificationsService.notice` once at launch only. Rationale: spec §2 says "one-time user-visible notice"; persistent visual would conflict with the user-configurable `rootColor`/`paneColor`.

8. **Focus preservation on pane-add (spec setting `stealFocusOnAdd: false`).** Options considered: parameter to `addTab` (none exists per recon), post-addTab refocus, accept the focus theft. **Chosen:** post-addTab refocus. Rationale: capture `splitTab.getFocusedTab()` before `addTab`; after `addTab` resolves, call `splitTab.focus(captured)`. Recon explicitly documents this as the only available workaround.

## §4 Contracts & shapes

**File additions (extending tabby-host's controller):**
- `src/services/fleet.controller.ts` — augments the class defined by tabby-host with the methods listed below. Single class, single file.
- `src/components/confirm-fleet-close-modal.component.ts` / `.pug` / `.scss` — NgbModal content for root-close confirmation.
- `src/components/fleet-dead-pane-overlay.component.ts` / `.pug` / `.scss` — overlay rendered on recovered panes.

**`FleetController` methods owned by this slice (in addition to those in tabby-host §4):**
- `launch(): Promise<void>` — orchestrates spec §2 "Fleet launch" stories end-to-end (see §5).
- `onWatcherChange(currentWorktrees: Worktree[]): Promise<void>` — called by [`fs-watcher`](fs-watcher.md)'s `onChange` after re-listing. Performs the diff, calls `addPaneForWorktree` / `removePaneForWorktree`, fires notifications, calls `applyRatios`.
- `dismissPane(worktreePath: string): void` — invoked when the user manually closes a worktree pane. Adds path to `userDismissed`; calls `removePaneForWorktree` (which detaches the pane from the SplitTabComponent without removing the worktree on disk).
- `confirmRootClose(): Promise<boolean>` — overrides the root pane's `canClose()`. Opens `ConfirmFleetCloseModalComponent`; resolves `true` on confirm (which then cascades close of the whole fleet tab via `splitTab.close()`), `false` on cancel.
- `relaunchPane(paneId: string): Promise<void>` — invoked by the dead-pane overlay's button. Re-runs the pane's stored command via the same mechanism tabby-host uses at launch; clears `recovered: true` on the pane's entry; destroys the overlay component.

**`FleetController` state owned by this slice (in addition to tabby-host state):**
- `userDismissed: Set<string>` — absolute worktree paths the developer manually closed in this fleet tab. Cleared only when the tab is destroyed.
- `paneRegistry: Map<paneId, { worktreePath, role, command, title, color, recovered, overlayRef? }>` — extends tabby-host's pane↔worktree map with the recovered flag and the optional overlay ComponentRef.
- `pendingPreLaunchPromise: Promise<void> | null` — set while the pre-launch command runs; awaited by `launch()` before adding any pane.

**`ConfirmFleetCloseModalComponent` shape:**
- Inputs: `repoName: string` (from `profile.repoPath` final path component, for display).
- Methods: `confirm()` → `NgbActiveModal.close(true)`; `cancel()` → `NgbActiveModal.dismiss()`.
- Template: heading "Close this fleet?", body "Closing the root will close the entire fleet tab and stop monitoring `<repoName>`.", two buttons "Cancel" / "Close fleet".

**`FleetDeadPaneOverlayComponent` shape:**
- Inputs: `paneTitle: string`, `command: string` (so the user sees what's about to relaunch), `onRelaunch: () => void` callback.
- Template: full-pane absolute-positioned div with semi-transparent backdrop, a centered card showing `paneTitle`, the command text in monospace, and a single "Relaunch" button.
- Styles: `position: absolute; inset: 0; z-index: 1000; pointer-events: auto;` so it captures clicks; backdrop `background: rgba(0,0,0,0.55)`.

**Notification copy (spec §2 "Notifications and indicators"):**
- Pane added by watcher: `NotificationsService.info("Worktree added: " + paneTitle)`.
- Pane removed by watcher: `NotificationsService.info("Worktree closed: " + paneTitle)`.
- Watch-mode notice at launch: `NotificationsService.notice("Watch mode: filesystem events")` or `"Watch mode: polling (filesystem watch unavailable)"`.
- Pre-launch failure: `NotificationsService.error("Pre-launch command failed", "<command> exited with code <n>")`.
- Repo-path invalid: `NotificationsService.error("Not a git repository", "<path>")`.
- Fleet launch aborted (folder picker canceled): no notification — the user knows.

**Failure modes specific to this slice:**
- Pre-launch command times out (30s): treated as exit code timeout; launch aborts with `NotificationsService.error("Pre-launch command timed out", "Exceeded 30 seconds")`.
- `addPaneForWorktree` fails for one worktree during launch: the error is logged via `NotificationsService.error`, that worktree is skipped, and the launch continues for the rest. The fleet opens with as many panes as could be added.
- `addPaneForWorktree` fails during a watcher-driven add: the error toast fires; the path is added to `userDismissed` so the watcher doesn't retry on the next event (subject to spec §5 open-Q on rename semantics).
- Root-close confirmation modal is dismissed by clicking outside: treated as cancel (no close).
- The dead-pane overlay's "Relaunch" click fails (command not found, etc.): the overlay stays; toast surfaces the error. User can click again or close the pane manually.

## §5 Sequence

**Launch (from tabby-host §5 step 5):**
1. `FleetController.register` (tabby-host §4) is called with the SplitTabComponent and the resolved `AgentFleetProfileOptions`.
2. `FleetController.launch()` begins.
   a. If `profile.repoPath` is non-empty: validated via `child_process.execSync('git -C <path> rev-parse --git-dir', { timeout: 2000 })` (spec §4 — abort within 2s). On failure → `NotificationsService.error` and abort (return; tab closes via `splitTab.close()`).
   b. If `profile.repoPath` is empty: read the active host tab's working directory (via `AppService.activeTab` if it exposes cwd; otherwise prompt with the folder picker via `ElectronService.dialog.showOpenDialog({ properties: ['openDirectory'] })`). Cancel → abort.
3. If `profile.preSpawnCommand` is non-empty: `child_process.exec(command, { cwd: repoPath, timeout: 30000 })`. Await completion. Non-zero exit or timeout → abort with NotificationsService.error.
4. Run `git -C <repoPath> worktree list --porcelain` via [`worktree-data`](worktree-data.md) slice's enumerator. Filter + sort.
5. Detect watch mode: try filesystem-event watch (deferred to [`fs-watcher`](fs-watcher.md)); on failure, fall back to polling. Fire `NotificationsService.notice` once with the active mode.
6. Build initial pane set via tabby-host's `splitTab.addTab(...)` chain. For each `addTab`: capture `splitTab.getFocusedTab()` first; restore via `splitTab.focus(captured)` after the call returns (so the launch doesn't yank focus through every pane).
7. Apply baseline ratios via `applyRatios` (tabby-host §4 + layout-engine §4).
8. Subscribe `splitTab.focusChanged$` (tabby-host §5) for auto-zoom.
9. Override the root pane's `canClose` to call `confirmRootClose()` (see modal sequence below).
10. Start the worktree watcher (via [`fs-watcher`](fs-watcher.md)) wired to `FleetController.onWatcherChange`.
11. For each pane carrying `recovered: true` (from a recovery launch): instantiate `FleetDeadPaneOverlayComponent` via ComponentFactoryResolver and append `componentRef.location.nativeElement` to the pane's `viewRef.rootNodes[0]`. Store the `componentRef` in `paneRegistry`.

**Watcher event handler (`onWatcherChange`):**
1. Compute `currentPaths = new Set(paneRegistry.values().filter(role === 'worktree').map(worktreePath))`.
2. Compute `incomingPaths = new Set(currentWorktrees.map(w => w.path))`.
3. `toAdd = incomingPaths − currentPaths − userDismissed`.
4. `toRemove = currentPaths − incomingPaths` (only if `profile.autoCloseRemoved`).
5. For each path in `toAdd` (if `profile.autoOpenNew`):
   a. Capture `previouslyFocused = splitTab.getFocusedTab()`.
   b. Call `addPaneForWorktree(wt)` (tabby-host §4).
   c. If `!profile.stealFocusOnAdd`: `splitTab.focus(previouslyFocused)`.
   d. If `profile.notifyOnChange`: `NotificationsService.info("Worktree added: " + title)`.
6. For each path in `toRemove`:
   a. Call `removePaneForWorktree(path)`.
   b. If `profile.notifyOnChange`: `NotificationsService.info("Worktree closed: " + title)`.
7. After all structural changes: re-measure SplitTabComponent root, call `applyRatios(computeLayoutWeights(...))` to rebalance.

**Manual pane close (user clicks pane X):**
1. The pane's standard `canClose()` returns `true` (default for worktree panes).
2. Tabby removes the pane from the SplitTabComponent.
3. `FleetController` observes via the pane's `destroyed$` (subscribed during `addPaneForWorktree`).
4. Controller calls `dismissPane(worktreePath)`: adds path to `userDismissed`, removes entry from `paneRegistry`, calls `applyRatios` to rebalance.

**Root pane close:**
1. User clicks the X on the root pane.
2. SplitTabComponent calls `rootPane.canClose()` → overridden to call `confirmRootClose()`.
3. `confirmRootClose` opens `ConfirmFleetCloseModalComponent` via `NgbModal.open()`.
4. On user confirm → resolves `true` → root pane closes → cascades to fleet tab close. On cancel → resolves `false` → close aborted.
5. Fleet tab close fires `splitTab.destroyed$` → `FleetRegistry.unregister` (tabby-host §5) tears down all subscriptions, the watcher, and the userDismissed set.

**Dead-pane relaunch:**
1. User clicks "Relaunch" on the overlay.
2. `FleetDeadPaneOverlayComponent` invokes its `onRelaunch` callback → `FleetController.relaunchPane(paneId)`.
3. Controller looks up the pane's stored command via `paneRegistry`.
4. Controller spawns a new session in the pane (via the stock terminal pane's session-recreation mechanism — same path the pane uses when its session ends and the shell prompt appears). Open question §7: exact API for "restart this pane's command".
5. Controller clears `recovered: true` and destroys the overlay component (`componentRef.destroy()`).

**Fleet tab close:**
1. User closes the whole tab (e.g. via Tabby's tab X), OR root-close cascades.
2. Standard tab tear-down fires `splitTab.destroyed$`.
3. `FleetRegistry.unregister` runs: stop watcher, unsubscribe focusChanged$ and ResizeObserver, clear paneRegistry, dispose all overlay ComponentRefs.

## §6 Out of scope

- The `addPaneForWorktree` / `removePaneForWorktree` / `applyRatios` implementations themselves — defined in [`tabby-host`](tabby-host.md). This slice calls them.
- The ratio math used by `applyRatios` — defined in [`layout-engine`](layout-engine.md).
- `fs.watch` setup, poll fallback, debounce — defined in [`fs-watcher`](fs-watcher.md). This slice subscribes to the watcher's `onChange` event.
- Git porcelain enumeration, filter rules, sort order — defined in [`worktree-data`](worktree-data.md). This slice consumes the parsed result.
- Template rendering, PowerShell encoding, shell argv construction — defined in [`shell-launcher`](shell-launcher.md). This slice does not render commands; it stores the rendered command on each pane entry at launch and replays it on relaunch.
- The `AgentFleetProfileOptions` shape and its 27 settings — defined in [`profile-and-settings`](profile-and-settings.md).
- npm package, webpack, NgModule wiring of the two new components — `plugin-scaffold` slice will register `ConfirmFleetCloseModalComponent` and `FleetDeadPaneOverlayComponent` as entry components in the NgModule.
- Auto-relaunch on restart (spec §3 Out — explicitly deferred to a future version).

## §7 Open questions

- The exact API for "restart this pane's command" against a stock terminal pane after the session has been disposed (or never created on restart): does `BaseTerminalTabComponent` expose a `reconnect()` or `initializeSession()` method, or does the plugin need to destroy and re-create the pane? Resolve by reading `tabby-terminal/src/components/baseTerminalTab.component.ts` during implementation.
- Whether `AppService.activeTab` exposes a working directory for the "empty repoPath uses current working directory" launch case (spec §2 acceptance). If not, the launch falls back to the folder picker immediately when `repoPath` is empty. Resolve during implementation.
- Spec §5: when a profile is edited while a fleet is open, do live-applicable changes (color, min dims, layout mode, transition duration, watch mode) apply now or on next launch? Affects whether `FleetController` subscribes to `ConfigService` changes. Update §5 here once spec §5 resolves.
- Spec §5: rename-detection (same branch, new path within a short time window). If treated as rename, `removePaneForWorktree` + `addPaneForWorktree` is the wrong path — the slice would need a third operation `relocatePane`. Currently designed as remove-then-add; revisit if spec §5 changes.
- Spec §5: should the dead-pane overlay also appear on mid-session command exit? Currently §3 decision 6 says no (only on recovery). If spec resolves the open question to "yes", change the overlay trigger to also subscribe to `session.closed$` and add a per-pane `livedSinceAttach` flag to distinguish "command exited" from "never ran".

> If the parent spec is ambiguous on anything this slice depends on, stop and update the spec. Do not invent behavior here.
