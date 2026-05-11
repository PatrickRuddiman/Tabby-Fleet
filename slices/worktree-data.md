Parent spec: [tabby-fleet specification](../spec.md)

# tabby-fleet — worktree-data

## §1 Summary

The data layer that turns a git repo path into a filtered, sorted list of `Worktree` records and template-variable maps ready for command rendering. Pure logic over git's `--porcelain` output plus a thin async wrapper that spawns git. No Tabby host coupling; testable as plain TypeScript.

## §2 Codebase reconnaissance

> Greenfield: no existing system to reconcile. Decisions below are unconstrained.

Reference implementations preserved verbatim from spec v0.3 in [`plan.md`](../plan.md) Appendix A.1 (parser), A.6 (variable mapping). This slice adopts them as starting points and adds: an async git-spawn wrapper, a typed error result, and the filter/sort pass.

Sibling-slice contracts already settled:
- [`fleet-lifecycle`](fleet-lifecycle.md) §5 calls `validateRepoPath(path)` for the spec §4 "abort within 2 seconds" requirement.
- [`fleet-lifecycle`](fleet-lifecycle.md) §5 calls `listWorktrees(repoPath, options)` at launch and on each watcher event.
- [`shell-launcher`](shell-launcher.md) consumes the `Record<string, string>` returned by `worktreeToVars(...)` as input to template rendering.

## §3 Decisions

1. **Spawn mechanism for `git worktree list --porcelain`.** Options considered: `child_process.exec` (promisified), `child_process.execSync`, `child_process.spawn` with manual stdout collection. **Chosen:** `child_process.exec` wrapped in `util.promisify`. Rationale: returns full stdout/stderr/exit code in one promise; non-blocking on the renderer thread; sufficient for the ≤MB-scale output `git worktree list` produces.

2. **Repo validation API.** Options considered: rely on `listWorktrees` failing for non-repos, separate `validateRepoPath` running `git rev-parse --git-dir`, parse `.git` directory presence directly. **Chosen:** separate `validateRepoPath(path): Promise<{ ok: boolean; reason?: string }>` running `git -C <path> rev-parse --git-dir` with a 2-second timeout. Rationale: spec §4 caps the validation at 2 seconds; a dedicated cheap call (returns within ~50ms for valid repos) gives the caller a fast happy-path and a clean error reason on failure.

3. **Main-branch and main-HEAD discovery for root-pane template variables.** Options considered: separate `git rev-parse --abbrev-ref HEAD` call, parse from porcelain output, leave to caller. **Chosen:** combined helper `describeRepo(path): Promise<RepoInfo>` that runs `git -C <path> rev-parse --abbrev-ref HEAD` for the branch name and reads the main HEAD from the first record of `git worktree list --porcelain`. Rationale: one round-trip to get both pieces; the porcelain output is already needed for the worktree list, so HEAD comes for free.

4. **Error shape.** Options considered: throw plain Error, throw typed Error subclasses, return Result-type union. **Chosen:** return a discriminated union `{ ok: true, value } | { ok: false, error: { kind, message, ... } }` from each top-level async function. Rationale: error kinds (`'not-a-repo' | 'git-not-found' | 'timeout' | 'parse-error'`) feed directly into [`fleet-lifecycle`](fleet-lifecycle.md)'s notification copy with no try/catch unwrapping at the call site.

5. **Path normalization.** Options considered: pass-through git's forward-slash output, normalize to native separators in worktree-data, both. **Chosen:** pass-through. Rationale: `Worktree.path` carries the forward-slash form git emits; the consumer `worktreeToVars` is responsible for producing the native-separator variant (`path_native`) per spec §3 In template variable list.

6. **Module shape.** Options considered: single utils module exporting all functions, separate parser + spawn-wrapper + filter modules, Angular `@Injectable` service. **Chosen:** two pure modules — `src/utils/porcelain.ts` (parse + filter + sort) and `src/services/worktree.service.ts` (async spawn + orchestrator that returns the final `Worktree[]` and `RepoInfo`). Plus `src/utils/vars.ts` for `worktreeToVars`. Rationale: parsing tests need only the porcelain module; the spawn wrapper is the one place that touches the filesystem and can be mocked once for integration tests; no DI dependencies justify an Angular service.

## §4 Contracts & shapes

**File:** `src/utils/porcelain.ts` (pure).
- Type `Worktree`: per plan.md Appendix A.1 — `{ path: string; head: string; branch: string | null; locked: boolean; lockedReason: string | null; prunable: boolean; prunableReason: string | null; isMain: boolean }`.
- `parseWorktreeListPorcelain(stdout: string): Worktree[]` — implementation lifted from plan.md Appendix A.1. Returns records in git's original order; the first record's `isMain` is set to `true`.
- `filterAndSortWorktrees(all: Worktree[], options: FilterOptions): Worktree[]` — applies the spec §3 In filter rules in order. `options = { repoPath: string; worktreePathPrefix: string; includeDetached: boolean; includePrunable: boolean; includeLocked: boolean }`. The main worktree (first record) is never filtered; it returns as the first element of the output and the caller treats it as the root pane. Worktree-pane candidates (all non-main) are filtered then sorted by `path` ascending. Path-prefix match is case-insensitive on `win32`, case-sensitive elsewhere.

**File:** `src/utils/vars.ts` (pure).
- `worktreeToVars(wt: Worktree, repo: RepoInfo): Record<string, string>` — implementation lifted from plan.md Appendix A.6. `repo = { name: string; path: string; mainBranch: string; mainHead: string }`. Produces the 9 template variables enumerated in spec §3 In. Detached worktrees get synthetic `branch`/`branch_short` of `(detached@{head_short})`.

