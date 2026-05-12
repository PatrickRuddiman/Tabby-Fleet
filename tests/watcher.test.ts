import { strict as assert } from 'assert'
import { WorktreeWatcher } from '../src/services/watcher.service'

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function porcelainFor(paths: string[]): string {
  return paths
    .map((p, i) => `worktree ${p}\nHEAD ${'0'.repeat(40 - i.toString().length) + i.toString()}\nbranch refs/heads/wt-${i}\n`)
    .join('\n')
}

describe('WorktreeWatcher (adaptive poller)', () => {
  it('initial snapshot does not fire onChange', async () => {
    let calls = 0
    const stub = async () => porcelainFor(['/repo/main'])
    const w = new WorktreeWatcher('/repo', () => { calls++ }, {
      runGitWorktreeList: stub,
      activeIntervalMs: 20,
      idleIntervalMs: 20,
      activeWindowMs: 1000,
      debounceMs: 10,
    })
    w.start()
    await delay(80)
    w.stop()
    assert.equal(calls, 0, `initial snapshot should be silent, got ${calls}`)
  })

  it('fires onChange exactly once after a single diff (debounced)', async () => {
    let calls = 0
    let snapshot = ['/repo/main']
    const stub = async () => porcelainFor(snapshot)
    const w = new WorktreeWatcher('/repo', () => { calls++ }, {
      runGitWorktreeList: stub,
      activeIntervalMs: 20,
      idleIntervalMs: 20,
      activeWindowMs: 1000,
      debounceMs: 30,
    })
    w.start()
    await delay(60)
    snapshot = ['/repo/main', '/repo/feat-x']
    await delay(120)
    w.stop()
    assert.equal(calls, 1, `expected exactly one onChange after diff, got ${calls}`)
  })

  it('debounce coalesces rapid back-to-back changes into a single onChange', async () => {
    let calls = 0
    let snapshot = ['/repo/main']
    const stub = async () => porcelainFor(snapshot)
    const w = new WorktreeWatcher('/repo', () => { calls++ }, {
      runGitWorktreeList: stub,
      activeIntervalMs: 10,
      idleIntervalMs: 10,
      activeWindowMs: 1000,
      debounceMs: 80,
    })
    w.start()
    await delay(40)
    snapshot = ['/repo/main', '/repo/a']
    await delay(20)
    snapshot = ['/repo/main', '/repo/a', '/repo/b']
    await delay(20)
    snapshot = ['/repo/main', '/repo/a', '/repo/b', '/repo/c']
    await delay(200)
    w.stop()
    assert.equal(calls, 1, `debounce should coalesce rapid changes, got ${calls}`)
  })

  it('stays in active cadence after a change, then backs off to idle', async () => {
    let invocations = 0
    let snapshot = ['/repo/main']
    const stub = async () => { invocations++; return porcelainFor(snapshot) }
    const w = new WorktreeWatcher('/repo', () => {}, {
      runGitWorktreeList: stub,
      activeIntervalMs: 20,
      idleIntervalMs: 200,
      activeWindowMs: 150,
      debounceMs: 5,
    })
    w.start()
    // Initial settle + trigger a change to enter active window.
    await delay(40)
    snapshot = ['/repo/main', '/repo/feat']
    await delay(80) // ~4 ticks at active 20ms
    const activeCount = invocations
    assert.ok(activeCount >= 4, `expected ≥4 invocations during active phase, got ${activeCount}`)
    // Now wait past activeWindowMs to drop into idle, then measure cadence.
    await delay(220) // past 150ms activeWindow
    const beforeIdle = invocations
    await delay(250) // ~1 tick at idle 200ms
    const idleDelta = invocations - beforeIdle
    w.stop()
    assert.ok(idleDelta <= 2, `expected ≤2 idle invocations in 250ms (interval 200ms), got ${idleDelta}`)
  })

  it('re-enters active cadence after an idle-phase change', async () => {
    let invocations = 0
    let snapshot = ['/repo/main']
    const stub = async () => { invocations++; return porcelainFor(snapshot) }
    const w = new WorktreeWatcher('/repo', () => {}, {
      runGitWorktreeList: stub,
      activeIntervalMs: 15,
      idleIntervalMs: 200,
      activeWindowMs: 80,
      debounceMs: 5,
    })
    w.start()
    await delay(120) // past activeWindowMs with no change → idle
    const beforeChange = invocations
    snapshot = ['/repo/main', '/repo/x']
    // Wait one idle tick to detect the change, then a few active ticks.
    await delay(280)
    const afterChange = invocations - beforeChange
    w.stop()
    assert.ok(afterChange >= 4, `expected re-entry into active cadence (≥4 ticks in 280ms after change), got ${afterChange}`)
  })

  it('stop() prevents pending debounced onChange from firing', async () => {
    let calls = 0
    let snapshot = ['/repo/main']
    const stub = async () => porcelainFor(snapshot)
    const w = new WorktreeWatcher('/repo', () => { calls++ }, {
      runGitWorktreeList: stub,
      activeIntervalMs: 10,
      idleIntervalMs: 10,
      activeWindowMs: 1000,
      debounceMs: 200,
    })
    w.start()
    await delay(40)
    snapshot = ['/repo/main', '/repo/x']
    await delay(30)
    w.stop()
    await delay(300)
    assert.equal(calls, 0, `stop() should cancel pending debounce, got ${calls}`)
  })

  it('double-stop is idempotent', () => {
    const w = new WorktreeWatcher('/repo', () => {}, {
      runGitWorktreeList: async () => '',
    })
    w.start()
    w.stop()
    w.stop()
  })

  it('double-start is idempotent', async () => {
    let invocations = 0
    const stub = async () => { invocations++; return porcelainFor(['/repo/main']) }
    const w = new WorktreeWatcher('/repo', () => {}, {
      runGitWorktreeList: stub,
      activeIntervalMs: 30,
      idleIntervalMs: 30,
      activeWindowMs: 1000,
      debounceMs: 5,
    })
    w.start()
    w.start() // second call must be a no-op
    await delay(70)
    w.stop()
    // Two concurrent tick chains would roughly double the invocation count.
    // We expect ~2-3 ticks in 70ms at 30ms cadence, not 4-6.
    assert.ok(invocations <= 3, `expected ≤3 invocations from single tick chain, got ${invocations}`)
  })

  it('continues ticking after a git invocation error', async () => {
    let calls = 0
    let invocations = 0
    let fail = true
    const stub = async () => {
      invocations++
      if (fail) throw new Error('simulated git failure')
      return porcelainFor(['/repo/main', '/repo/recovered'])
    }
    const w = new WorktreeWatcher('/repo', () => { calls++ }, {
      runGitWorktreeList: stub,
      activeIntervalMs: 20,
      idleIntervalMs: 20,
      activeWindowMs: 1000,
      debounceMs: 10,
    })
    w.start()
    await delay(80) // several failing ticks
    fail = false
    await delay(80) // recovery + first snapshot stored
    await delay(80) // subsequent identical ticks
    w.stop()
    assert.ok(invocations >= 6, `watcher should keep ticking through errors, got ${invocations}`)
    // No diff after recovery (first successful tick is the snapshot baseline).
    assert.equal(calls, 0)
  })
})
