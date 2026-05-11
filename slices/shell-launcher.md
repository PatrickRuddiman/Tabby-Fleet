Parent spec: [tabby-fleet specification](../spec.md)

# tabby-fleet — shell-launcher

## §1 Summary

Turns a `(template, variables, shell-config)` triple into a concrete `{ command, args, cwd }` spawn descriptor that tabby-host's pane construction passes into `NewTabParameters.inputs`. Owns template rendering (`{var}` substitution + `{{` `}}` escapes), PowerShell encoding modes (`encoded` UTF-16LE+base64 and `command` `& { ... }` wrapper), and argv assembly. Pure logic; no host coupling.

## §2 Codebase reconnaissance

> Greenfield: no existing system to reconcile. Decisions below are unconstrained.

Reference implementations preserved verbatim in [`plan.md`](../plan.md) Appendix A.3 (`encodeForPwsh`) and A.4 (`renderTemplate`). This slice adopts both and adds the orchestrator that picks encoding mode and produces the final spawn descriptor.

Sibling-slice contracts already settled:
- [`worktree-data`](worktree-data.md) §4 produces the `Record<string, string>` consumed as template variables.
- [`tabby-host`](tabby-host.md) §5 step 5e/5f calls `buildSpawnDescriptor(...)` (this slice's primary API) when constructing each pane's `NewTabParameters.inputs`.
- [`fleet-lifecycle`](fleet-lifecycle.md) §5 stores the rendered command on each pane entry so it can be replayed on relaunch (spec §2 "Restart and persistence").
- [`profile-and-settings`](profile-and-settings.md) owns the `AgentFleetProfileOptions` shape; this slice reads `commandTemplate`, `rootCommandTemplate`, `paneTitlePattern`, `rootTitle`, `shell`, `shellArgs`, `encoding`.

## §3 Decisions

1. **Module split.** Options considered: single utility module, three pure modules (template + pwsh + orchestrator), Angular service wrapping the lot. **Chosen:** three pure modules — `src/utils/template.ts`, `src/utils/pwsh.ts`, `src/services/command.service.ts` (where `command.service.ts` is a plain TS module despite the filename — kept for alignment with the path declared in `plan.md`). Rationale: matches the file structure plan.md already declared; both leaf modules test in isolation; orchestrator file is the one place that joins them.

2. **Encoding-mode dispatch.** Options considered: `encoded`-by-default with `command`-on-opt-in, `command`-by-default, runtime auto-detection from `shellArgs`. **Chosen:** strict profile-driven dispatch on `profile.encoding ∈ {'encoded', 'command'}`. Rationale: spec §3 In treats the encoding setting as user-configurable; auto-detection would hide the choice; defaults table (plan.md Appendix C) sets `encoded` so out-of-the-box behavior is correct on Windows.

3. **Spawn descriptor shape.** Options considered: tuple `[command, args[], cwd]`, object `{ command, args, cwd }`, separate render + encode + spawn calls at the call site. **Chosen:** object `{ command: string; args: string[]; cwd: string }`. Rationale: matches how Tabby's `NewTabParameters.inputs` ingests terminal-tab arguments; the caller (tabby-host's pane construction) treats it as opaque.

4. **Title rendering.** Options considered: same module as command rendering (one `render` function), separate `renderTitle` function, inline at call site. **Chosen:** same `renderTemplate` function. Rationale: both consume the same variable map (spec §3 In, same closed set of template variables for commands and titles); duplicating the function would invite drift.

5. **Detached-worktree synthetic branch identifier.** Options considered: substitute `(detached@{head_short})` for `{branch}` and `{branch_short}`, omit branch substitution entirely, return null. **Chosen:** substitute the synthetic identifier — the [`worktree-data`](worktree-data.md) §4 `worktreeToVars` already produces this; this slice receives the variable map unchanged.

6. **Cross-platform note.** Options considered: special-case bash / zsh encoding paths now, defer entirely, hardcode PowerShell. **Chosen:** defer. Rationale: spec §4 explicitly defers cross-platform shell defaults to a later release; v0.1 ships Windows defaults via the profile defaults table; non-Windows users override `shell`/`shellArgs`/`encoding` per-profile. Slice §7 flags the open question.

7. **Module shape.** Options considered: free functions, exported class, `@Injectable` service. **Chosen:** free functions exported from each module. Rationale: no DI dependencies; trivial to test; one consumer (tabby-host) — no second callsite justifies a class.

## §4 Contracts & shapes

**File:** `src/utils/template.ts` (pure).
- `renderTemplate(template: string, vars: Record<string, string>): string` — implementation lifted verbatim from plan.md Appendix A.4. `{var}` substitutes from `vars`; `{{` and `}}` are literal `{` and `}`; unknown placeholders pass through unchanged.

