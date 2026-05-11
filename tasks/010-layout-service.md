Parent slice: [layout-engine](../slices/layout-engine.md)
Depends on: 002

# Task 010 — computeLayoutWeights pure function

_Tick `[x]` on each Tasks item as you finish it, and on each Acceptance item as it passes. The unticked state is what tells the next planning run that this task is still safe to edit in place._

## Goal
Pure-function module that computes per-pane `LayoutWeights[]` for both baseline and zoomed states, using solve-then-clamp math and converting the pixel min-floor to a ratio floor via the passed `containerSize`.

## Tasks
- [ ] Create `src/services/layout.service.ts` exporting `PaneInfo` (`{ id: string; role: 'root' | 'worktree'; baselineWeight: number }`), `LayoutWeights` (`{ paneId: string; weight: number; clamped: boolean }`), and `computeLayoutWeights(panes, focusedId, zoomFactor, containerSize, minFloor, mode): LayoutWeights[]`.
- [ ] In `src/services/layout.service.ts`, implement the baseline algorithm per [slice §4](../slices/layout-engine.md): root container ratios `[0.5, 0.5]`; right container ratios `[1/N, …]` for N worktrees; apply width-floor at root container and height-floor at right container; clamp + redistribute.
- [ ] In `src/services/layout.service.ts`, implement the zoomed algorithm: for the focused pane's container, set `targetFocused = zoomFactor × baselineWeight / (zoomFactor × baselineWeight + Σ otherBaselines)`; distribute `1 − targetFocused` evenly across others weighted by their baselines; apply the appropriate dimension floor; clamp + redistribute clamped overflow back to focused (or accept overflow if focused itself falls below floor).
- [ ] In `src/services/layout.service.ts`, edge cases: `panes.length === 1` returns `[{ paneId, weight: 1.0, clamped: false }]`; `panes.length === 0` returns `[]`; `containerSize.width === 0` or `containerSize.height === 0` returns baseline ratios uncapped.
- [ ] In `src/services/layout.service.ts`, when `mode === 'static-grid'` OR `focusedId === null`, run only the baseline algorithm regardless of `focusedId`.
- [ ] Create `tests/layout.service.test.ts` with cases: (a) 1 pane returns weight 1.0, (b) 2 panes (root + 1 wt) baseline = 0.5/0.5 horizontal, (c) 5 panes (root + 4 wt) baseline = root 0.5 + right vertical 0.25 each, (d) 4-pane fleet zoom on wt B: B grows ≈2x within right column, root unchanged, (e) zoom on root: root weight ≈0.67 within root container, (f) 10-pane fleet with 80 px min-height in 400 px container: unfocused panes clamped at floor, focused gets remaining, (g) `mode: 'static-grid'` ignores focusedId, (h) clamped flag is set on panes that hit the floor.

## Acceptance criteria
- [ ] `npm test -- --grep layout.service` exits 0 with at least 8 passing cases.
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `grep -nE 'export (function|interface) (computeLayoutWeights|PaneInfo|LayoutWeights)' src/services/layout.service.ts` matches all three.
- [ ] `node -e "const {computeLayoutWeights} = require('./src/services/layout.service'); const r = computeLayoutWeights([{id:'r',role:'root',baselineWeight:2},{id:'w1',role:'worktree',baselineWeight:1}], null, 2, {width:1000,height:500}, {width:120,height:80}, 'grid'); process.exit(r.length===2 ? 0 : 1)"` exits 0.

> If a `## Tasks` checkbox can't be completed without changing what the parent slice specifies, stop and update the slice. Do not redesign here.
