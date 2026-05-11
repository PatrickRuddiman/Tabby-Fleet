import { strict as assert } from 'assert'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { SplitTabComponent } from 'tabby-core'
import { FleetController, FleetRegistry } from '../src/services/fleet.registry'
import { DEFAULT_PROFILE_OPTIONS } from '../src/api'
import { Worktree } from '../src/utils/porcelain'
import { RepoInfo } from '../src/utils/vars'

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
}

function createTempRepo(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-ctl-')))
  execSync('git init -b main', { cwd: dir, env: GIT_ENV, stdio: 'pipe' })
  execSync('git commit --allow-empty -m initial', { cwd: dir, env: GIT_ENV, stdio: 'pipe' })
  return dir
}

function cleanupTempDir(dir: string): void {
  try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* noop */ }
}

function addWorktreeOnDisk(repo: string, name: string): void {
  execSync(`git worktree add .claude/worktrees/${name} -b agent/${name}`, {
    cwd: repo,
    env: GIT_ENV,
    stdio: 'pipe',
  })
}

const REPO: RepoInfo = {
  name: 'wineapi',
  path: '/repo',
  mainBranch: 'main',
  mainHead: 'abcdef1234567890abcdef1234567890abcdef12',
}

function makeWorktree(partial: Partial<Worktree>): Worktree {
  return {
    path: '/repo',
    head: '0000000000000000000000000000000000000000',
    branch: 'main',
    locked: false,
    lockedReason: null,
    prunable: false,
    prunableReason: null,
    isMain: false,
    ...partial,
  }
}

