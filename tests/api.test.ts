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
    it('has exactly 23 keys', () => {
      assert.equal(Object.keys(DEFAULT_PROFILE_OPTIONS).length, 23)
    })

    it('orchestratorShellOnly defaults to false', () => {
      assert.equal(DEFAULT_PROFILE_OPTIONS.orchestratorShellOnly, false)
    })

    it('worktreeThemeRandom defaults to false', () => {
      assert.equal(DEFAULT_PROFILE_OPTIONS.worktreeThemeRandom, false)
    })

    it('agentCommand default is empty (user supplies their agent)', () => {
      assert.equal(DEFAULT_PROFILE_OPTIONS.agentCommand, '')
    })

    it('rootCommandTemplate default is empty — Advanced override; falls back to agentCommand', () => {
      assert.equal(DEFAULT_PROFILE_OPTIONS.rootCommandTemplate, '')
    })

    it('shellProfileId default is null (use Tabby default shell)', () => {
      assert.equal(DEFAULT_PROFILE_OPTIONS.shellProfileId, null)
    })

    it('rootTheme and worktreeTheme default to null (use Tabby default)', () => {
      assert.equal(DEFAULT_PROFILE_OPTIONS.rootTheme, null)
      assert.equal(DEFAULT_PROFILE_OPTIONS.worktreeTheme, null)
    })

    it('zoom defaults: factor 2.0, min pane 120x80', () => {
      assert.equal(DEFAULT_PROFILE_OPTIONS.zoomFactor, 2.0)
      assert.equal(DEFAULT_PROFILE_OPTIONS.minPaneWidth, 120)
      assert.equal(DEFAULT_PROFILE_OPTIONS.minPaneHeight, 80)
    })

    it('is assignable to AgentFleetProfileOptions and Partial<AgentFleetProfileOptions>', () => {
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
        worktreePath: '/repo/wt-x',
        branch: 'feat-x',
        command: 'claude',
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
