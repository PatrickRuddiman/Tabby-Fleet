Parent slice: [fleet-lifecycle](../slices/fleet-lifecycle.md)
Depends on: 002

# Task 019 — ConfirmFleetCloseModalComponent (NgbModal content)

_Tick `[x]` on each Tasks item as you finish it, and on each Acceptance item as it passes. The unticked state is what tells the next planning run that this task is still safe to edit in place._

## Goal
NgbModal content component shown when the user tries to close the root pane; resolves `true` on confirm, `false` on cancel/dismiss.

## Tasks
- [ ] Create `src/components/confirm-fleet-close-modal.component.ts` exporting `ConfirmFleetCloseModalComponent`. Inject `NgbActiveModal` from `@ng-bootstrap/ng-bootstrap`. Input: `repoName: string`.
- [ ] In `confirm-fleet-close-modal.component.ts`, implement `confirm(): void` calling `this.activeModal.close(true)`, `cancel(): void` calling `this.activeModal.dismiss()`.
- [ ] Create `src/components/confirm-fleet-close-modal.component.pug` with `.modal-header` containing "Close this fleet?", `.modal-body` containing the message `"Closing the root will close the entire fleet tab and stop monitoring "{{repoName}}"."`, `.modal-footer` with two buttons: "Cancel" calling `cancel()` and "Close fleet" (btn-danger style) calling `confirm()`.
- [ ] Create `src/components/confirm-fleet-close-modal.component.scss` (minimal; can be empty for v0.1 — Tabby's bootstrap theme styles the modal).
- [ ] Create `tests/confirm-fleet-close-modal.test.ts` with cases: (a) component instantiates with a mocked `NgbActiveModal`, (b) `confirm()` calls `activeModal.close(true)`, (c) `cancel()` calls `activeModal.dismiss()`, (d) the `repoName` input is rendered in the modal body (via DOM querySelector + textContent assertion).

## Acceptance criteria
- [ ] `npm test -- --grep confirm-fleet-close-modal` exits 0 with at least 4 passing cases.
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `grep -nE 'export class ConfirmFleetCloseModalComponent' src/components/confirm-fleet-close-modal.component.ts` matches one line.
- [ ] `grep -nE 'NgbActiveModal' src/components/confirm-fleet-close-modal.component.ts` matches at least one line.

> If a `## Tasks` checkbox can't be completed without changing what the parent slice specifies, stop and update the slice. Do not redesign here.
