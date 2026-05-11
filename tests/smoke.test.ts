import { strict as assert } from 'assert'
import AgentFleetModule from '../src/index'

describe('AgentFleetModule (smoke)', () => {
  it('is exported as a class (function)', () => {
    assert.strictEqual(typeof AgentFleetModule, 'function')
  })

  it('has the name AgentFleetModule', () => {
    assert.strictEqual(AgentFleetModule.name, 'AgentFleetModule')
  })
})
