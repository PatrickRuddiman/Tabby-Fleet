import * as path from 'path'
import { Worktree } from './porcelain'

export interface RepoInfo {
  name: string
  path: string
  mainBranch: string
  mainHead: string
}

export function worktreeToVars(wt: Worktree, repo: RepoInfo): Record<string, string> {
  if (wt.isMain) {
    return {
      path: repo.path,
      path_native: repo.path.replace(/\//g, path.sep),
      branch: repo.mainBranch,
      branch_short: repo.mainBranch,
      name: repo.name,
      head: repo.mainHead,
      head_short: repo.mainHead.slice(0, 7),
      repo: repo.name,
      repo_path: repo.path,
    }
  }

  const detachedTag = `(detached@${wt.head.slice(0, 7)})`
  const branch = wt.branch ?? detachedTag
  const branch_short = wt.branch
    ? wt.branch.includes('/')
      ? wt.branch.slice(wt.branch.indexOf('/') + 1)
      : wt.branch
    : detachedTag

  return {
    path: wt.path,
    path_native: wt.path.replace(/\//g, path.sep),
    branch,
    branch_short,
    name: wt.path.split('/').pop() ?? wt.path,
    head: wt.head,
    head_short: wt.head.slice(0, 7),
    repo: repo.name,
    repo_path: repo.path,
  }
}
