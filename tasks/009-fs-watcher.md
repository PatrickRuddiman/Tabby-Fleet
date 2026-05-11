Parent slice: [fs-watcher](../slices/fs-watcher.md)
Depends on: 002

# Task 009 — WorktreeWatcher with fs.watch + poll fallback + debounce

_Tick `[x]` on each Tasks item as you finish it, and on each Acceptance item as it passes. The unticked state is what tells the next planning run that this task is still safe to edit in place._

## Goal
`WorktreeWatcher` class that watches `<repoPath>/.git/worktrees/` via `fs.watch`, falls back to polling on error, debounces rapid bursts, and fires a single `onChange` callback per settled change.

## Tasks
- [x] Create `src/services/watcher.service.ts` exporting `WorktreeWatcher` class per [`plan.md`](../plan.md) Appendix A.2 verbatim, with constructor `(repoPath: string, onChange: () => void, debounceMs?: number = 250)`.
- [x] In `src/services/watcher.service.ts`, implement `start(mode: 'fs' | 'poll', pollIntervalMs?: number = 5000): void`. For `'fs'` mode, try `fs.watch(<repoPath>/.git/worktrees, { persistent: false }, debouncedFire)`; if that directory doesn't exist, watch `<repoPath>/.git` with filename filter; on `fs.watch` throw, fall back to `startPolling`.
- [x] In `src/services/watcher.service.ts`, expose `actualMode: 'fs' | 'poll' | null` getter that returns which mode is active after `start()` resolved (per [slice §7](../slices/fs-watcher.md) decision).
- [x] In `src/services/watcher.service.ts`, implement `stop(): void` that closes the FSWatcher, clears the poll interval, and clears any pending debounce timer. Must be idempotent (safe to call multiple times).
- [x] Create `tests/watcher.test.ts` with cases: (a) debounce coalesces rapid events into one `onChange` call, (b) double-stop is idempotent, (c) `start('poll', 100)` fires `onChange` after the interval, (d) `stop()` prevents pending debounce from firing, (e) integration: create a temp directory with `.git/worktrees/`, start watcher, create a file in `.git/worktrees/`, assert `onChange` fires within 500 ms.

## Acceptance criteria
- [x] `npm test -- --grep watcher` exits 0 with at least 5 passing cases. _(5 passing.)_
- [x] `npx tsc --noEmit` exits 0.
- [x] `grep -nE 'export class WorktreeWatcher' src/services/watcher.service.ts` matches one line.
- [x] `grep -nE '(start|stop|actualMode)' src/services/watcher.service.ts` matches at least 3 references. _(11 matches.)_
- [x] `test -f tests/watcher.test.ts` exits 0.

> If a `## Tasks` checkbox can't be completed without changing what the parent slice specifies, stop and update the slice. Do not redesign here.
