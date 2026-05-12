import * as path from 'path'

export interface Worktree {
  path: string
  head: string
  branch: string | null
  locked: boolean
  lockedReason: string | null
  prunable: boolean
  prunableReason: string | null
  isMain: boolean
}

export interface FilterOptions {
  repoPath: string
  includeDetached: boolean
  includePrunable: boolean
  includeLocked: boolean
}

export function parseWorktreeListPorcelain(stdout: string): Worktree[] {
  const blocks = stdout.split(/\r?\n\r?\n+/).filter(b => b.trim().length > 0)
  const worktrees = blocks
    .map(parseBlock)
    .filter((wt): wt is Worktree => wt !== null)
  if (worktrees.length > 0) {
    worktrees[0].isMain = true
  }
  return worktrees
}

function parseBlock(block: string): Worktree | null {
  const lines = block.split(/\r?\n/).filter(l => l.length > 0)
  const wt: Partial<Worktree> = {
    locked: false,
    lockedReason: null,
    prunable: false,
    prunableReason: null,
    isMain: false,
  }

  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      wt.path = line.slice('worktree '.length).trim()
    } else if (line.startsWith('HEAD ')) {
      wt.head = line.slice('HEAD '.length).trim()
    } else if (line === 'detached') {
      wt.branch = null
    } else if (line.startsWith('branch ')) {
      const ref = line.slice('branch '.length).trim()
      wt.branch = ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref
    } else if (line === 'locked') {
      wt.locked = true
    } else if (line.startsWith('locked ')) {
      wt.locked = true
      wt.lockedReason = line.slice('locked '.length).trim()
    } else if (line === 'prunable') {
      wt.prunable = true
    } else if (line.startsWith('prunable ')) {
      wt.prunable = true
      wt.prunableReason = line.slice('prunable '.length).trim()
    }
  }

  if (!wt.path || !wt.head) return null
  if (wt.branch === undefined) wt.branch = null
  return wt as Worktree
}

export function filterAndSortWorktrees(all: Worktree[], options: FilterOptions): Worktree[] {
  if (all.length === 0) return []
  const main = all[0]
  const candidates = all.slice(1)

  const filtered = candidates.filter(wt => {
    if (wt.branch === null && !options.includeDetached) return false
    if (wt.prunable && !options.includePrunable) return false
    if (wt.locked && !options.includeLocked) return false
    return true
  })

  filtered.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  return [main, ...filtered]
}
