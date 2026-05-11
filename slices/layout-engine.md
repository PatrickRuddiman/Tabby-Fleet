Parent spec: [tabby-fleet specification](../spec.md)

# tabby-fleet — layout-engine

## §1 Summary

Pure-function computation of pane size ratios for a fleet tab: baseline grid (root left 50%, worktrees evenly stacked on the right) plus auto-zoom when a pane is focused, with a pixel-level min-floor clamp. Outputs the per-pane weights that the `tabby-host` slice's `FleetController.applyRatios` walks across `SplitContainer.ratios` arrays. Also owns the CSS rule that controls the transition duration when those ratios change.

## §2 Codebase reconnaissance

Local repo: greenfield. No prior layout module exists at `C:\Users\prudd\source\repos\tabby-ai-worktree\src\services\layout.service.ts`; this slice creates it.

Tabby host:
- `tabby-core/src/components/splitTab.component.ts` line 939–945 — `layoutInternal()` writes `element.style.left/top/width/height = '<n>%'` on `viewRef.rootNodes[0]` (the pane's root DOM element directly, no wrapper). Each gets the `.child` class.
- `tabby-core/src/components/splitTab.component.ts` line 930–931 — `childW`/`childH` derive from `container.ratios[i]` and the container's orientation.
- `tabby-core/src/components/splitTab.component.scss` line 6–7 — `::ng-deep split-tab > .child { transition: 0.125s all }`. Already covers width/height. `.no-animations` disables.
- `tabby-core/src/components/splitTab.component.ts` — no `window.addEventListener('resize')` and no `ResizeObserver`. Layout re-runs only on explicit triggers (tab add/remove/split, spanner drag).
- `tabby-core/src/components/splitTabSpanner.component.ts` line 43–60 — user-driven manual resize mutates `container.ratios[i] += diff` and re-emits.
- `tabby-core/src/components/splitTab.component.ts` line 240–243 — `initialized$` public observable. Base class `baseTab.component.ts` line 63 — `destroyed$` public observable.
- Plugin CSS convention (per `tabby-core/src/components/splitTab*.scss`): component-scoped via `:host` or external penetration via `::ng-deep`.

Contract reference from sibling slice [`tabby-host`](tabby-host.md): `FleetController.applyRatios(weights: LayoutWeights[])` consumes this slice's output; `FleetRegistry`-owned subscription drives the call.

## §3 Decisions

1. **Output shape.** Options considered: per-pane `LayoutWeights[]`, per-container ratio map `{ rootRatios, rightRatios }`, hybrid both-shapes. **Chosen:** per-pane `LayoutWeights[]`. Rationale: matches the contract `tabby-host` already committed to; keeps the function free of any knowledge of Tabby's container references; consumer's `applyRatios` already walks via `getParentOf` to find each pane's container.

2. **Zoom redistribution algorithm.** Options considered: solve-then-clamp (analytic), uniform shrink factor, configurable shrinkFactor knob. **Chosen:** solve-then-clamp. Rationale: deterministic spec-§2 "approximately twice" when no clamping fires; uniform-shrink drifts at larger N; no new config knob needed.

3. **Container-size source.** Options considered: caller passes `containerSize` parameter, function measures DOM, drop pixel floor for a ratio floor. **Chosen:** caller passes `containerSize`. Rationale: keeps the function pure (no DOM dependency, trivial to unit-test); both callsites in the `tabby-host` slice already have access to the SplitTabComponent element to measure.

4. **Layout mode plumbing.** Options considered: `mode` parameter on the single function, two named functions, mode bypasses the engine. **Chosen:** `mode: 'grid' | 'static-grid'` parameter. Rationale: one entry point, one test surface; `static-grid` simply ignores `focusedId` and returns baseline weights; no logic duplicated at the callsite.

5. **CSS transition.** Options considered: override duration via plugin SCSS with a CSS custom property, accept Tabby's 0.125s default, write inline `element.style.transition` on each pane. **Chosen:** plugin SCSS override using a CSS custom property `--fleet-zoom-duration`. Rationale: respects the existing `transition: 0.125s all` rule by overriding only the width/height duration via a more-specific selector; lets the user-configurable `zoomTransitionMs` actually take effect without per-pane DOM mutation.

6. **Recompute trigger.** Options considered: focus only, focus + window resize, focus + ResizeObserver. **Chosen:** focus + ResizeObserver on the SplitTabComponent's root element. Rationale: spec §4 requires the min-floor to hold across container size changes (not just window resizes — e.g., sidebar toggle); ResizeObserver is per-element and the precise tool.

7. **Module shape.** Options considered: pure module exporting a free function, `@Injectable` Angular service. **Chosen:** pure module. Rationale: no DI dependencies; trivially testable without Angular TestBed; only one consumer (`FleetController`).

## §4 Contracts & shapes

**File:** `src/services/layout.service.ts`.

**Inputs:**
- `panes: PaneInfo[]` — every pane in the fleet, in stable order. `PaneInfo` is `{ id: string; role: 'root' | 'worktree'; baselineWeight: number }`. `baselineWeight` is set at pane construction time: 2 for the root pane, 1 for each worktree pane.
- `focusedId: string | null` — id of the currently focused pane within the fleet tab, or null if no pane in this tab has focus.
- `zoomFactor: number` — from profile (`AgentFleetProfileOptions.zoomFactor`, default 2.0).
- `containerSize: { width: number; height: number }` — the SplitTabComponent's measured root element size in pixels.
- `minFloor: { width: number; height: number }` — from profile (`minPaneWidth`/`minPaneHeight`, default 120×80).
- `mode: 'grid' | 'static-grid'` — from profile (`layoutMode`).

**Output:** `LayoutWeights[]` — one entry per input pane, same length and order. Each entry is `{ paneId: string; weight: number; clamped: boolean }`. The `weight` is the *normalized ratio within the pane's container* (root pane's weight ∈ [0,1] within root container; each worktree pane's weight ∈ [0,1] within right container, with the right-container weights summing to 1; root container weights sum to 1 across the root pane + the right container's aggregate slot). The `clamped` flag is true iff the pixel min-floor pulled the value up from the algorithm's preferred weight.

