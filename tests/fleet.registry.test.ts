import { strict as assert } from 'assert'
import { SplitTabComponent } from 'tabby-core'
import { FleetController, FleetRegistry } from '../src/services/fleet.registry'
import { DEFAULT_PROFILE_OPTIONS } from '../src/api'
import { Worktree } from '../src/utils/porcelain'
import { RepoInfo } from '../src/utils/vars'

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
})
