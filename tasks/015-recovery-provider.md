Parent slice: [tabby-host](../slices/tabby-host.md)
Depends on: 013

# Task 015 — AgentFleetRecoveryProvider

_Tick `[x]` on each Tasks item as you finish it, and on each Acceptance item as it passes. The unticked state is what tells the next planning run that this task is still safe to edit in place._

## Goal
Register a `TabRecoveryProvider` that recognizes fleet recovery tokens after Tabby restart and rebuilds the fleet tab with dead-pane manifests carried through.

## Tasks
- [x] Create `src/providers/recovery.provider.ts` exporting `AgentFleetRecoveryProvider implements TabRecoveryProvider<SplitTabComponent>` (import `TabRecoveryProvider` from `tabby-core`).
- [x] In `src/providers/recovery.provider.ts`, implement `applicableTo(token): Promise<boolean>` returning `token?.type === 'agent-fleet'`.
- [x] In `src/providers/recovery.provider.ts`, implement `recover(token: AgentFleetRecoveryToken): Promise<NewTabParameters<SplitTabComponent> | null>` returning `{ type: SplitTabComponent, inputs: { fleetProfile: token.profile, recoveredPanes: token.panes } }`. Return `null` if `token.type !== 'agent-fleet'` (defensive).
- [x] Mark the class `@Injectable({ providedIn: 'root' })` so Tabby can resolve it through DI.
- [x] Create `tests/recovery.provider.test.ts` with cases: (a) `applicableTo({type:'agent-fleet'})` returns true, (b) `applicableTo({type:'ssh'})` returns false, (c) `applicableTo(null)` returns false, (d) `recover(validToken)` returns NewTabParameters with `type` SplitTabComponent and `inputs.recoveredPanes` deep-equal to `token.panes`, (e) `recover({type:'ssh',...})` returns null.

## Acceptance criteria
- [x] `npm test -- --grep recovery.provider` exits 0 with at least 5 passing cases.
- [x] `npx tsc --noEmit` exits 0.
- [x] `grep -nE 'export class AgentFleetRecoveryProvider' src/providers/recovery.provider.ts` matches one line.
- [x] `grep -nE "@Injectable" src/providers/recovery.provider.ts` matches one line.

> If a `## Tasks` checkbox can't be completed without changing what the parent slice specifies, stop and update the slice. Do not redesign here.
