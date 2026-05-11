import { strict as assert } from 'assert'
import { AgentFleetProfileProvider } from '../src/providers/profile.provider'
import { DEFAULT_PROFILE_OPTIONS } from '../src/api'

describe('profile.provider', () => {
  describe('AgentFleetProfileProvider', () => {
    let provider: AgentFleetProfileProvider

    beforeEach(() => {
      provider = new AgentFleetProfileProvider()
    })

    it("id is 'agent-fleet'", () => {
      assert.equal(provider.id, 'agent-fleet')
    })

    it("name is 'Agent Fleet'", () => {
      assert.equal(provider.name, 'Agent Fleet')
    })

    it('configDefaults.options deep-equals DEFAULT_PROFILE_OPTIONS', () => {
      assert.deepEqual(provider.configDefaults.options, DEFAULT_PROFILE_OPTIONS)
    })

    it('getDescription returns the repoPath when set', () => {
      const desc = provider.getDescription({ options: { ...DEFAULT_PROFILE_OPTIONS, repoPath: 'C:\\dev\\foo' } })
      assert.equal(desc, 'C:\\dev\\foo')
    })

    it('getDescription returns "(current directory)" when repoPath is empty', () => {
      const desc = provider.getDescription({ options: { ...DEFAULT_PROFILE_OPTIONS, repoPath: '' } })
      assert.equal(desc, '(current directory)')
    })

    it('getNewTabParameters returns SplitTabComponent + fleetProfile input', async () => {
      const params = await provider.getNewTabParameters({
        options: DEFAULT_PROFILE_OPTIONS,
      } as any)
      assert.equal(typeof params.type, 'function')
      assert.equal(params.type.name, 'SplitTabComponent')
      assert.deepEqual(params.inputs?.fleetProfile, DEFAULT_PROFILE_OPTIONS)
    })

    it('getBuiltinProfiles returns one entry with the default options', async () => {
      const profiles = await provider.getBuiltinProfiles()
      assert.equal(profiles.length, 1)
      assert.deepEqual(profiles[0].options, DEFAULT_PROFILE_OPTIONS)
    })
  })
})