**File:** `src/services/worktree.service.ts` (thin async wrapper).
- `validateRepoPath(repoPath: string): Promise<ValidateResult>` — runs `git -C <repoPath> rev-parse --git-dir` with `{ timeout: 2000 }`. Returns `{ ok: true } | { ok: false, error: { kind: 'not-a-repo' | 'git-not-found' | 'timeout', message: string } }`.
- `describeRepo(repoPath: string): Promise<DescribeResult>` — runs `git -C <repoPath> rev-parse --abbrev-ref HEAD` AND `git -C <repoPath> worktree list --porcelain` (in parallel via `Promise.all`). Returns either `{ ok: true, value: { repo: RepoInfo, worktrees: Worktree[] } }` or `{ ok: false, error: GitError }`. `repo.name` is the final path component of `repoPath`. `repo.path` is the input (forward-slashed). `repo.mainBranch` is the stdout of `rev-parse --abbrev-ref` trimmed; on detached HEAD it falls back to `(detached@${mainHead.slice(0,7)})` to mirror the per-worktree variable mapping.
- `listFilteredWorktrees(repoPath: string, options: FilterOptions): Promise<ListResult>` — composes `describeRepo` + `filterAndSortWorktrees`. Returns `{ ok: true, value: { repo: RepoInfo, worktrees: Worktree[] } }`. This is the primary API the watcher event handler uses; the worktrees list excludes filtered-out paths but always retains the main worktree at index 0.

**Error shape:**
- `GitError = { kind: 'not-a-repo' | 'git-not-found' | 'timeout' | 'parse-error', message: string, stderr?: string, exitCode?: number }`.
- `'git-not-found'`: thrown when `exec` rejects with `ENOENT` on the `git` binary.
- `'timeout'`: thrown when the 2-second (validate) or 10-second (describe) timeout fires.
- `'not-a-repo'`: `git` exited non-zero with `fatal: not a git repository` in stderr.
- `'parse-error'`: porcelain output present but `parseWorktreeListPorcelain` returned an empty array (defensive; should not happen for a valid repo).

**Filter rules (spec §3 In, applied in this order to non-main records):**
1. Path-prefix: keep iff `wt.path.toLowerCase()` (on win32) or `wt.path` (elsewhere) starts with `${repoPath}/${worktreePathPrefix}` after normalizing separators on `worktreePathPrefix`.
2. Detached: drop if `wt.branch === null` and `!options.includeDetached`.
3. Prunable: drop if `wt.prunable` and `!options.includePrunable`.
4. Locked: drop if `wt.locked` and `!options.includeLocked`.

**Sort:** lexicographic by `wt.path` ascending. Stable across launches given identical input.

## §5 Sequence

**Repo validation (fleet-lifecycle §5 step 2a):**
1. Caller resolves `repoPath` from profile or current working directory.
2. Caller invokes `validateRepoPath(repoPath)`.
3. worktree.service spawns `git -C <repoPath> rev-parse --git-dir` via `execAsync` with `{ timeout: 2000 }`.
4. On exit code 0: return `{ ok: true }`.
5. On non-zero exit / timeout / spawn error: return `{ ok: false, error: { kind, message } }`.

**Initial enumeration (fleet-lifecycle §5 step 4):**
1. Caller invokes `listFilteredWorktrees(repoPath, options)`.
2. worktree.service runs `git -C <repoPath> rev-parse --abbrev-ref HEAD` and `git -C <repoPath> worktree list --porcelain` in parallel via `Promise.all`.
3. On either rejection: return `{ ok: false, error }`.
4. On success: pass stdout to `parseWorktreeListPorcelain` → `Worktree[]`.
5. Build `RepoInfo { name, path, mainBranch, mainHead }` where `mainHead = worktrees[0].head`.
6. Apply `filterAndSortWorktrees(worktrees, options)` → filtered list with main at index 0.
7. Return `{ ok: true, value: { repo, worktrees } }`.

**Watcher-driven re-enumeration (fleet-lifecycle §5 watcher event handler):**
1. fleet-lifecycle's `onWatcherChange` invokes `listFilteredWorktrees` again with the same options.
2. Result is diffed against the controller's current `paneRegistry` (fleet-lifecycle §4).
3. `repo` value is ignored on re-enumeration (already captured at launch); only `worktrees` is consumed.

**Template-variable mapping (shell-launcher §5):**
1. shell-launcher receives a `Worktree` and `RepoInfo`.
2. Calls `worktreeToVars(wt, repo)` → `Record<string, string>` with the 9 keys.
3. Passes the map to its template renderer.

## §6 Out of scope

- Spawning the per-pane commands (`claude`, `pwsh.exe`, etc.) — owned by [`shell-launcher`](shell-launcher.md). This slice only spawns `git`.
- Template rendering and `{var}` substitution — owned by [`shell-launcher`](shell-launcher.md). This slice only produces the variable map.
- Watching the filesystem for worktree changes — owned by [`fs-watcher`](fs-watcher.md). This slice is invoked per watcher event but does not own the watcher.
- Diffing the new worktree list against currently open panes — owned by [`fleet-lifecycle`](fleet-lifecycle.md). This slice returns a flat sorted list and lets the lifecycle controller compute add/remove sets.
- The `userDismissed` set — owned by [`fleet-lifecycle`](fleet-lifecycle.md). This slice has no concept of "the user closed this pane manually."
- Configuration storage and per-profile defaults for the filter `options` — owned by [`profile-and-settings`](profile-and-settings.md). Filter options arrive as a plain object.

## §7 Open questions

None. The spec is unambiguous on filter ordering, sort key, and variable-mapping behavior; the parser and var-mapper implementations are preserved verbatim from spec v0.3 in `plan.md` Appendix A.

> If the parent spec is ambiguous on anything this slice depends on, stop and update the spec. Do not invent behavior here.
