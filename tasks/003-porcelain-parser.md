Parent slice: [worktree-data](../slices/worktree-data.md)
Depends on: 002

# Task 003 — Porcelain parser for `git worktree list --porcelain`

_Tick `[x]` on each Tasks item as you finish it, and on each Acceptance item as it passes. The unticked state is what tells the next planning run that this task is still safe to edit in place._

## Goal
Parse git's `worktree list --porcelain` output into a typed `Worktree[]`, handling the four optional fields (branch/detached, locked, prunable) and mixed line endings.

## Tasks
- [ ] Create `src/utils/porcelain.ts` exporting the `Worktree` interface with the 8 fields enumerated in [`plan.md`](../plan.md) Appendix A.1 (`path`, `head`, `branch`, `locked`, `lockedReason`, `prunable`, `prunableReason`, `isMain`).
- [ ] In `src/utils/porcelain.ts`, implement `parseWorktreeListPorcelain(stdout: string): Worktree[]` following Appendix A.1 verbatim: split on `\r?\n\r?\n+`, parse each block via `parseBlock`, set `worktrees[0].isMain = true`.
- [ ] In `src/utils/porcelain.ts`, also export `filterAndSortWorktrees(all: Worktree[], options: FilterOptions): Worktree[]` applying the filter rules from [slice §4](../slices/worktree-data.md): main worktree always retained; for non-main records apply path-prefix match (case-insensitive on `process.platform === 'win32'`) → detached → prunable → locked → sort by `path` ascending.
- [ ] Create `tests/porcelain.test.ts` with cases: (a) standard 3-worktree output, (b) detached worktree, (c) locked with reason, (d) prunable with reason, (e) CRLF line endings, (f) main detection (first record), (g) filter excludes outside-prefix, (h) filter retains main even when prefix mismatches.

## Acceptance criteria
- [ ] `npm test -- --grep porcelain` exits 0 with at least 8 passing cases.
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `grep -nE 'export (function|interface) (parseWorktreeListPorcelain|filterAndSortWorktrees|Worktree)' src/utils/porcelain.ts` matches all three exports.
- [ ] `test -f tests/porcelain.test.ts` exits 0.

> If a `## Tasks` checkbox can't be completed without changing what the parent slice specifies, stop and update the slice. Do not redesign here.
