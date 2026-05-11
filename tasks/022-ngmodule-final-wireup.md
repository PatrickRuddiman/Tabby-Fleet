Parent slice: [plugin-scaffold](../slices/plugin-scaffold.md)
Depends on: 014, 015, 016, 017, 018, 019, 020, 021

# Task 022 — Final NgModule wire-up: declare and provide all components/providers

_Tick `[x]` on each Tasks item as you finish it, and on each Acceptance item as it passes. The unticked state is what tells the next planning run that this task is still safe to edit in place._

## Goal
Register every provider and entry component declared across slices into `AgentFleetModule` so the plugin loads cleanly into Tabby with all features wired.

## Tasks
- [x] Edit `src/index.ts`: import `AgentFleetProfileSettingsComponent`, `AgentFleetDefaultsTabComponent`, `ConfirmFleetCloseModalComponent`, `FleetDeadPaneOverlayComponent`, `AgentFleetProfileProvider`, `AgentFleetRecoveryProvider`, `AgentFleetDefaultsTabProvider`, `FleetRegistry`.
- [x] Edit `src/index.ts`: add the four components to `@NgModule({ declarations: [...] })`.
- [x] Edit `src/index.ts`: add to `imports`: `TabbyCoreModule`, `TabbyTerminalModule`, `TabbySettingsModule`, `NgbAccordionModule`, `NgbModalModule`, `FormsModule`.
- [x] Edit `src/index.ts`: add to `providers`: `{ provide: ProfileProvider, useClass: AgentFleetProfileProvider, multi: true }`, `{ provide: TabRecoveryProvider, useClass: AgentFleetRecoveryProvider, multi: true }`, `{ provide: SettingsTabProvider, useClass: AgentFleetDefaultsTabProvider, multi: true }`, plus `FleetRegistry` (root-injectable, listed for clarity).
- [x] Edit `src/index.ts`: add `import './styles/fleet-transition.scss'` at top of file so webpack bundles the CSS.
- [x] Edit `tests/smoke.test.ts` (extending task 002's file): add cases (a) module declarations include all four components, (b) module providers include all three multi-providers, (c) module imports list contains TabbyCoreModule and NgbAccordionModule.
- [x] Run `npm run build` and inspect `dist/index.js` — verify the bundle is non-empty and contains references to all four component class names.

## Acceptance criteria
- [x] `npm test -- --grep smoke` exits 0 with at least 4 passing cases (1 from task 002 + 3 new).
- [x] `npm run build` exits 0.
- [x] `node -e "const m=require('./dist/index.js'); process.exit(m.default ? 0 : 1)"` exits 0.
- [x] `grep -cE 'AgentFleetProfileSettingsComponent|AgentFleetDefaultsTabComponent|ConfirmFleetCloseModalComponent|FleetDeadPaneOverlayComponent' src/index.ts` returns at least 4 (one declaration per component).
- [x] `grep -cE 'AgentFleetProfileProvider|AgentFleetRecoveryProvider|AgentFleetDefaultsTabProvider' src/index.ts` returns at least 3 (one per provider entry).
- [x] `grep -nE "import '\.\/styles\/fleet-transition\.scss'" src/index.ts` matches one line.

> If a `## Tasks` checkbox can't be completed without changing what the parent slice specifies, stop and update the slice. Do not redesign here.
