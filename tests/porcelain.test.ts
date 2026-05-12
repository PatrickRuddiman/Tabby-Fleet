import { strict as assert } from 'assert'
import {
  parseWorktreeListPorcelain,
  filterAndSortWorktrees,
  Worktree,
} from '../src/utils/porcelain'

const STANDARD = [
  'worktree /repo',
  'HEAD abcdef1234567890abcdef1234567890abcdef12',
  'branch refs/heads/main',
  '',
  'worktree /repo/.claude/worktrees/feature-a',
  'HEAD 1111111111111111111111111111111111111111',
  'branch refs/heads/agent/feature-a',
  '',
  'worktree /repo/.claude/worktrees/feature-b',
  'HEAD 2222222222222222222222222222222222222222',
  'branch refs/heads/agent/feature-b',
  '',
].join('\n')

const DETACHED = [
  'worktree /repo',
  'HEAD aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'branch refs/heads/main',
  '',
  'worktree /repo/.claude/worktrees/detached-wt',
  'HEAD bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  'detached',
  '',
].join('\n')

const LOCKED_WITH_REASON = [
  'worktree /repo',
  'HEAD cccccccccccccccccccccccccccccccccccccccc',
  'branch refs/heads/main',
  '',
  'worktree /repo/.claude/worktrees/locked-wt',
  'HEAD dddddddddddddddddddddddddddddddddddddddd',
  'branch refs/heads/agent/locked',
  'locked maintenance window',
  '',
].join('\n')

const PRUNABLE_WITH_REASON = [
  'worktree /repo',
  'HEAD eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  'branch refs/heads/main',
  '',
  'worktree /repo/.claude/worktrees/prunable-wt',
  'HEAD ffffffffffffffffffffffffffffffffffffffff',
  'branch refs/heads/agent/prunable',
  'prunable gitdir file does not exist',
  '',
].join('\n')

const CRLF = STANDARD.replace(/\n/g, '\r\n')

const DEFAULT_FILTER = {
  repoPath: '/repo',
  includeDetached: false,
  includePrunable: false,
  includeLocked: true,
}

describe('porcelain', () => {
describe('parseWorktreeListPorcelain', () => {
  it('parses a 3-worktree standard output', () => {
    const result = parseWorktreeListPorcelain(STANDARD)
    assert.equal(result.length, 3)
    assert.equal(result[0].path, '/repo')
    assert.equal(result[0].branch, 'main')
    assert.equal(result[1].path, '/repo/.claude/worktrees/feature-a')
    assert.equal(result[1].branch, 'agent/feature-a')
    assert.equal(result[2].branch, 'agent/feature-b')
  })

  it('marks the first worktree as main', () => {
    const result = parseWorktreeListPorcelain(STANDARD)
    assert.equal(result[0].isMain, true)
    assert.equal(result[1].isMain, false)
    assert.equal(result[2].isMain, false)
  })

  it('handles a detached worktree (branch is null)', () => {
    const result = parseWorktreeListPorcelain(DETACHED)
    assert.equal(result.length, 2)
    assert.equal(result[1].branch, null)
  })

  it('handles a locked worktree with reason', () => {
    const result = parseWorktreeListPorcelain(LOCKED_WITH_REASON)
    const locked = result[1]
    assert.equal(locked.locked, true)
    assert.equal(locked.lockedReason, 'maintenance window')
  })

  it('handles a prunable worktree with reason', () => {
    const result = parseWorktreeListPorcelain(PRUNABLE_WITH_REASON)
    const prunable = result[1]
    assert.equal(prunable.prunable, true)
    assert.equal(prunable.prunableReason, 'gitdir file does not exist')
  })

  it('handles CRLF line endings', () => {
    const result = parseWorktreeListPorcelain(CRLF)
    assert.equal(result.length, 3)
    assert.equal(result[0].path, '/repo')
    assert.equal(result[1].path, '/repo/.claude/worktrees/feature-a')
  })

  it('returns empty array for empty input', () => {
    assert.deepEqual(parseWorktreeListPorcelain(''), [])
  })
})

describe('filterAndSortWorktrees', () => {
  it('always retains the main worktree, even if its path is outside the prefix', () => {
    const all = parseWorktreeListPorcelain(STANDARD)
    const result = filterAndSortWorktrees(all, DEFAULT_FILTER)
    assert.equal(result[0].path, '/repo')
    assert.equal(result[0].isMain, true)
  })

  it('keeps all non-main worktrees regardless of on-disk location', () => {
    // worktreePathPrefix filtering was dropped — `git worktree list` is the
    // source of truth, so worktrees can live anywhere.
    const stdout = [
      'worktree /repo',
      'HEAD aa',
      'branch refs/heads/main',
      '',
      'worktree /some/totally/different/place',
      'HEAD bb',
      'branch refs/heads/agent/outside',
      '',
      'worktree /repo/.claude/worktrees/inside',
      'HEAD cc',
      'branch refs/heads/agent/inside',
      '',
    ].join('\n')
    const all = parseWorktreeListPorcelain(stdout)
    const result = filterAndSortWorktrees(all, DEFAULT_FILTER)
    assert.equal(result.length, 3)
  })

  it('excludes detached worktrees when includeDetached is false', () => {
    const all = parseWorktreeListPorcelain(DETACHED)
    const result = filterAndSortWorktrees(all, DEFAULT_FILTER)
    assert.equal(result.length, 1)
    assert.equal(result[0].path, '/repo')
  })

  it('includes detached worktrees when includeDetached is true', () => {
    const all = parseWorktreeListPorcelain(DETACHED)
    const result = filterAndSortWorktrees(all, { ...DEFAULT_FILTER, includeDetached: true })
    assert.equal(result.length, 2)
    assert.equal(result[1].branch, null)
  })

  it('sorts survivors by path ascending', () => {
    const stdout = [
      'worktree /repo',
      'HEAD aa',
      'branch refs/heads/main',
      '',
      'worktree /repo/.claude/worktrees/zebra',
      'HEAD bb',
      'branch refs/heads/agent/zebra',
      '',
      'worktree /repo/.claude/worktrees/alpha',
      'HEAD cc',
      'branch refs/heads/agent/alpha',
      '',
      'worktree /repo/.claude/worktrees/middle',
      'HEAD dd',
      'branch refs/heads/agent/middle',
      '',
    ].join('\n')
    const all = parseWorktreeListPorcelain(stdout)
    const result = filterAndSortWorktrees(all, DEFAULT_FILTER)
    assert.deepEqual(
      result.slice(1).map(w => w.path),
      [
        '/repo/.claude/worktrees/alpha',
        '/repo/.claude/worktrees/middle',
        '/repo/.claude/worktrees/zebra',
      ],
    )
  })

  it('excludes locked worktrees when includeLocked is false', () => {
    const all = parseWorktreeListPorcelain(LOCKED_WITH_REASON)
    const result = filterAndSortWorktrees(all, { ...DEFAULT_FILTER, includeLocked: false })
    assert.equal(result.length, 1)
  })

  it('excludes prunable worktrees when includePrunable is false', () => {
    const all = parseWorktreeListPorcelain(PRUNABLE_WITH_REASON)
    const result = filterAndSortWorktrees(all, DEFAULT_FILTER)
    assert.equal(result.length, 1)
  })
})
})
