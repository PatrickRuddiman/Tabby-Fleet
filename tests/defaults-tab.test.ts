import { strict as assert } from 'assert'
import { ConfigService } from 'tabby-core'
import { AgentFleetDefaultsTabProvider } from '../src/providers/settings.provider'
import { AgentFleetDefaultsTabComponent } from '../src/components/defaults-tab.component'
import { DEFAULT_PROFILE_OPTIONS } from '../src/api'

describe('defaults-tab', () => {
  describe('AgentFleetDefaultsTabComponent', () => {
    it('with empty config, options deep-equals DEFAULT_PROFILE_OPTIONS', () => {
      const config = new ConfigService()
      const c = new AgentFleetDefaultsTabComponent(config)
      assert.deepEqual(c.profile.options, DEFAULT_PROFILE_OPTIONS)
    })

    it('partial overrides win field-by-field over defaults', () => {
      const config = new ConfigService()
      ;(config.store as any).fleet = {
        defaults: { zoomFactor: 3.5, layoutMode: 'static-grid' },
      }
      const c = new AgentFleetDefaultsTabComponent(config)
      assert.equal(c.profile.options.zoomFactor, 3.5)
      assert.equal(c.profile.options.layoutMode, 'static-grid')
      // Untouched defaults still come through.
      assert.equal(c.profile.options.minPaneWidth, DEFAULT_PROFILE_OPTIONS.minPaneWidth)
    })

    it('onChange writes options back to config.store.fleet.defaults and calls config.save()', async () => {
      const config = new ConfigService()
      let saveCount = 0
      ;(config as any).save = async () => { saveCount++ }
      const c = new AgentFleetDefaultsTabComponent(config)
      c.profile.options.zoomFactor = 2.5
      await c.onChange()
      assert.equal(saveCount, 1)
      assert.equal((config.store as any).fleet.defaults.zoomFactor, 2.5)
    })
  })

  describe('AgentFleetDefaultsTabProvider', () => {
    it("id is 'agent-fleet-defaults', title is 'Agent Fleet defaults'", () => {
      const provider = new AgentFleetDefaultsTabProvider()
      assert.equal(provider.id, 'agent-fleet-defaults')
      assert.equal(provider.title, 'Agent Fleet defaults')
    })

    it('getComponentType returns AgentFleetDefaultsTabComponent', () => {
      const provider = new AgentFleetDefaultsTabProvider()
      assert.equal(provider.getComponentType(), AgentFleetDefaultsTabComponent)
    })
  })
})
