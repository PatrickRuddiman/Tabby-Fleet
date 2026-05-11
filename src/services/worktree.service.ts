import { exec } from 'child_process'
import * as path from 'path'
import { promisify } from 'util'
import {
  parseWorktreeListPorcelain,
  filterAndSortWorktrees,
  Worktree,
  FilterOptions,
} from '../utils/porcelain'
import { RepoInfo } from '../utils/vars'

const execAsync = promisify(exec)

export type GitErrorKind = 'not-a-repo' | 'git-not-found' | 'timeout' | 'parse-error'

export type GitError = {
  kind: GitErrorKind
  message: string
  stderr?: string
  exitCode?: number
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: GitError }
export type ValidateResult = { ok: true } | { ok: false; error: GitError }
export type DescribeResult = Result<{ repo: RepoInfo; worktrees: Worktree[] }>
export type ListResult = Result<{ repo: RepoInfo; worktrees: Worktree[] }>

const VALIDATE_TIMEOUT_MS = 2000
const DESCRIBE_TIMEOUT_MS = 10000

function classifyExecError(err: any): GitError {
  if (err?.code === 'ENOENT') {
    return { kind: 'git-not-found', message: 'git executable not found on PATH' }
  }
  if (err?.killed || err?.signal === 'SIGTERM' || err?.signal === 'SIGKILL') {
    return { kind: 'timeout', message: 'git command exceeded its timeout' }
  }
  const stderr = String(err?.stderr ?? '')
  const stdout = String(err?.stdout ?? '')
  if (
    /not a git repository/i.test(stderr) ||
    /not a git repository/i.test(stdout) ||
    /No such file or directory/i.test(stderr) ||
    /cannot find the path/i.test(stderr)
  ) {
    return {
      kind: 'not-a-repo',
      message: 'path is not a git repository',
      stderr: stderr.trim() || undefined,
      exitCode: typeof err?.code === 'number' ? err.code : undefined,
    }
  }
  return {
    kind: 'not-a-repo',
    message: err?.message ?? 'git command failed',
    stderr: stderr.trim() || undefined,
    exitCode: typeof err?.code === 'number' ? err.code : undefined,
  }
}

function normalisePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '')
}

export const validateRepoPath = async (repoPath: string): Promise<ValidateResult> => {
  try {
    await execAsync(`git -C "${repoPath}" rev-parse --git-dir`, { timeout: VALIDATE_TIMEOUT_MS })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: classifyExecError(err) }
  }
}

export const describeRepo = async (repoPath: string): Promise<DescribeResult> => {
  try {
    const [branchResult, listResult] = await Promise.all([
      execAsync(`git -C "${repoPath}" rev-parse --abbrev-ref HEAD`, { timeout: DESCRIBE_TIMEOUT_MS }),
      execAsync(`git -C "${repoPath}" worktree list --porcelain`, { timeout: DESCRIBE_TIMEOUT_MS }),
    ])
    const mainBranch = String(branchResult.stdout).trim()
    const worktrees = parseWorktreeListPorcelain(String(listResult.stdout))
    if (worktrees.length === 0) {
      return {
        ok: false,
        error: { kind: 'parse-error', message: 'git worktree list returned no records' },
      }
    }
    const normalisedRepoPath = normalisePath(repoPath)
    const repo: RepoInfo = {
      name: path.basename(normalisedRepoPath),
      path: normalisedRepoPath,
      mainBranch,
      mainHead: worktrees[0].head,
    }
    return { ok: true, value: { repo, worktrees } }
  } catch (err) {
    return { ok: false, error: classifyExecError(err) }
  }
}

export const listFilteredWorktrees = async (
  repoPath: string,
  options: FilterOptions,
): Promise<ListResult> => {
  const described = await describeRepo(repoPath)
  if (!described.ok) return described
  const filtered = filterAndSortWorktrees(described.value.worktrees, options)
  return { ok: true, value: { repo: described.value.repo, worktrees: filtered } }
}
