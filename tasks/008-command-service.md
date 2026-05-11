Parent slice: [shell-launcher](../slices/shell-launcher.md)
Depends on: 006, 007

# Task 008 — command.service buildSpawnDescriptor

_Tick `[x]` on each Tasks item as you finish it, and on each Acceptance item as it passes. The unticked state is what tells the next planning run that this task is still safe to edit in place._

## Goal
Produce the `{ command, args, cwd }` spawn descriptor by composing template rendering + encoding-mode dispatch, so the consumer (tabby-host's pane construction) treats commands as opaque.

## Tasks
- [x] Create `src/services/command.service.ts` exporting `SpawnDescriptor` type (`{ command: string; args: string[]; cwd: string }`), `ShellConfig` type (`{ shell: string; shellArgs: string[]; encoding: 'encoded' | 'command' }`), and `buildSpawnDescriptor(template: string, vars: Record<string, string>, cwd: string, shell: ShellConfig): SpawnDescriptor`.
- [x] In `src/services/command.service.ts`, `buildSpawnDescriptor` calls `renderTemplate` from `src/utils/template.ts`, then switches on `shell.encoding`: `'encoded'` appends `encodeForPwsh(rendered)` to `shell.shellArgs`; `'command'` wraps as `"& { " + escapeForPwshCommand(rendered) + " }"` and appends to `shell.shellArgs`.
- [x] In `src/services/command.service.ts`, also export `renderTitle(template: string, vars: Record<string, string>): string` as a named alias for `renderTemplate` (semantic clarity at call sites).
- [x] Create `tests/command.service.test.ts` with cases: (a) encoded mode produces base64 in `args`, (b) command mode produces `& { ... }` wrapper in `args`, (c) `cwd` is passed through unchanged, (d) `command` equals `shell.shell`, (e) empty template still returns a valid `SpawnDescriptor`, (f) branch name with spaces and quotes round-trips through encoded mode without truncation.

## Acceptance criteria
- [x] `npm test -- --grep command.service` exits 0 with at least 6 passing cases. _(7 passing.)_
- [x] `npx tsc --noEmit` exits 0.
- [x] `grep -nE 'export (function|type) (buildSpawnDescriptor|SpawnDescriptor|ShellConfig|renderTitle)' src/services/command.service.ts` matches all four exports.
- [x] `grep -nE "from '\.\./utils/(template|pwsh)'" src/services/command.service.ts` matches both imports.

> If a `## Tasks` checkbox can't be completed without changing what the parent slice specifies, stop and update the slice. Do not redesign here.
