Parent slice: [worktree-data](../slices/worktree-data.md)
Depends on: 003, 004

# Task 005 — worktree.service.ts async git wrapper

_Tick `[x]` on each Tasks item as you finish it, and on each Acceptance item as it passes. The unticked state is what tells the next planning run that this task is still safe to edit in place._

## Goal
Async wrapper around `git` that exposes `validateRepoPath`, `describeRepo`, and `listFilteredWorktrees`, returning discriminated-union results so callers can pattern-match on error kinds.

## Tasks
- [x] Create `src/services/worktree.service.ts` exporting `validateRepoPath(repoPath: string): Promise<{ ok: true } | { ok: false, error: GitError }>`. Use `util.promisify(child_process.exec)` to run `git -C <repoPath> rev-parse --git-dir` with `{ timeout: 2000 }`. Map exit codes / spawn errors to `GitError.kind` values `'not-a-repo' | 'git-not-found' | 'timeout'`.
- [x] In `src/services/worktree.service.ts`, export `describeRepo(repoPath: string): Promise<{ ok: true, value: { repo: RepoInfo, worktrees: Worktree[] } } | { ok: false, error: GitError }>`. Run `git rev-parse --abbrev-ref HEAD` and `git worktree list --porcelain` in parallel via `Promise.all` with a 10-second timeout. Build `RepoInfo` with `name` = final path component, `mainHead` = `worktrees[0].head`.
- [x] In `src/services/worktree.service.ts`, export `listFilteredWorktrees(repoPath: string, options: FilterOptions): Promise<...>` composing `describeRepo` + `filterAndSortWorktrees` from `src/utils/porcelain.ts`.
- [x] Define `GitError` type in `src/services/worktree.service.ts` with `kind: 'not-a-repo' | 'git-not-found' | 'timeout' | 'parse-error'`, `message: string`, optional `stderr`, `exitCode`.
- [x] Create `tests/worktree.service.test.ts` with cases: (a) `validateRepoPath` on a real git repo (use a temp directory + `git init`), (b) `validateRepoPath` on a non-repo directory returns `kind: 'not-a-repo'`, (c) `validateRepoPath` on a non-existent path returns `kind: 'not-a-repo'`, (d) `describeRepo` returns `{ ok: true }` with main branch + at least one worktree, (e) `listFilteredWorktrees` filters by `worktreePathPrefix`.

## Acceptance criteria
- [x] `npm test -- --grep worktree.service` exits 0 with at least 5 passing cases. _(5 passing.)_
- [x] `npx tsc --noEmit` exits 0.
- [x] `grep -nE 'export (function|const|type) (validateRepoPath|describeRepo|listFilteredWorktrees|GitError)' src/services/worktree.service.ts` matches all four exports.
- [x] `grep -nE "from '\.\./utils/porcelain'" src/services/worktree.service.ts` matches at least one import line.

> If a `## Tasks` checkbox can't be completed without changing what the parent slice specifies, stop and update the slice. Do not redesign here.
