import { strict as assert } from 'assert'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { WorktreeWatcher } from '../src/services/watcher.service'

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function createRepoWithWorktreesDir(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-watch-')))
  fs.mkdirSync(path.join(dir, '.git', 'worktrees'), { recursive: true })
  return dir
}

function cleanup(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    // best-effort cleanup
  }
}

describe('watcher', () => {
  describe('WorktreeWatcher', () => {
    it('debounce coalesces rapid changes into a single onChange call', async () => {
      const repo = createRepoWithWorktreesDir()
      try {
        let calls = 0
        const watcher = new WorktreeWatcher(repo, () => { calls++ }, 80)
        watcher.start('fs')
        // Rapid burst: create three files in quick succession, within the debounce window.
        const wtDir = path.join(repo, '.git', 'worktrees')
        fs.writeFileSync(path.join(wtDir, 'a'), '')
        fs.writeFileSync(path.join(wtDir, 'b'), '')
        fs.writeFileSync(path.join(wtDir, 'c'), '')
        // Wait long enough for the debounce window to settle.
        await delay(300)
        watcher.stop()
        assert.equal(calls, 1, `expected exactly 1 coalesced call, got ${calls}`)
      } finally {
        cleanup(repo)
      }
    })

    it('double-stop is idempotent and does not throw', () => {
      const watcher = new WorktreeWatcher(os.tmpdir(), () => {}, 50)
      watcher.start('poll', 100)
      watcher.stop()
      watcher.stop() // second call must not throw
    })

    it("start('poll', N) fires onChange after the interval", async () => {
      let calls = 0
      const watcher = new WorktreeWatcher(os.tmpdir(), () => { calls++ }, 50)
      watcher.start('poll', 80)
      assert.equal(watcher.actualMode, 'poll')
      // After 80ms (interval) + 50ms (debounce) the first call fires. Wait extra.
      await delay(250)
      watcher.stop()
      assert.equal(calls >= 1, true, `expected at least one onChange, got ${calls}`)
    })

    it('stop() prevents a pending debounced onChange from firing', async () => {
      const repo = createRepoWithWorktreesDir()
      try {
        let calls = 0
        const watcher = new WorktreeWatcher(repo, () => { calls++ }, 200)
        watcher.start('fs')
        const wtDir = path.join(repo, '.git', 'worktrees')
        fs.writeFileSync(path.join(wtDir, 'a'), '')
        // Stop while debounce timer is pending.
        await delay(20)
        watcher.stop()
        await delay(400)
        assert.equal(calls, 0, `expected 0 calls after stop-during-debounce, got ${calls}`)
      } finally {
        cleanup(repo)
      }
    })

    it('integration: file appearing under .git/worktrees/ triggers onChange within 500 ms', async () => {
      const repo = createRepoWithWorktreesDir()
      try {
        let calls = 0
        const watcher = new WorktreeWatcher(repo, () => { calls++ }, 80)
        const start = Date.now()
        watcher.start('fs')
        assert.equal(watcher.actualMode, 'fs')
        fs.writeFileSync(path.join(repo, '.git', 'worktrees', 'new-feature'), '')
        // Poll until onChange has fired or 500 ms elapses.
        while (calls === 0 && Date.now() - start < 500) {
          await delay(20)
        }
        watcher.stop()
        assert.equal(calls >= 1, true, `expected at least one onChange within 500 ms, got ${calls}`)
      } finally {
        cleanup(repo)
      }
    })
  })
})