**Containers handled (fixed by spec §3 In):**
- Root container: horizontal split, two children — the root pane and the right container. Width-floor applies (each child's `width × containerSize.width` ≥ `minFloor.width`).
- Right container: vertical split, N children (the worktrees). Height-floor applies (each child's `height × containerSize.height` ≥ `minFloor.height`) and the right container itself shares `containerSize.height` with the root pane (since root container is horizontal, full height passes through).

**Algorithm — baseline (`mode === 'static-grid'` OR `focusedId === null`):**
- Root container ratios: `[0.5, 0.5]` (root pane, right container).
- Right container ratios: `[1/N, 1/N, …, 1/N]` for N worktrees.
- Apply width-floor at root container: if `0.5 × containerSize.width < minFloor.width` for either side, lift the smaller to `minFloor.width / containerSize.width` and renormalize the other.
- Apply height-floor at right container: if `1/N × containerSize.height < minFloor.height`, lift each below-floor child to the floor and redistribute among any unclamped siblings. If every child is below the floor, every child is clamped at the floor and the panes overflow the visible area (degenerate case — pane count exceeds container's capacity at the configured floor).
- `clamped: true` on every pane whose floor lift fired.

**Algorithm — zoomed (`mode === 'grid'` AND `focusedId !== null`):**
- Identify the focused pane's container (root container if `focusedId` is the root pane; right container otherwise).
- Within that container, set the focused child's target weight to `zoomFactor × baselineWeight / (zoomFactor × baselineWeight + Σ otherBaselineWeights)`. For the root container this is `2 × 2 / (2 × 2 + 2) = 4/6 ≈ 0.667`. For a worktree pane within the right container (all baselines 1) with N total worktrees this is `2 / (2 + N − 1) = 2 / (N + 1)`.
- Distribute the remaining `1 − target_focused` evenly across the other children, weighted by their baselines.
- Apply the appropriate floor (width on root container, height on right container). For each pane whose weight × dimension < floor, clamp to `floor / dimension` and reduce the focused pane's weight by the surplus needed to keep the sum at 1. If the focused pane's weight would itself drop below `floor / dimension`, clamp it to the floor and accept a sum > 1 (the rendered result overflows — degenerate case, spec §2 "focused pane grows by whatever room remains").
- The non-zoomed container (the one not containing the focused pane) uses the baseline algorithm above.
- `clamped: true` is set on any pane whose floor lift fired (focused or not).

**Edge cases:**
- `panes.length === 1` (only the root pane, no worktrees yet): root container has a single child; ratios `[1.0]`. Right container does not exist.
- `panes.length === 0`: returns `[]`. (Defensive — should not occur in normal launch flow.)
- `containerSize.width` or `.height` is 0: returns baseline ratios uncapped (avoid division-by-zero); fleet is not yet visible.

**CSS contract:**
- File: `src/styles/fleet-transition.scss`, imported by the plugin's NgModule.
- Rule: `::ng-deep split-tab.fleet-tab > .child { transition: width var(--fleet-zoom-duration, 150ms) ease-out, height var(--fleet-zoom-duration, 150ms) ease-out; }`.
- The `.fleet-tab` class is added by `tabby-host` slice's `FleetController.register` on the SplitTabComponent host element to scope the override to fleet tabs only.
- The `--fleet-zoom-duration` custom property is written on the same host element by `FleetController` as `${profile.zoomTransitionMs}ms` at register time and on profile-edit re-application.

## §5 Sequence

**Initial layout (after fleet launch, from `tabby-host` §5 step 5g):**
1. `FleetController.applyRatios` is called with no focused pane.
2. Controller measures `splitTab.elementRef.nativeElement.getBoundingClientRect()` → `{ width, height }`.
3. Controller calls `computeLayoutWeights(panes, null, profile.zoomFactor, containerSize, profile.minFloor, profile.layoutMode)`.
4. Controller walks the result, finds each pane's `SplitContainer` via `splitTab.getParentOf`, assigns `container.ratios` arrays, calls `splitTab.layout()` once.

**Focus change:**
1. `splitTab.focusChanged$` emits the newly focused `BaseTabComponent`.
2. `FleetController.onFocusChange` measures the container, calls `computeLayoutWeights` with `focusedId = focused.id`, writes ratios, calls `splitTab.layout()`.
3. Tabby's CSS `transition` (now scoped to `var(--fleet-zoom-duration)`) animates the width/height changes from current to new `%` values over the configured duration.

**Container resize:**
1. `FleetController` registers a `ResizeObserver` on `splitTab.elementRef.nativeElement` during `register`.
2. The observer fires when the SplitTabComponent's outer box changes (window resize, sidebar toggle, panel resize).
3. Controller re-measures, re-runs `computeLayoutWeights` with the current `focusedId` (read from `splitTab.getFocusedTab()`), writes ratios, calls `splitTab.layout()`.
4. Cleanup: `controller.unregister` disconnects the ResizeObserver.

**Layout mode change (live setting edit, if open question §7 resolves to "apply live"):**
1. FleetController observes profile changes via `ConfigService`.
2. On `layoutMode` change, controller calls `applyRatios` immediately with the new mode.

## §6 Out of scope

- Profile-options shape and storage → `profile-and-settings` slice.
- Reading the SplitTabComponent's nested container references and mutating their `ratios` → `tabby-host` slice's `FleetController.applyRatios`. This slice produces the numbers; it does not write them.
- Adding the `.fleet-tab` class to the SplitTabComponent host element → `tabby-host` slice's `FleetController.register`.
- Notifications when min-floor degenerates (pane count exceeds capacity) → `fleet-lifecycle` slice may surface a toast; this slice only marks `clamped: true`.
- The pane-add and pane-remove rebalance flow → `fleet-lifecycle` slice calls `applyRatios` after structural change; this slice is unaware of structural change as an event.
- Manual user-driven gutter drag handling (`SplitTabSpannerComponent`) → not a fleet-engine concern; Tabby owns it.

## §7 Open questions

- ResizeObserver granularity: should it observe the SplitTabComponent root only, or also the right container? Right-container size changes when the root pane is focused (root grows; right shrinks), but those changes are already caused by ratio writes — observing them would trigger a recompute loop. Resolve during implementation by observing the SplitTabComponent root only and verifying the loop doesn't manifest.
- When the focused pane's clamped weight forces an aggregate ratio sum > 1 (degenerate case with very many panes), Tabby's renderer behavior is unverified. Spec §2 says "focused pane grows by whatever room remains, which may be less than twice its baseline" — implying the focused pane is the one that gives up space, not that sum exceeds 1. The algorithm as specified prefers clamping the focused pane down; need to confirm whether this matches Tabby's actual rendering at 12+ panes.
- Spec §5 asks whether live profile edits apply without relaunch. If yes, this slice's `applyRatios` is triggered by profile-change events; the recompute trigger list above expands. Update §5 here once spec §5 is resolved.

> If the parent spec is ambiguous on anything this slice depends on, stop and update the spec. Do not invent behavior here.
