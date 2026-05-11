import * as fs from 'fs'
import * as path from 'path'

export type WatchMode = 'fs' | 'poll'

/**
 * Watches `<repoPath>/.git/worktrees/` for changes and fires a single, debounced
 * `onChange` callback per settled burst. Falls back from `fs.watch` to polling
 * when the underlying filesystem rejects `fs.watch` (network shares, certain
 * Docker / WSL setups). Idempotent `stop()`. Read `actualMode` after `start()`
 * to learn which mode is live (relevant for fleet-lifecycle's one-time notice).
 */
export class WorktreeWatcher {
  private watcher: fs.FSWatcher | null = null
  private pollHandle: NodeJS.Timeout | null = null
  private debounceHandle: NodeJS.Timeout | null = null
  private _actualMode: WatchMode | null = null

  constructor(
    private repoPath: string,
    private onChange: () => void,
    private debounceMs: number = 250,
  ) {}

  get actualMode(): WatchMode | null {
    return this._actualMode
  }

  start(mode: WatchMode, pollIntervalMs: number = 5000): void {
    if (mode === 'fs') {
      try {
        const worktreesDir = path.join(this.repoPath, '.git', 'worktrees')
        if (fs.existsSync(worktreesDir)) {
          this.watcher = fs.watch(worktreesDir, { persistent: false }, () => {
            this.debouncedFire()
          })
        } else {
          const gitDir = path.join(this.repoPath, '.git')
          this.watcher = fs.watch(gitDir, { persistent: false }, (_eventType, filename) => {
            if (filename === 'worktrees') this.debouncedFire()
          })
        }
        this._actualMode = 'fs'
        return
      } catch (err) {
        // network share / unsupported fs / missing dir — fall back to polling
        console.warn('FS watch failed, falling back to polling:', err)
      }
    }
    this.startPolling(pollIntervalMs)
    this._actualMode = 'poll'
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
    if (this.pollHandle) {
      clearInterval(this.pollHandle)
      this.pollHandle = null
    }
    if (this.debounceHandle) {
      clearTimeout(this.debounceHandle)
      this.debounceHandle = null
    }
    this._actualMode = null
  }

  private startPolling(intervalMs: number): void {
    this.pollHandle = setInterval(() => this.debouncedFire(), intervalMs)
  }

  private debouncedFire(): void {
    if (this.debounceHandle) clearTimeout(this.debounceHandle)
    this.debounceHandle = setTimeout(() => {
      this.debounceHandle = null
      this.onChange()
    }, this.debounceMs)
  }
}
