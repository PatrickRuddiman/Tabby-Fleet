Parent slice: [worktree-data](../slices/worktree-data.md)
Depends on: 003

# Task 004 — worktreeToVars template-variable mapper

_Tick `[x]` on each Tasks item as you finish it, and on each Acceptance item as it passes. The unticked state is what tells the next planning run that this task is still safe to edit in place._

## Goal
Map a parsed `Worktree` + `RepoInfo` to the 9-key variable record consumed by template rendering, handling main-worktree variable substitution and detached-HEAD synthetic identifiers.

## Tasks
- [ ] Create `src/utils/vars.ts` exporting `RepoInfo` type (`{ name: string; path: string; mainBranch: string; mainHead: string }`) and `worktreeToVars(wt: Worktree, repo: RepoInfo): Record<string, string>` following [`plan.md`](../plan.md) Appendix A.6 verbatim.
- [ ] In `src/utils/vars.ts`, for main worktrees substitute `branch`/`branch_short` to `repo.mainBranch`, `path`/`repo_path` to `repo.path`, `name` to `repo.name`, `head`/`head_short` to `repo.mainHead`. For detached worktrees substitute `branch`/`branch_short` to `(detached@${head.slice(0,7)})`.
- [ ] In `src/utils/vars.ts`, derive `branch_short` as the branch name with the first slash-segment removed (e.g. `agent/feature` → `feature`); if branch has no slash, use it as-is.
- [ ] Create `tests/vars.test.ts` with cases: (a) main worktree, (b) regular worktree with slashed branch, (c) regular worktree with slashless branch, (d) detached worktree, (e) `path_native` uses `path.sep` on win32, (f) `head_short` is first 7 chars.

## Acceptance criteria
- [ ] `npm test -- --grep vars` exits 0 with at least 6 passing cases.
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `grep -nE 'export (function|type|interface) (worktreeToVars|RepoInfo)' src/utils/vars.ts` matches both exports.
- [ ] `test -f tests/vars.test.ts` exits 0.

> If a `## Tasks` checkbox can't be completed without changing what the parent slice specifies, stop and update the slice. Do not redesign here.
