import { strict as assert } from 'assert'
import {
  AgentFleetProfileOptions,
  DEFAULT_PROFILE_OPTIONS,
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
})
