Parent spec: [tabby-fleet specification](../spec.md)

# tabby-fleet — fs-watcher

## §1 Summary

Owns the `<repoPath>/.git/worktrees/` watcher: attaches `fs.watch` when the OS supports it, falls back to interval polling when it doesn't (network shares, Docker volumes, certain WSL setups), debounces rapid bursts, and fires a single `onChange()` callback per settled change. No knowledge of git or panes — just "the watched directory changed; please re-enumerate."

## §2 Codebase reconnaissance

> Greenfield: no existing system to reconcile. Decisions below are unconstrained.

Reference implementation preserved verbatim in [`plan.md`](../plan.md) Appendix A.2. This slice adopts it as the design.

Sibling-slice contracts already settled:
- [`fleet-lifecycle`](fleet-lifecycle.md) §5 step 5 owns the watcher's lifecycle: constructs the `WorktreeWatcher`, passes its own `onWatcherChange` as the `onChange` callback, calls `watcher.start(mode, pollIntervalMs)` after profile resolution, calls `watcher.stop()` on fleet-tab teardown.
- [`worktree-data`](worktree-data.md) §5 is what `onWatcherChange` calls to re-enumerate; this slice does not invoke it directly.
- [`profile-and-settings`](profile-and-settings.md) owns the `watchMode` and `pollIntervalMs` settings; this slice consumes them as constructor / start arguments.

## §3 Decisions

1. **Module shape.** Options considered: class instance with `start`/`stop`, free functions returning a handle, RxJS Observable. **Chosen:** class instance (`WorktreeWatcher`). Rationale: matches plan.md Appendix A.2 verbatim; the watcher carries internal state (`fs.FSWatcher | null`, `pollHandle`, `debounceHandle`) that aligns naturally with a class.