**File:** `src/utils/pwsh.ts` (pure).
- `encodeForPwsh(command: string): string` — implementation lifted from plan.md Appendix A.3. Returns `Buffer.from(command, 'utf16le').toString('base64')`.
- `escapeForPwshCommand(command: string): string` — escapes literal `"` to `\"` before substitution into the `pwsh -Command "& { ... }"` wrapper. Plus collapses any `$` characters that would interpolate via PowerShell — replaces `$` with `` `$ ``. Used only by the `command` encoding mode.

**File:** `src/services/command.service.ts` (pure-function module).
- Type `SpawnDescriptor = { command: string; args: string[]; cwd: string }`.
- Type `ShellConfig = { shell: string; shellArgs: string[]; encoding: 'encoded' | 'command' }`.
- `buildSpawnDescriptor(template: string, vars: Record<string, string>, cwd: string, shell: ShellConfig): SpawnDescriptor` —
  1. `rendered = renderTemplate(template, vars)`.
  2. Switch on `shell.encoding`:
     - `'encoded'`: `args = [...shell.shellArgs, encodeForPwsh(rendered)]`. Requires `shell.shellArgs` to end with the flag that consumes the next arg as base64 (e.g. `'-EncodedCommand'`). Default profile ships `shellArgs = ['-NoExit', '-EncodedCommand']`.
     - `'command'`: `wrapped = "& { " + escapeForPwshCommand(rendered) + " }"`. `args = [...shell.shellArgs, wrapped]`. Default profile would override `shellArgs` to `['-NoExit', '-Command']`.
  3. Return `{ command: shell.shell, args, cwd }`.
- `renderTitle(template: string, vars: Record<string, string>): string` — calls `renderTemplate`. Exported as a named alias for clarity at call sites.

**Contract notes:**
- The slice neither validates `cwd` nor checks that `command` is on `PATH`. Spec §2 failure mode "configured command is not on `PATH`" is handled at runtime by the spawned shell ("command not found" appears in the pane); the slice's job ends at descriptor construction.
- An empty template returns an empty string from `renderTemplate`; in that case `buildSpawnDescriptor` still produces a valid `SpawnDescriptor` with the shell launched bare (matches the "empty root command falls back to just `pwsh -NoExit`" behavior implied by plan.md Appendix C defaults).
- Title rendering: title templates use the same variable set; no encoding step.

**Failure modes specific to this slice:**
- `vars` missing a key referenced in `template`: per Appendix A.4, the `{unknownKey}` is left as-is in the output. This is intentional — the rendered command will fail visibly when the shell runs it, surfacing the typo to the developer.
- `template` contains an unbalanced `{`: pass-through; output may contain a literal `{` that the shell will see.
- `encoding === 'command'` with a `rendered` value containing newline characters: pass through verbatim into the `& { ... }` block; PowerShell handles multiline.
- `shell.shell` is an empty string: returns `SpawnDescriptor` with `command: ''`; the spawn will fail at runtime with a clear OS-level error.

## §5 Sequence

**Initial pane construction (tabby-host §5 step 5d–5f):**
1. tabby-host's `FleetController.register` iterates worktrees.
2. For each worktree, the controller calls `worktreeToVars(wt, repo)` (worktree-data §4) → `Record<string, string>`.
3. Controller picks the template: `profile.rootCommandTemplate` for the main worktree, `profile.commandTemplate` otherwise.
4. Controller calls `buildSpawnDescriptor(template, vars, cwd, shellConfig)` where `cwd = wt.path` (or `repo.path` for the root pane) and `shellConfig = { shell, shellArgs, encoding }` from the profile.
5. Controller passes the resulting `{ command, args, cwd }` into `NewTabParameters.inputs` for the stock terminal pane.
6. Controller calls `renderTitle(profile.paneTitlePattern, vars)` (or `rootTitle`) → string. Stored on `paneRegistry` entry; assigned to the pane's `title` field.

**Relaunch on dead pane (fleet-lifecycle §5):**
1. fleet-lifecycle's `relaunchPane(paneId)` reads the stored command, args, cwd from `paneRegistry`.
2. Re-uses the same `SpawnDescriptor` — no re-render. (The render captured the worktree's state at launch; if branch/HEAD has moved since the restart, the user clicks Relaunch with the original intent.)

**Watcher-driven pane add (fleet-lifecycle §5 step 5b):**
1. fleet-lifecycle's `onWatcherChange` finds a new worktree to add.
2. Calls `worktreeToVars(wt, repo)` then `buildSpawnDescriptor(profile.commandTemplate, vars, wt.path, shellConfig)`.
3. Hands descriptor to tabby-host's `FleetController.addPaneForWorktree`.

## §6 Out of scope

- Git enumeration, filtering, sort order, variable-map construction → [`worktree-data`](worktree-data.md). This slice consumes `vars`, does not produce it.
- Pane creation in the SplitTabComponent — the `SpawnDescriptor` is data; tabby-host's `addPaneForWorktree` is the one that calls `splitTab.addTab(...)`.
- Storing the rendered command on the pane registry for restart-restoration — owned by [`fleet-lifecycle`](fleet-lifecycle.md) §4 (`paneRegistry`).
- The pre-launch shell command (spec §2 "optional pre-launch shell command"): a one-shot exec, not a pane; runs via `child_process.exec` directly in [`fleet-lifecycle`](fleet-lifecycle.md) §5. It does not flow through `buildSpawnDescriptor` (no template substitution in spec §3 In for pre-launch).
- Settings-UI surfaces for `shell`, `shellArgs`, `encoding` → [`profile-and-settings`](profile-and-settings.md).
- File-system watcher attachment and debounce → [`fs-watcher`](fs-watcher.md).

## §7 Open questions

- Spec §5 (cross-platform support): if v0.1 ships macOS/Linux support, the `encoded`/`command` encoding modes (PowerShell-specific) need a third `raw`/`bash` mode that wraps in `bash -c "<rendered>"` with appropriate POSIX-shell escaping. The slice's current API survives because `encoding` is already an enum-typed setting; adding a third value is non-breaking. Resolve before any non-Windows packaging.
- `shellArgs` is fully user-controlled, including the position where the encoded payload lands (the slice appends it to the end). If a user sets `shellArgs = ['-EncodedCommand', '-NoExit']` (encoded flag NOT last), the spawn will misinterpret the payload as `-NoExit`'s value. Either document the constraint in [`profile-and-settings`](profile-and-settings.md)'s settings UI, or detect the `-EncodedCommand` index and insert after it instead of always appending. Resolve during implementation.

> If the parent spec is ambiguous on anything this slice depends on, stop and update the spec. Do not invent behavior here.
