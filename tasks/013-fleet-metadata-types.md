Parent slice: [tabby-host](../slices/tabby-host.md)
Depends on: 012

# Task 013 — FleetPaneMetadata and RecoveryToken types in api.ts

_Tick `[x]` on each Tasks item as you finish it, and on each Acceptance item as it passes. The unticked state is what tells the next planning run that this task is still safe to edit in place._

## Goal
Add per-pane metadata type and the recovery-token shape to `api.ts` so the profile provider, recovery provider, and FleetController share one type.

## Tasks
- [x] Edit `src/api.ts`: declare and export `FleetPaneMetadata` interface with the 8 fields from [`plan.md`](../plan.md) Appendix B (`fleetTabId: string`, `fleetProfileId: string`, `role: 'root' | 'worktree'`, `worktreePath: string`, `branch: string | null`, `fleetVersion: number`, `spawnedAt: string`, `baselineWeight: number`).
- [x] Edit `src/api.ts`: declare and export `RecoveredPane` (`{ role: 'root' | 'worktree'; worktreePath: string; branch: string | null; command: string; title: string; color: string | null }`).
- [x] Edit `src/api.ts`: declare and export `AgentFleetRecoveryToken` (`{ type: 'agent-fleet'; profileId: string; profile: AgentFleetProfileOptions; panes: RecoveredPane[]; tabTitle: string; tabColor: string | null }`).
- [x] Edit `src/api.ts`: declare and export `FLEET_VERSION: number` constant set to `1` (the current schema version per Appendix B).
- [x] Edit `tests/api.test.ts` (extending task 012's file): add cases (a) `FLEET_VERSION === 1`, (b) `FleetPaneMetadata` has 8 keys (assertion via a typed default-instance), (c) `AgentFleetRecoveryToken.type` literal-narrows to `'agent-fleet'`.

## Acceptance criteria
- [x] `npm test -- --grep api` exits 0 with at least 3 additional passing cases beyond task 012.
- [x] `npx tsc --noEmit` exits 0.
- [x] `grep -nE 'export (interface|const) (FleetPaneMetadata|RecoveredPane|AgentFleetRecoveryToken|FLEET_VERSION)' src/api.ts` matches all four exports.

> If a `## Tasks` checkbox can't be completed without changing what the parent slice specifies, stop and update the slice. Do not redesign here.
