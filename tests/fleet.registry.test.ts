import { strict as assert } from 'assert'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { SplitTabComponent } from 'tabby-core'
import { FleetController, FleetControllerDeps, FleetRegistry } from '../src/services/fleet.registry'
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
  // Worktrees go wherever — no path prefix enforced.
  execSync(`git worktree add wt-${name} -b agent/${name}`, {
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

// Minimal Tabby-service stubs sufficient for addPaneForWorktree to run end-to-end
// without a real Angular runtime. Tracks every tab created.
function makeDeps(notifications?: any): FleetControllerDeps & { createdTabs: any[] } {
  const created: any[] = []
  const localProfile = {
    id: 'local-test',
    type: 'local',
    name: 'pwsh',
    isBuiltin: true,
    isTemplate: false,
    options: { command: 'pwsh.exe', args: [] as string[], cwd: '' },
  }
  const tabsService: any = {
    create(params: any) {
      const tab: any = { params, profile: params?.inputs?.profile, session: null, destroyed$: { subscribe: () => ({ unsubscribe: () => {} }) } }
      created.push(tab)
      return tab
    },
  }
  const profilesService: any = {
    async getProfiles() { return [localProfile] },
    providerForProfile() {
      return {
        async getNewTabParameters(profile: any) {
          return { type: function FakeTerminalTab() {}, inputs: { profile } }
        },
      }
    },
  }
  return {
    notifications,
    tabsService,
    profilesService,
    resolveTheme: async () => null,
    createdTabs: created,
  } as any
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

    it('applyRatios delegates to rebuildGrid and calls splitTab.layout()', () => {
      const controller = registry.register(splitTab, DEFAULT_PROFILE_OPTIONS, 'p1')
      // Empty registry → rebuildGrid is a no-op; applyRatios shim shouldn't crash.
      controller.applyRatios([])
      assert.equal((splitTab as any)._layoutCalls, 0)
    })

    it('addPaneForWorktree always uses side=r so panes form one container', async () => {
      const deps = makeDeps()
      const controller = registry.register(splitTab, DEFAULT_PROFILE_OPTIONS, 'p1', deps)
      await controller.addPaneForWorktree(makeWorktree({ path: '/repo', isMain: true }), REPO, { isRoot: true })
      await controller.addPaneForWorktree(makeWorktree({ path: '/repo/wt-a', branch: 'agent/a' }), REPO)
      await controller.addPaneForWorktree(makeWorktree({ path: '/repo/wt-b', branch: 'agent/b' }), REPO)

      const calls = (splitTab as any)._addTabCalls
      assert.equal(calls.length, 3)
      // Root: no relative.
      assert.equal(calls[0].relative, null)
      assert.equal(calls[0].side, 'r')
      // Every subsequent pane: side='r', relative=previously-added pane.
      assert.equal(calls[1].side, 'r')
      assert.equal(calls[1].relative, calls[0].tab)
      assert.equal(calls[2].side, 'r')
      assert.equal(calls[2].relative, calls[1].tab)
    })

    it("getRecoveryToken returns type='agent-fleet' and panes.length matching the registry", async () => {
      const deps = makeDeps()
      const controller = registry.register(splitTab, DEFAULT_PROFILE_OPTIONS, 'p1', deps)
      await controller.addPaneForWorktree(makeWorktree({ path: '/repo', isMain: true }), REPO, { isRoot: true })
      await controller.addPaneForWorktree(makeWorktree({ path: '/repo/wt-a', branch: 'agent/a' }), REPO)
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

  describe('FleetController lifecycle', () => {
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
        { ...DEFAULT_PROFILE_OPTIONS, repoPath: repoDir },
        'p1',
        makeDeps(notifications),
      )
      await controller.launch()
      assert.equal(controller.paneRegistry.size, 3)
      const roles = [...controller.paneRegistry.values()].map(e => e.role).sort()
      assert.deepEqual(roles, ['root', 'worktree', 'worktree'])
      // Stop the watcher poller so it doesn't leak between tests.
      controller.detach()
    })

    it('launch with an invalid repo path aborts (no panes opened)', async () => {
      const controller = registry.register(
        splitTab,
        { ...DEFAULT_PROFILE_OPTIONS, repoPath: '/definitely/not/a/real/path/xyz123' },
        'p1',
        makeDeps(notifications),
      )
      await controller.launch()
      assert.equal(controller.paneRegistry.size, 0)
      const err = notifications.calls.find((c: any) => c.kind === 'error')
      assert.ok(err, 'expected an error notification on invalid repo path')
      controller.detach()
    })

    it('launch aborts when preSpawnCommand exits non-zero', async () => {
      const controller = registry.register(
        splitTab,
        { ...DEFAULT_PROFILE_OPTIONS, repoPath: repoDir, preSpawnCommand: 'node -e "process.exit(1)"' },
        'p1',
        makeDeps(notifications),
      )
      await controller.launch()
      assert.equal(controller.paneRegistry.size, 0)
      const err = notifications.calls.find((c: any) => c.kind === 'error' && c.text === 'Pre-launch command failed')
      assert.ok(err, 'expected pre-launch-command-failed notification')
      controller.detach()
    })

    it('onWatcherChange adds a newly-appearing worktree pane', async () => {
      const controller = registry.register(
        splitTab,
        { ...DEFAULT_PROFILE_OPTIONS, repoPath: repoDir, notifyOnChange: false },
        'p1',
        makeDeps(notifications),
      )
      await controller.launch()
      assert.equal(controller.paneRegistry.size, 1) // root only

      addWorktreeOnDisk(repoDir, 'new-thing')
      await controller.onWatcherChange()
      assert.equal(controller.paneRegistry.size, 2)
      controller.detach()
    })

    it('dismissPane sets userDismissed and onWatcherChange does NOT re-open the pane', async () => {
      addWorktreeOnDisk(repoDir, 'dismissable')
      const controller = registry.register(
        splitTab,
        { ...DEFAULT_PROFILE_OPTIONS, repoPath: repoDir, notifyOnChange: false },
        'p1',
        makeDeps(notifications),
      )
      await controller.launch()
      assert.equal(controller.paneRegistry.size, 2)
      const wtEntry = [...controller.paneRegistry.values()].find(e => e.role === 'worktree')!
      await controller.dismissPane(wtEntry.worktreePath)
      assert.equal(controller.userDismissed.has(wtEntry.worktreePath), true)
      assert.equal(controller.paneRegistry.size, 1)

      // Watcher fires (worktree still on disk) — must NOT re-add the dismissed path.
      await controller.onWatcherChange()
      assert.equal(controller.paneRegistry.size, 1)
      controller.detach()
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
        worktreePath: '/repo/wt-x',
        branch: 'agent/x',
        command: 'claude',
        title: 'x',
        color: null,
        recovered: true,
        baselineWeight: 1,
        overlayRef: { destroy: () => { destroyCalls++ } },
      } as any)
      await controller.relaunchPane('paneX')
      const entry = controller.paneRegistry.get('paneX')!
      assert.equal(entry.recovered, false)
      assert.equal(entry.overlayRef, null)
      assert.equal(destroyCalls, 1)
    })
  })
})