describe('fleet.registry', () => {
  describe('FleetRegistry', () => {
    let registry: FleetRegistry
    let splitTab: SplitTabComponent

    beforeEach(() => {
      registry = new FleetRegistry()
      splitTab = new SplitTabComponent()
    })

    it('register adds the controller to the internal map', () => {
      const controller = registry.register(splitTab, DEFAULT_PROFILE_OPTIONS, 'p1')
      assert.equal(registry.size(), 1)
      assert.equal(registry.get(splitTab), controller)
    })

    it("register adds the 'fleet-tab' class to the SplitTabComponent host", () => {
      registry.register(splitTab, DEFAULT_PROFILE_OPTIONS, 'p1')
      const list = (splitTab as any).elementRef.nativeElement.classList
      assert.equal(list.contains('fleet-tab'), true)
    })

    it("register writes the '--fleet-zoom-duration' CSS custom property", () => {
      registry.register(splitTab, { ...DEFAULT_PROFILE_OPTIONS, zoomTransitionMs: 250 }, 'p1')
      const style = (splitTab as any).elementRef.nativeElement.style
      assert.equal(style.getPropertyValue('--fleet-zoom-duration'), '250ms')
    })

    it('unregister removes the controller and clears the fleet-tab class', () => {
      registry.register(splitTab, DEFAULT_PROFILE_OPTIONS, 'p1')
      registry.unregister(splitTab)
      assert.equal(registry.size(), 0)
      assert.equal(registry.get(splitTab), null)
      const list = (splitTab as any).elementRef.nativeElement.classList
      assert.equal(list.contains('fleet-tab'), false)
    })

    it('applyRatios calls splitTab.layout()', () => {
      const controller = registry.register(splitTab, DEFAULT_PROFILE_OPTIONS, 'p1')
      const before = (splitTab as any)._layoutCalls
      controller.applyRatios([])
      const after = (splitTab as any)._layoutCalls
      assert.equal(after, before + 1)
    })

    it('addPaneForWorktree calls splitTab.add with the correct relative + side', async () => {
      const controller = registry.register(splitTab, DEFAULT_PROFILE_OPTIONS, 'p1')
      // Root pane: relative null, side 'r'
      await controller.addPaneForWorktree(makeWorktree({ path: '/repo', isMain: true }), REPO, { isRoot: true })
      // First worktree: relative root, side 'r'
      await controller.addPaneForWorktree(
        makeWorktree({ path: '/repo/.claude/worktrees/a', branch: 'agent/a' }),
        REPO,
      )
      // Second worktree: relative previous worktree, side 'b'
      await controller.addPaneForWorktree(
        makeWorktree({ path: '/repo/.claude/worktrees/b', branch: 'agent/b' }),
        REPO,
      )
      const calls = (splitTab as any)._addTabCalls
      assert.equal(calls.length, 3)
      assert.equal(calls[0].relative, null)
      assert.equal(calls[0].side, 'r')
      assert.equal(calls[1].side, 'r')
      assert.equal(calls[1].relative, calls[0].tab) // worktree-1 relative to root
      assert.equal(calls[2].side, 'b')
      assert.equal(calls[2].relative, calls[1].tab) // worktree-2 relative to worktree-1
    })

    it("getRecoveryToken returns type='agent-fleet' and panes.length matching the registry", async () => {
      const controller = registry.register(splitTab, DEFAULT_PROFILE_OPTIONS, 'p1')
      await controller.addPaneForWorktree(makeWorktree({ path: '/repo', isMain: true }), REPO, { isRoot: true })
      await controller.addPaneForWorktree(
        makeWorktree({ path: '/repo/.claude/worktrees/a', branch: 'agent/a' }),
        REPO,
      )
      const token = (splitTab as any).getRecoveryToken() as ReturnType<FleetController['serialize']>
      assert.equal(token.type, 'agent-fleet')
      assert.equal(token.panes.length, 2)
      assert.equal(token.panes[0].role, 'root')
      assert.equal(token.panes[1].role, 'worktree')
      assert.equal(token.profileId, 'p1')
    })

    it('double-register on the same SplitTabComponent returns the existing controller', () => {
      const c1 = registry.register(splitTab, DEFAULT_PROFILE_OPTIONS, 'p1')
      const c2 = registry.register(splitTab, DEFAULT_PROFILE_OPTIONS, 'p1')
      assert.equal(c1, c2)
      assert.equal(registry.size(), 1)
    })
  })

  describe('FleetController lifecycle (task 021 extensions)', () => {
    let registry: FleetRegistry
    let splitTab: SplitTabComponent
    let repoDir = ''
    let notifications: any

    beforeEach(() => {
      registry = new FleetRegistry()
      splitTab = new SplitTabComponent()
      repoDir = createTempRepo()
      notifications = { calls: [] as any[] }
      notifications.info = (text: string, details?: string) => notifications.calls.push({ kind: 'info', text, details })
      notifications.error = (text: string, details?: string) => notifications.calls.push({ kind: 'error', text, details })
      notifications.notice = (text: string) => notifications.calls.push({ kind: 'notice', text })
    })

    afterEach(() => {
      cleanupTempDir(repoDir)
    })

    it('launch with a valid repo + 2 worktrees creates 3 panes', async () => {
      addWorktreeOnDisk(repoDir, 'feature-a')
      addWorktreeOnDisk(repoDir, 'feature-b')
      const controller = registry.register(
        splitTab,
        { ...DEFAULT_PROFILE_OPTIONS, repoPath: repoDir, watchMode: 'off' },
        'p1',
        { notifications },
      )
      await controller.launch()
      assert.equal(controller.paneRegistry.size, 3)
      const roles = [...controller.paneRegistry.values()].map(e => e.role).sort()
      assert.deepEqual(roles, ['root', 'worktree', 'worktree'])
    })

    it('launch with an invalid repo path aborts (no panes opened)', async () => {
      const controller = registry.register(
        splitTab,
        { ...DEFAULT_PROFILE_OPTIONS, repoPath: '/definitely/not/a/real/path/xyz123', watchMode: 'off' },
        'p1',
        { notifications },
      )
      await controller.launch()
      assert.equal(controller.paneRegistry.size, 0)
      const err = notifications.calls.find((c: any) => c.kind === 'error')
      assert.ok(err, 'expected an error notification on invalid repo path')
    })

    it('launch aborts when preSpawnCommand exits non-zero', async () => {
      const controller = registry.register(
        splitTab,
        {
          ...DEFAULT_PROFILE_OPTIONS,
          repoPath: repoDir,
          preSpawnCommand: 'node -e "process.exit(1)"',
          watchMode: 'off',
        },
        'p1',
        { notifications },
      )
      await controller.launch()
      assert.equal(controller.paneRegistry.size, 0)
      const err = notifications.calls.find((c: any) => c.kind === 'error' && c.text === 'Pre-launch command failed')
      assert.ok(err, 'expected pre-launch-command-failed notification')
    })

    it('onWatcherChange adds a newly-appearing worktree pane', async () => {
      const controller = registry.register(
        splitTab,
        { ...DEFAULT_PROFILE_OPTIONS, repoPath: repoDir, watchMode: 'off', notifyOnChange: false },
        'p1',
        { notifications },
      )
      await controller.launch()
      assert.equal(controller.paneRegistry.size, 1) // root only

      addWorktreeOnDisk(repoDir, 'new-thing')
      await controller.onWatcherChange()
      assert.equal(controller.paneRegistry.size, 2)
    })

    it('dismissPane sets userDismissed and onWatcherChange does NOT re-open the pane', async () => {
      addWorktreeOnDisk(repoDir, 'dismissable')
      const controller = registry.register(
        splitTab,
        { ...DEFAULT_PROFILE_OPTIONS, repoPath: repoDir, watchMode: 'off', notifyOnChange: false },
        'p1',
        { notifications },
      )
      await controller.launch()
      assert.equal(controller.paneRegistry.size, 2)
      const wtEntry = [...controller.paneRegistry.values()].find(e => e.role === 'worktree')!
      controller.dismissPane(wtEntry.worktreePath)
      assert.equal(controller.userDismissed.has(wtEntry.worktreePath), true)
      assert.equal(controller.paneRegistry.size, 1)

      // Watcher fires (worktree still on disk) — must NOT re-add the dismissed path.
      await controller.onWatcherChange()
      assert.equal(controller.paneRegistry.size, 1)
    })

    it('confirmRootClose opens the modal and resolves true when result is true', async () => {
      const modal = {
        opens: 0,
        open() {
          this.opens++
          return { componentInstance: {}, result: Promise.resolve(true) }
        },
      }
      const controller = registry.register(splitTab, DEFAULT_PROFILE_OPTIONS, 'p1', { modal: modal as any })
      const result = await controller.confirmRootClose()
      assert.equal(modal.opens, 1)
      assert.equal(result, true)
    })

    it('relaunchPane clears the recovered flag and destroys the overlay', async () => {
      const controller = registry.register(splitTab, DEFAULT_PROFILE_OPTIONS, 'p1')
      let destroyCalls = 0
      controller.paneRegistry.set('paneX', {
        paneId: 'paneX',
        pane: {},
        role: 'worktree',
        worktreePath: '/repo/.claude/worktrees/x',
        branch: 'agent/x',
        command: 'claude --resume agent/x',
        title: 'x',
        color: null,
        recovered: true,
        baselineWeight: 1,
        overlayRef: { destroy: () => { destroyCalls++ } },
      })
      await controller.relaunchPane('paneX')
      const entry = controller.paneRegistry.get('paneX')!
      assert.equal(entry.recovered, false)
      assert.equal(entry.overlayRef, null)
      assert.equal(destroyCalls, 1)
    })
  })
})
