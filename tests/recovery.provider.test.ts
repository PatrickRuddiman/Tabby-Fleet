import { strict as assert } from 'assert'
import { AgentFleetRecoveryProvider } from '../src/providers/recovery.provider'
import {
  AgentFleetRecoveryToken,
  DEFAULT_PROFILE_OPTIONS,
  RecoveredPane,
} from '../src/api'

const SAMPLE_PANE: RecoveredPane = {
  role: 'worktree',
  worktreePath: '/repo/.claude/worktrees/x',
  branch: 'agent/x',
  command: 'claude --resume agent/x',
  title: 'x',
  color: null,
}

const VALID_TOKEN: AgentFleetRecoveryToken = {
  type: 'agent-fleet',
  profileId: 'profile-1',
  profile: DEFAULT_PROFILE_OPTIONS,
  panes: [SAMPLE_PANE],
  tabTitle: 'fleet',
  tabColor: null,
}

describe('recovery.provider', () => {
  describe('AgentFleetRecoveryProvider', () => {
    let provider: AgentFleetRecoveryProvider

    beforeEach(() => {
      provider = new AgentFleetRecoveryProvider()
    })

    it("applicableTo returns true for { type: 'agent-fleet' }", async () => {
      assert.equal(await provider.applicableTo({ type: 'agent-fleet' }), true)
    })

    it("applicableTo returns false for { type: 'ssh' }", async () => {
      assert.equal(await provider.applicableTo({ type: 'ssh' }), false)
    })

    it('applicableTo returns false for null', async () => {
      assert.equal(await provider.applicableTo(null), false)
    })

    it('recover returns NewTabParameters with SplitTabComponent + recoveredPanes preserved', async () => {
      const params = await provider.recover(VALID_TOKEN)
      assert.notEqual(params, null)
      assert.equal(typeof params!.type, 'function')
      assert.equal(params!.type.name, 'SplitTabComponent')
      assert.deepEqual(params!.inputs?.recoveredPanes, VALID_TOKEN.panes)
      assert.deepEqual(params!.inputs?.fleetProfile, DEFAULT_PROFILE_OPTIONS)
    })

    it("recover returns null when token.type is not 'agent-fleet'", async () => {
      const result = await provider.recover({ ...VALID_TOKEN, type: 'ssh' as any })
      assert.equal(result, null)
    })
  })
})
