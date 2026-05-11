import { strict as assert } from 'assert'
import {
  AgentFleetProfileOptions,
  DEFAULT_PROFILE_OPTIONS,
  FleetPaneMetadata,
  RecoveredPane,
  AgentFleetRecoveryToken,
  FLEET_VERSION,
} from '../src/api'

describe('api', () => {
  describe('DEFAULT_PROFILE_OPTIONS', () => {
    it('has exactly 27 keys', () => {
      assert.equal(Object.keys(DEFAULT_PROFILE_OPTIONS).length, 27)
    })

    it("layoutMode default is 'grid'", () => {
      assert.equal(DEFAULT_PROFILE_OPTIONS.layoutMode, 'grid')
    })

    it("shellArgs default is ['-NoExit', '-EncodedCommand']", () => {
      assert.deepEqual(DEFAULT_PROFILE_OPTIONS.shellArgs, ['-NoExit', '-EncodedCommand'])
    })

    it('is assignable to AgentFleetProfileOptions and Partial<AgentFleetProfileOptions>', () => {
      // Pure type-check assertion: if these assignments compile, the test passes.
      const full: AgentFleetProfileOptions = DEFAULT_PROFILE_OPTIONS
      const partial: Partial<AgentFleetProfileOptions> = DEFAULT_PROFILE_OPTIONS
      assert.equal(typeof full.repoPath, 'string')
      assert.equal(typeof partial.zoomFactor, 'number')
    })
  })

  describe('FleetPaneMetadata + RecoveryToken types', () => {
    it('FLEET_VERSION is 1', () => {
      assert.equal(FLEET_VERSION, 1)
    })

    it('FleetPaneMetadata has 8 required fields when typed', () => {
      const sample: FleetPaneMetadata = {
        fleetTabId: 'tab-uuid',
        fleetProfileId: 'profile-1',
        role: 'root',
        worktreePath: '/repo',
        branch: 'main',
        fleetVersion: FLEET_VERSION,
        spawnedAt: new Date().toISOString(),
        baselineWeight: 2,
      }
      assert.equal(Object.keys(sample).length, 8)
    })

    it('AgentFleetRecoveryToken.type narrows to literal "agent-fleet"', () => {
      const pane: RecoveredPane = {
        role: 'worktree',
        worktreePath: '/repo/.claude/worktrees/x',
        branch: 'agent/x',
        command: 'claude --resume agent/x',
        title: 'x',
        color: null,
      }
      const token: AgentFleetRecoveryToken = {
        type: 'agent-fleet',
        profileId: 'profile-1',
        profile: DEFAULT_PROFILE_OPTIONS,
        panes: [pane],
        tabTitle: 'fleet',
        tabColor: null,
      }
      assert.equal(token.type, 'agent-fleet')
      assert.equal(token.panes.length, 1)
    })
  })
})
