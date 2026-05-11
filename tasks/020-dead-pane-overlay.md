Parent slice: [fleet-lifecycle](../slices/fleet-lifecycle.md)
Depends on: 002

# Task 020 — FleetDeadPaneOverlayComponent

_Tick `[x]` on each Tasks item as you finish it, and on each Acceptance item as it passes. The unticked state is what tells the next planning run that this task is still safe to edit in place._

## Goal
Absolute-positioned Angular overlay shown on panes restored from a recovery token, with a "Relaunch" button wired to a controller callback.

## Tasks
- [x] Create `src/components/fleet-dead-pane-overlay.component.ts` exporting `FleetDeadPaneOverlayComponent`. Inputs: `paneTitle: string`, `command: string`, `onRelaunch: () => void`.
- [x] Create `src/components/fleet-dead-pane-overlay.component.pug`: a `.fleet-overlay` div containing a centered `.fleet-overlay-card` showing `{{paneTitle}}` as the heading, the `command` text in a `<pre>` block, and a single `<button class="btn btn-primary" (click)="onRelaunch()">Relaunch</button>`.
- [x] Create `src/components/fleet-dead-pane-overlay.component.scss`: `.fleet-overlay { position: absolute; inset: 0; z-index: 1000; pointer-events: auto; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; }`. Style the inner card with padding, max-width, and a `<pre>` font-family of monospace.
- [x] Create `tests/fleet-dead-pane-overlay.test.ts` with cases: (a) component instantiates with all three inputs, (b) clicking the button calls `onRelaunch`, (c) the `command` input renders inside a `<pre>` element, (d) the overlay has `position: absolute` and `z-index: 1000` resolved via getComputedStyle (or via querying the component's host element class).

## Acceptance criteria
- [x] `npm test -- --grep fleet-dead-pane-overlay` exits 0 with at least 4 passing cases.
- [x] `npx tsc --noEmit` exits 0.
- [x] `grep -nE 'export class FleetDeadPaneOverlayComponent' src/components/fleet-dead-pane-overlay.component.ts` matches one line.
- [x] `grep -nE 'position: absolute' src/components/fleet-dead-pane-overlay.component.scss` matches one line.
- [x] `grep -nE 'inset: 0' src/components/fleet-dead-pane-overlay.component.scss` matches one line.

> If a `## Tasks` checkbox can't be completed without changing what the parent slice specifies, stop and update the slice. Do not redesign here.
