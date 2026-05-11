Parent slice: [layout-engine](../slices/layout-engine.md)
Depends on: 010

# Task 011 — fleet-transition.scss CSS contract

_Tick `[x]` on each Tasks item as you finish it, and on each Acceptance item as it passes. The unticked state is what tells the next planning run that this task is still safe to edit in place._

## Goal
Override Tabby's built-in `transition: 0.125s all` on `.fleet-tab` descendants with a configurable duration via the `--fleet-zoom-duration` CSS custom property.

## Tasks
- [x] Create `src/styles/fleet-transition.scss` containing the rule `::ng-deep split-tab.fleet-tab > .child { transition: width var(--fleet-zoom-duration, 150ms) ease-out, height var(--fleet-zoom-duration, 150ms) ease-out; }`.
- [x] Verify the SCSS file is picked up by the webpack `sass-loader` chain configured in task 001. If not, add an explicit import in `src/index.ts` (e.g., `import './styles/fleet-transition.scss'`).
- [x] The `.fleet-tab` class is added by `FleetRegistry.register` (task 014) on the SplitTabComponent's host element; this task only ships the rule.

## Acceptance criteria
- [x] `test -f src/styles/fleet-transition.scss` exits 0.
- [x] `grep -nE '--fleet-zoom-duration' src/styles/fleet-transition.scss` matches at least 2 lines (width and height transition properties).
- [x] `grep -nE 'split-tab\.fleet-tab > \.child' src/styles/fleet-transition.scss` matches one line.
- [x] `npm run build` exits 0 (webpack bundles the SCSS).
- [x] `npm test -- --grep layout` still exits 0 (existing layout-service tests from task 010 continue to pass; verifies the rest of the layout-engine slice's contract is intact after CSS changes).

> If a `## Tasks` checkbox can't be completed without changing what the parent slice specifies, stop and update the slice. Do not redesign here.
