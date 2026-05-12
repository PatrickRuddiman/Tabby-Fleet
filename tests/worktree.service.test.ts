import { strict as assert } from 'assert'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  validateRepoPath,
  describeRepo,
  listFilteredWorktrees,
} from '../src/services/worktree.service'

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
}

function createTempRepo(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-test-')))
  execSync('git init -b main', { cwd: dir, env: GIT_ENV, stdio: 'pipe' })
  execSync('git commit --allow-empty -m initial', { cwd: dir, env: GIT_ENV, stdio: 'pipe' })
  return dir
}

function cleanupTempDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    // best-effort cleanup; windows filesystem locks sometimes prevent immediate removal
  }
}

describe('worktree.service', () => {
  describe('validateRepoPath', () => {
    let repoDir = ''

    beforeEach(() => {
      repoDir = createTempRepo()
    })

    afterEach(() => {
      cleanupTempDir(repoDir)
    })

    it('returns ok for a real git repo', async () => {
      const result = await validateRepoPath(repoDir)
      assert.equal(result.ok, true)
    })

    it("returns kind 'not-a-repo' for a directory without .git", async () => {
      const nonRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-nonrepo-'))
      try {
        const result = await validateRepoPath(nonRepo)
        assert.equal(result.ok, false)
        if (!result.ok) {
          assert.equal(result.error.kind, 'not-a-repo')
        }
      } finally {
        cleanupTempDir(nonRepo)
      }
    })

    it("returns kind 'not-a-repo' for a non-existent path", async () => {
      const result = await validateRepoPath(path.join(os.tmpdir(), 'definitely-not-a-real-path-xyz123'))
      assert.equal(result.ok, false)
      if (!result.ok) {
        assert.equal(result.error.kind, 'not-a-repo')
      }
    })
  })

  describe('describeRepo', () => {
    let repoDir = ''

    beforeEach(() => {
      repoDir = createTempRepo()
    })

    afterEach(() => {
      cleanupTempDir(repoDir)
    })

    it('returns ok with main branch and at least one worktree', async () => {
      const result = await describeRepo(repoDir)
      assert.equal(result.ok, true)
      if (result.ok) {
        assert.equal(result.value.repo.mainBranch, 'main')
        assert.equal(result.value.worktrees.length >= 1, true)
        assert.equal(result.value.worktrees[0].isMain, true)
        assert.equal(result.value.repo.name, path.basename(repoDir))
      }
    })
  })

  describe('listFilteredWorktrees', () => {
    let repoDir = ''

    beforeEach(() => {
      repoDir = createTempRepo()
    })

    afterEach(() => {
      cleanupTempDir(repoDir)
    })

    it('returns every worktree git knows about (no path-prefix filtering)', async () => {
      // worktreePathPrefix was dropped — worktrees can live anywhere on disk.
      execSync('git worktree add wt-a -b agent/a', { cwd: repoDir, env: GIT_ENV, stdio: 'pipe' })
      execSync('git worktree add wt-b -b agent/b', { cwd: repoDir, env: GIT_ENV, stdio: 'pipe' })

      const result = await listFilteredWorktrees(repoDir, {
        repoPath: repoDir,
        includeDetached: false,
        includePrunable: false,
        includeLocked: true,
      })
      assert.equal(result.ok, true)
      if (result.ok) {
        assert.equal(result.value.worktrees.length, 3) // main + a + b
        assert.equal(result.value.worktrees[0].isMain, true)
        const branches = result.value.worktrees.slice(1).map(w => w.branch).sort()
        assert.deepEqual(branches, ['agent/a', 'agent/b'])
      }
    })
  })
})
