import { strict as assert } from 'assert'
import AgentFleetModule, { AGENT_FLEET_MODULE_CONFIG } from '../src/index'
import { AgentFleetProfileProvider } from '../src/providers/profile.provider'
import { AgentFleetRecoveryProvider } from '../src/providers/recovery.provider'
describe('AgentFleetModule (smoke)', () => {
  it('is exported as a class (function)', () => {
    assert.strictEqual(typeof AgentFleetModule, 'function')
  })

  it('has the name AgentFleetModule', () => {
    assert.strictEqual(AgentFleetModule.name, 'AgentFleetModule')
  })

  it('providers include the ProfileProvider and TabRecoveryProvider multi-providers', () => {
    const providers = AGENT_FLEET_MODULE_CONFIG.providers as any[]
    const classes = providers
      .filter(p => typeof p === 'object' && p?.multi === true)
      .map(p => p.useClass)
    assert.ok(classes.includes(AgentFleetProfileProvider))
    assert.ok(classes.includes(AgentFleetRecoveryProvider))
  })

  it('imports list is currently empty (incremental rollout)', () => {
    assert.equal(AGENT_FLEET_MODULE_CONFIG.imports.length, 0)
  })
})
