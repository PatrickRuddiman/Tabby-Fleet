import { strict as assert } from 'assert'
import * as path from 'path'
import { worktreeToVars, RepoInfo } from '../src/utils/vars'
import { Worktree } from '../src/utils/porcelain'

const REPO: RepoInfo = {
  name: 'wineapi',
  path: 'C:/dev/wineapi',
  mainBranch: 'main',
  mainHead: 'abcdef1234567890abcdef1234567890abcdef12',
}

function makeWorktree(partial: Partial<Worktree>): Worktree {
  return {
    path: '',
    head: '0000000000000000000000000000000000000000',
    branch: null,
    locked: false,
    lockedReason: null,
    prunable: false,
    prunableReason: null,
    isMain: false,
    ...partial,
  }
}

describe('vars', () => {
  describe('worktreeToVars', () => {
    it('main worktree pulls every variable from RepoInfo', () => {
      const wt = makeWorktree({
        path: 'C:/dev/wineapi',
        head: REPO.mainHead,
        branch: 'main',
        isMain: true,
      })
      const vars = worktreeToVars(wt, REPO)
      assert.equal(vars.path, 'C:/dev/wineapi')
      assert.equal(vars.branch, 'main')
      assert.equal(vars.branch_short, 'main')
      assert.equal(vars.name, 'wineapi')
      assert.equal(vars.head, REPO.mainHead)
      assert.equal(vars.head_short, 'abcdef1')
      assert.equal(vars.repo, 'wineapi')
      assert.equal(vars.repo_path, 'C:/dev/wineapi')
    })

    it('regular worktree with slashed branch strips the first slash-segment for branch_short', () => {
      const wt = makeWorktree({
        path: 'C:/dev/wineapi/.claude/worktrees/add-stripe',
        head: '1111111111111111111111111111111111111111',
        branch: 'agent/add-stripe-webhooks',
      })
      const vars = worktreeToVars(wt, REPO)
      assert.equal(vars.branch, 'agent/add-stripe-webhooks')
      assert.equal(vars.branch_short, 'add-stripe-webhooks')
      assert.equal(vars.name, 'add-stripe')
      assert.equal(vars.head_short, '1111111')
    })

    it('regular worktree with slashless branch keeps the branch as-is for branch_short', () => {
      const wt = makeWorktree({
        path: 'C:/dev/wineapi/.claude/worktrees/local-fix',
        head: '2222222222222222222222222222222222222222',
        branch: 'hotfix',
      })
      const vars = worktreeToVars(wt, REPO)
      assert.equal(vars.branch, 'hotfix')
      assert.equal(vars.branch_short, 'hotfix')
    })

    it('detached worktree substitutes synthetic identifier for branch and branch_short', () => {
      const wt = makeWorktree({
        path: 'C:/dev/wineapi/.claude/worktrees/detached-wt',
        head: '3333333333333333333333333333333333333333',
        branch: null,
      })
      const vars = worktreeToVars(wt, REPO)
      assert.equal(vars.branch, '(detached@3333333)')
      assert.equal(vars.branch_short, '(detached@3333333)')
    })

    it('path_native uses the native separator', () => {
      const wt = makeWorktree({
        path: 'C:/dev/wineapi/.claude/worktrees/x',
        head: '4444444444444444444444444444444444444444',
        branch: 'agent/x',
      })
      const vars = worktreeToVars(wt, REPO)
      assert.equal(vars.path_native, ['C:', 'dev', 'wineapi', '.claude', 'worktrees', 'x'].join(path.sep))
    })

    it('head_short is exactly the first 7 chars of head', () => {
      const wt = makeWorktree({
        path: 'C:/dev/wineapi/.claude/worktrees/x',
        head: 'deadbeefcafebabe1234567890abcdef12345678',
        branch: 'agent/x',
      })
      const vars = worktreeToVars(wt, REPO)
      assert.equal(vars.head_short, 'deadbee')
      assert.equal(vars.head_short.length, 7)
    })
  })
})