2. **Trigger contract.** Options considered: caller-provided `onChange: () => void` callback, Subject the caller subscribes to, EventEmitter. **Chosen:** plain callback. Rationale: one consumer (fleet-lifecycle's `FleetController`); no second subscriber to justify the indirection of an Observable; matches Appendix A.2.

3. **Debounce timing.** Options considered: 100 ms, 250 ms, 500 ms, configurable via setting. **Chosen:** 250 ms hardcoded (matching Appendix A.2's default). Rationale: `git worktree add` writes multiple files within ~50–100 ms; 250 ms is enough to coalesce; spec §4 budget for "reflected within 1 second" leaves plenty of room after this debounce + git list + render. No spec setting for this knob.

4. **fs.watch options.** Options considered: `{ persistent: true }`, `{ persistent: false }`, recursive watching. **Chosen:** `{ persistent: false }`. Rationale: prevents the watcher from blocking Node's exit; the Electron renderer is kept alive by Tabby itself; matches Appendix A.2. Not recursive — only the immediate directory entries matter; new worktrees add a directory under `worktrees/` and `fs.watch` fires on the parent.

5. **Fallback detection.** Options considered: try `fs.watch` and catch synchronous errors, probe filesystem capability up front, expose a `mode` parameter the caller picks. **Chosen:** try/catch with synchronous fallback to polling on error. Rationale: the only reliable way to know that `fs.watch` is broken on the underlying filesystem is to try; spec §2 failure mode "Filesystem-event watcher fails to attach" expects the fallback to happen invisibly with a one-time notice (the notice itself is owned by `fleet-lifecycle`).

6. **`.git/worktrees/` directory may not exist yet.** A repo that has never had a worktree added has no `.git/worktrees/` directory. Options considered: watch `.git/` and filter for `worktrees` filename, create the directory ourselves, error out at start. **Chosen:** watch `.git/` with a filename filter (per Appendix A.2). Rationale: the directory is created by `git worktree add` the first time; watching the parent catches the creation event, after which subsequent changes propagate to the same parent watcher.

7. **Idempotent stop.** Options considered: throw on double-stop, no-op, log warning. **Chosen:** no-op (Appendix A.2 sets handles to null after closing; subsequent stops are silent). Rationale: tear-down paths from multiple sources (manual close, force-quit, error during launch) should converge safely.

## §4 Contracts & shapes

**File:** `src/services/watcher.service.ts` (plain TypeScript class; not an Angular service despite the filename — kept for alignment with the path plan.md declared).

**Class:** `WorktreeWatcher`.

**Constructor:** `new WorktreeWatcher(repoPath: string, onChange: () => void, debounceMs?: number)`.
- `repoPath`: absolute path to the git repo root.
- `onChange`: callback invoked after the debounce window settles.
- `debounceMs`: defaults to 250.

**Methods:**
- `start(mode: 'fs' | 'poll', pollIntervalMs?: number): void` — attempts the requested mode; if `mode === 'fs'` throws (sync), falls back to polling at `pollIntervalMs` (default 5000). Idempotent at the API level: calling `start` while already running has undefined behavior — `fleet-lifecycle` calls `start` exactly once per fleet.
- `stop(): void` — closes `fs.FSWatcher` if active, clears `setInterval` if polling, clears any pending debounce timer. Safe to call multiple times.

**State:**
- `watcher: fs.FSWatcher | null`.
- `pollHandle: NodeJS.Timeout | null`.
- `debounceHandle: NodeJS.Timeout | null`.

**Behavior:**
- In `fs` mode: tries `fs.watch(repoPath + '/.git/worktrees', { persistent: false }, debouncedFire)`. If `.git/worktrees` does not exist, falls back to watching `repoPath + '/.git'` with `(eventType, filename) => filename === 'worktrees' && debouncedFire()`. Either spec-§4 path delivers the contract: any worktree create/remove event fires `debouncedFire`.
- In `poll` mode: `setInterval(debouncedFire, pollIntervalMs)`. The caller's `onChange` re-runs `git worktree list` and diffs — the poll itself does no work; it just schedules a check.
- `debouncedFire`: clears any pending debounce timer, sets a new `setTimeout(onChange, debounceMs)`. Multiple rapid filesystem events collapse to one `onChange` call.

**Detected mode:** the slice does not expose which mode is active after a fallback. [`fleet-lifecycle`](fleet-lifecycle.md) §3 decision 7 surfaces the watch-mode notice via `NotificationsService.notice` based on whether the slice fell back; the simplest contract is `start` returning `void` and `fleet-lifecycle` checking via `console.warn` log or wrapping the call. Slice §7 flags this.

**Failure modes specific to this slice:**
- `fs.watch` succeeds but events never fire (silent breakage on certain filesystems): not detectable by this slice. `fleet-lifecycle`'s polling fallback can be opt-in via the `pollIntervalMs` setting if the user adds `watchMode: 'poll'` to their profile.
- Watcher events fire after `stop()` was called: the `debounceHandle` check prevents stray `onChange` invocations because `stop` clears it.
- `repoPath/.git/` is itself absent or inaccessible: `fs.watch` throws; falls back to polling, which silently does nothing useful (since the porcelain re-list will also fail). `fleet-lifecycle` should have already aborted launch at the validation step before this slice attaches.

## §5 Sequence

**Attach (fleet-lifecycle §5 step 5):**
1. `fleet-lifecycle`'s `FleetController` reads `profile.watchMode` and `profile.pollIntervalMs`.
2. `new WorktreeWatcher(repoPath, () => controller.onWatcherChange(), profile.debounceMs ?? 250)`.
3. `watcher.start(profile.watchMode, profile.pollIntervalMs)`.
4. If the underlying `fs.watch` threw, the watcher silently fell back to polling. `fleet-lifecycle` reads `watcher.actualMode` (see §7 open question) and fires the one-time `NotificationsService.notice`.

**Event fire (any time after attach):**
1. `fs.FSWatcher` triggers the callback (or `setInterval` fires).
2. `debouncedFire` schedules `onChange` for `debounceMs` later, clearing any pending schedule.
3. After the debounce window with no further events: `onChange()` executes → `controller.onWatcherChange()` → `worktree-data.listFilteredWorktrees` → diff → add/remove panes.

**Detach (fleet-lifecycle §5 fleet-tab close):**
1. `FleetRegistry.unregister` calls `watcher.stop()`.
2. `stop` closes `fs.FSWatcher`, clears `pollHandle`, clears `debounceHandle`.
3. Cleanup completes within microseconds — spec §4's "Closing the fleet tab releases all filesystem monitoring within 100 ms" budget is met by orders of magnitude.

## §6 Out of scope

- Re-enumerating worktrees on `onChange` → [`worktree-data`](worktree-data.md).
- Diffing the new worktree set against currently open panes → [`fleet-lifecycle`](fleet-lifecycle.md).
- The one-time watch-mode notice on fallback → [`fleet-lifecycle`](fleet-lifecycle.md) §3 decision 7 (uses `NotificationsService.notice`).
- The `watchMode` and `pollIntervalMs` setting plumbing → [`profile-and-settings`](profile-and-settings.md).
- Detecting silent breakage of an established `fs.watch` (events stop firing without an error) — not feasible to detect from inside the watcher without adding a periodic health-check, which is out of scope for v0.1.
- Recursive watching of worktree contents — spec §3 Out explicitly excludes this.

## §7 Open questions

- The contract for "which mode is actually active after a fallback" needs a small addition. Options: (a) `start` returns the resolved mode `'fs' | 'poll'`; (b) `WorktreeWatcher.actualMode: 'fs' | 'poll' | null` getter; (c) caller passes a `onModeResolved(mode)` callback. Resolve at implementation time; (b) is the minimum-impact change to Appendix A.2 and the most direct read for `fleet-lifecycle`.

> If the parent spec is ambiguous on anything this slice depends on, stop and update the spec. Do not invent behavior here.
