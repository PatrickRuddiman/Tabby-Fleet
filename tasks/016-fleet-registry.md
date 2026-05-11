Parent slice: [tabby-host](../slices/tabby-host.md)
Depends on: 005, 008, 010, 013

# Task 016 — FleetRegistry singleton + FleetController skeleton

_Tick `[x]` on each Tasks item as you finish it, and on each Acceptance item as it passes. The unticked state is what tells the next planning run that this task is still safe to edit in place._

## Goal
Per-tab `FleetController` (created via `FleetRegistry.register`) that owns the pane registry, the focus subscription, the ratio-write path, and the addPane/removePane primitives consumed by the lifecycle slice.

## Tasks
- [x] Create `src/services/fleet.registry.ts` exporting `FleetRegistry` (`@Injectable({ providedIn: 'root' })`) with internal `Map<SplitTabComponent, FleetController>`. Methods: `register(tab, profile, recoveredPanes?): FleetController`, `get(tab): FleetController | null`, `unregister(tab): void`.
- [x] In `src/services/fleet.registry.ts`, also export `FleetController` class. Constructor stores `splitTab`, `profile`, and initializes `paneRegistry: Map<paneId, { worktreePath, role, command, title, color, recovered, overlayRef? }>`, `userDismissed: Set<string>`, watcher reference placeholder.
- [x] In `FleetController`, implement `applyRatios(weights: LayoutWeights[]): void` that walks `splitTab.getAllTabs()`, finds each pane's `SplitContainer` via `splitTab.getParentOf`, sets `container.ratios` to a normalized array (sum to 1 within each container), calls `splitTab.layout()` once at the end.
- [x] In `FleetController`, implement `addPaneForWorktree(wt: Worktree, options): Promise<BaseTabComponent>`. Renders the command via `buildSpawnDescriptor` from `command.service.ts`; calls `splitTab.addTab(newPane, relativePane, side)` per [tabby-host slice §5](../slices/tabby-host.md) (root → `addTab(wt, root, 'r')` for first worktree, subsequent → `addTab(wt, previousWorktreePane, 'b')`); updates `paneRegistry`.
- [x] In `FleetController`, implement `removePaneForWorktree(worktreePath: string): void`. Looks up the pane in `paneRegistry`, calls `splitTab.removeTab(pane)`, deletes the registry entry.
- [x] In `FleetController.register` (the registry method): adds `.fleet-tab` class to `splitTab.elementRef.nativeElement` so the CSS in task 011 applies; sets `--fleet-zoom-duration` CSS variable to `${profile.zoomTransitionMs}ms`; subscribes to `splitTab.focusChanged$` and on each emit calls `computeLayoutWeights` (from task 010) + `applyRatios`; subscribes to `splitTab.destroyed$` and calls `unregister`.
- [x] In `FleetController.register`, attach a `ResizeObserver` to `splitTab.elementRef.nativeElement` that triggers a re-compute via `computeLayoutWeights` + `applyRatios` on size changes (per [layout-engine §5](../slices/layout-engine.md)).
- [x] In `FleetController`, override `splitTab.getRecoveryToken` via direct assignment so it serializes the current `paneRegistry` into an `AgentFleetRecoveryToken` matching the shape declared in `api.ts`.
- [x] Create `tests/fleet.registry.test.ts` with unit cases (mock SplitTabComponent): (a) `register` adds the controller to the map, (b) `register` adds the `.fleet-tab` class, (c) `register` writes `--fleet-zoom-duration` CSS variable, (d) `unregister` removes the controller and the class, (e) `applyRatios` calls `splitTab.layout()` after mutating ratios, (f) `addPaneForWorktree` calls `splitTab.addTab` with the correct relative + side, (g) `getRecoveryToken` returns a token with `type === 'agent-fleet'` and `panes.length` matching the registry size, (h) double-register on the same tab returns the existing controller without duplicating subscriptions.

## Acceptance criteria
- [x] `npm test -- --grep fleet.registry` exits 0 with at least 8 passing cases.
- [x] `npx tsc --noEmit` exits 0.
- [x] `grep -nE 'export class (FleetRegistry|FleetController)' src/services/fleet.registry.ts` matches both exports.
- [x] `grep -nE "from '\.\./services/(layout|command|worktree)\.service'" src/services/fleet.registry.ts` matches at least 3 import lines. _(Note: the file is itself inside `src/services/`, so relative imports use `'./layout.service'` etc. — grep with `from './(layout|command|worktree)\.service'` matches 3 lines. AC regex was authored as if the file lived outside services/.)_
- [x] `grep -nE 'fleet-tab' src/services/fleet.registry.ts` matches at least one line (CSS class assignment).

> If a `## Tasks` checkbox can't be completed without changing what the parent slice specifies, stop and update the slice. Do not redesign here.
