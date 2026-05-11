Parent slice: [shell-launcher](../slices/shell-launcher.md)
Depends on: 002

# Task 007 — PowerShell encoder and command-mode escaper

_Tick `[x]` on each Tasks item as you finish it, and on each Acceptance item as it passes. The unticked state is what tells the next planning run that this task is still safe to edit in place._

## Goal
Two pure functions used by both encoding modes: `encodeForPwsh` (UTF-16LE base64 for `-EncodedCommand`) and `escapeForPwshCommand` (literal `"` and `$` escaping for `& { ... }` wrapper).

## Tasks
- [x] Create `src/utils/pwsh.ts` exporting `encodeForPwsh(command: string): string` returning `Buffer.from(command, 'utf16le').toString('base64')` per [`plan.md`](../plan.md) Appendix A.3.
- [x] In `src/utils/pwsh.ts`, also export `escapeForPwshCommand(command: string): string` that replaces literal `"` with `\"` and `$` with `` `$ `` (PowerShell's escape character). Used only by the `command` encoding mode in `command.service.ts`.
- [x] Create `tests/pwsh.test.ts` with cases: (a) round-trip — `Buffer.from(encodeForPwsh(cmd), 'base64').toString('utf16le') === cmd` for several inputs including unicode, (b) `escapeForPwshCommand` escapes `"`, (c) `escapeForPwshCommand` escapes `$`, (d) `escapeForPwshCommand` leaves `'` alone, (e) empty string round-trips correctly.

## Acceptance criteria
- [x] `npm test -- --grep pwsh` exits 0 with at least 5 passing cases. _(7 passing.)_
- [x] `npx tsc --noEmit` exits 0.
- [x] `grep -nE 'export function (encodeForPwsh|escapeForPwshCommand)' src/utils/pwsh.ts` matches both exports.
- [x] `test -f tests/pwsh.test.ts` exits 0.

> If a `## Tasks` checkbox can't be completed without changing what the parent slice specifies, stop and update the slice. Do not redesign here.
