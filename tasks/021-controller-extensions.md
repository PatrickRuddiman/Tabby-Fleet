Parent slice: [fleet-lifecycle](../slices/fleet-lifecycle.md)
Depends on: 005, 008, 009, 010, 016, 019, 020

# Task 021 — FleetController extensions: launch, watcher diff, dismiss, modal, relaunch

_Tick `[x]` on each Tasks item as you finish it, and on each Acceptance item as it passes. The unticked state is what tells the next planning run that this task is still safe to edit in place._

## Goal
Extend `FleetController` (created in task 016) with the per-fleet lifecycle methods: launch sequencing, watcher event handler with diff, user-dismissed set, root-close confirmation, dead-pane overlay attach, and relaunch.

## Tasks
- [x] Edit `src/services/fleet.registry.ts`: add `FleetController.launch(): Promise<void>` per [fleet-lifecycle slice §5](../slices/fleet-lifecycle.md): resolve repo path (explicit → current dir → folder picker via `ElectronService.dialog.showOpenDialog`); validate via `validateRepoPath` from `worktree.service.ts`; run `preSpawnCommand` via `child_process.exec` with `cwd` set + 30 s timeout (abort on non-zero exit); call `listFilteredWorktrees`; attach `WorktreeWatcher` and fire `NotificationsService.notice` once with the active watch mode; iterate worktrees and call `addPaneForWorktree` per pane (capture/restore previous focus to obey `stealFocusOnAdd: false`); call `applyRatios` with baseline weights; attach dead-pane overlays for any pane created from `recoveredPanes` input.
- [x] Edit `src/services/fleet.registry.ts`: add `FleetController.onWatcherChange(): Promise<void>`. Calls `listFilteredWorktrees`, computes `toAdd = incoming − current − userDismissed`, `toRemove = current − incoming` (only if `profile.autoCloseRemoved`), calls `addPaneForWorktree` / `removePaneForWorktree` per diff, fires `NotificationsService.info` per change (when `notifyOnChange`), captures + restores focus on add (when `!stealFocusOnAdd`), calls `applyRatios` to rebalance.
- [x] Edit `src/services/fleet.registry.ts`: add `FleetController.dismissPane(worktreePath: string): void`. Adds path to `userDismissed`, calls `removePaneForWorktree`, calls `applyRatios`.
- [x] Edit `src/services/fleet.registry.ts`: add `FleetController.confirmRootClose(): Promise<boolean>`. Inject `NgbModal`, open `ConfirmFleetCloseModalComponent`, set `componentInstance.repoName`, return promise resolving to `true` on confirm / `false` on cancel.
- [x] Edit `src/services/fleet.registry.ts`: override the root pane's `canClose` after creation in `launch()`, replacing it with `() => this.confirmRootClose()`.
- [x] Edit `src/services/fleet.registry.ts`: add `FleetController.relaunchPane(paneId: string): Promise<void>`. Looks up stored `SpawnDescriptor` in `paneRegistry`, re-runs it via the stock terminal pane's session mechanism (slice §7 open question — choose between `pane.reconnect()` or destroy+recreate via `addPaneForWorktree` at impl time), clears `recovered` flag, calls `overlayRef.destroy()`.
- [x] Edit `src/services/fleet.registry.ts`: subscribe to each pane's `destroyed$` after `addPaneForWorktree`. On non-root pane destroyed (and not via `removePaneForWorktree`), call `dismissPane(paneRegistry.get(paneId).worktreePath)`. Distinguish system-initiated removal (already in flight via watcher) from user-initiated close (the `destroyed$` is unexpected).
- [x] Edit `src/services/fleet.registry.ts`: in `FleetController.register` (from task 016), instantiate `FleetDeadPaneOverlayComponent` via `ComponentFactoryResolver` for each pane in `inputs.recoveredPanes`, append `componentRef.location.nativeElement` to the pane's `viewRef.rootNodes[0]`, store the `componentRef` in `paneRegistry[paneId].overlayRef`.
- [x] Edit `tests/fleet.registry.test.ts` (extending task 016's file): add cases (a) `launch` with valid repo + 2 worktrees creates 3 panes, (b) `launch` with invalid repo aborts (no tab opened, error toast surfaced — mock `NotificationsService`), (c) `launch` with non-zero preSpawnCommand aborts, (d) `onWatcherChange` diff `add`s + `remove`s the right panes, (e) `dismissPane` adds to `userDismissed` and `onWatcherChange` does not re-add the dismissed path, (f) `confirmRootClose` opens the modal and resolves correctly (mocked `NgbModal`), (g) `relaunchPane` clears the `recovered` flag and destroys the overlay.

## Acceptance criteria
- [x] `npm test -- --grep fleet.registry` exits 0 with at least 15 passing cases total (8 from task 016 + 7 new).
- [x] `npx tsc --noEmit` exits 0.
- [x] `grep -nE '(launch|onWatcherChange|dismissPane|confirmRootClose|relaunchPane)' src/services/fleet.registry.ts` matches at least 5 method names.
- [x] `grep -nE "FleetDeadPaneOverlayComponent|ConfirmFleetCloseModalComponent" src/services/fleet.registry.ts` matches both component imports.
- [x] `grep -nE "NotificationsService" src/services/fleet.registry.ts` matches at least one import line.

> If a `## Tasks` checkbox can't be completed without changing what the parent slice specifies, stop and update the slice. Do not redesign here.
