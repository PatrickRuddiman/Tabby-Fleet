import { execFile, ExecFileException } from 'child_process'
import { parseWorktreeListPorcelain } from '../utils/porcelain'

export interface WorktreeWatcherOptions {
  activeIntervalMs?: number
  idleIntervalMs?: number
  activeWindowMs?: number
  debounceMs?: number
  /** Override for tests: returns the stdout of `git worktree list --porcelain`. */
  runGitWorktreeList?: (repoPath: string) => Promise<string>
}

const DEFAULTS = {
  activeIntervalMs: 500,
  idleIntervalMs: 10000,
  activeWindowMs: 60000,
  debounceMs: 250,
}

function defaultRunGitWorktreeList(repoPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', ['-C', repoPath, 'worktree', 'list', '--porcelain'], { timeout: 5000 }, (err, stdout) => {
      if (err) reject(err)
      else resolve(stdout)
    })
  })
}

/**
 * Polls `git worktree list --porcelain` at an adaptive cadence and fires a
 * debounced `onChange` whenever the set of worktree paths changes. Stays in
 * active cadence (~500ms) for `activeWindowMs` after the last detected change,
 * then backs off to idle cadence (~10s). No filesystem watcher — `git worktree
 * list` is the single source of truth, so worktrees can live anywhere on disk.
 */
export class WorktreeWatcher {
  private readonly opts: Required<Omit<WorktreeWatcherOptions, 'runGitWorktreeList'>>
  private readonly runGitWorktreeList: (repoPath: string) => Promise<string>
  private tickHandle: NodeJS.Timeout | null = null
  private debounceHandle: NodeJS.Timeout | null = null
  private running = false
  private lastSnapshot: Set<string> | null = null
  private lastChangeAt = 0
  private lastErrorLogAt = 0

  constructor(
    private readonly repoPath: string,
    private readonly onChange: () => void,
    options: WorktreeWatcherOptions = {},
  ) {
    const { runGitWorktreeList, ...rest } = options
    this.opts = { ...DEFAULTS, ...rest }
    this.runGitWorktreeList = runGitWorktreeList ?? defaultRunGitWorktreeList
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.lastSnapshot = null
    this.lastChangeAt = Date.now()
    this.scheduleNext(0)
  }

  stop(): void {
    this.running = false
    if (this.tickHandle) {
      clearTimeout(this.tickHandle)
      this.tickHandle = null
    }
    if (this.debounceHandle) {
      clearTimeout(this.debounceHandle)
      this.debounceHandle = null
    }
  }

  private scheduleNext(delayMs: number): void {
    if (!this.running) return
    this.tickHandle = setTimeout(() => this.tick(), delayMs)
  }

  private async tick(): Promise<void> {
    if (!this.running) return
    try {
      const paths = await this.listWorktreePaths()
      if (this.lastSnapshot === null) {
        this.lastSnapshot = paths
      } else if (!setsEqual(paths, this.lastSnapshot)) {
        this.lastSnapshot = paths
        this.lastChangeAt = Date.now()
        this.debouncedFire()
      }
    } catch (err) {
      this.logErrorThrottled(err)
    }
    if (!this.running) return
    const elapsed = Date.now() - this.lastChangeAt
    const next = elapsed < this.opts.activeWindowMs ? this.opts.activeIntervalMs : this.opts.idleIntervalMs
    this.scheduleNext(next)
  }

  private async listWorktreePaths(): Promise<Set<string>> {
    const stdout = await this.runGitWorktreeList(this.repoPath)
    const worktrees = parseWorktreeListPorcelain(stdout)
    const isWindows = process.platform === 'win32'
    return new Set(worktrees.map(w => isWindows ? w.path.toLowerCase() : w.path))
  }

  private debouncedFire(): void {
    if (this.debounceHandle) clearTimeout(this.debounceHandle)
    this.debounceHandle = setTimeout(() => {
      this.debounceHandle = null
      this.onChange()
    }, this.opts.debounceMs)
  }

  private logErrorThrottled(err: unknown): void {
    const now = Date.now()
    if (now - this.lastErrorLogAt < 60000) return
    this.lastErrorLogAt = now
    const e = err as ExecFileException
    console.warn(`WorktreeWatcher: git worktree list failed in ${this.repoPath}:`, e?.message ?? err)
  }
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}
