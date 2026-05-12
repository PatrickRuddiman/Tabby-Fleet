import { strict as assert } from 'assert'
import { AgentFleetProfileSettingsComponent } from '../src/components/settings.component'
import { DEFAULT_PROFILE_OPTIONS } from '../src/api'

function makeComponent(): AgentFleetProfileSettingsComponent {
  // Real DI is provided in the running plugin; the tests use null stubs since
  // they exercise the clamp / theme-list / shell-list pure logic only.
  const c = new (AgentFleetProfileSettingsComponent as any)(null, null, [])
  c.profile = { options: { ...DEFAULT_PROFILE_OPTIONS } } as any
  return c
}

describe('settings.component', () => {
  describe('AgentFleetProfileSettingsComponent', () => {
    it('instantiates with DEFAULT_PROFILE_OPTIONS bound', () => {
      const c = makeComponent()
      assert.deepEqual(c.profile.options, DEFAULT_PROFILE_OPTIONS)
    })

    it('clampField snaps a below-min numeric value up to the min on blur', () => {
      const c = makeComponent()
      c.profile.options.zoomFactor = 0.1 // below min (1.0)
      c.clampField('zoomFactor')
      assert.equal(c.profile.options.zoomFactor, 1.0)
    })

    it('clampField snaps an above-max numeric value down to the max on blur', () => {
      const c = makeComponent()
      c.profile.options.zoomFactor = 99 // above max (4.0)
      c.clampField('zoomFactor')
      assert.equal(c.profile.options.zoomFactor, 4.0)
    })

    it('clampField clamps minPaneWidth/Height within the documented range', () => {
      const c = makeComponent()
      c.profile.options.minPaneWidth = 5 // below 40
      c.clampField('minPaneWidth')
      assert.equal(c.profile.options.minPaneWidth, 40)
      c.profile.options.minPaneHeight = 99_999 // above 4000
      c.clampField('minPaneHeight')
      assert.equal(c.profile.options.minPaneHeight, 4000)
    })

    it('clampField is a no-op for fields with no bounds entry', () => {
      const c = makeComponent()
      c.profile.options.zoomTransitionMs = 250
      c.clampField('zoomTransitionMs')
      assert.equal(c.profile.options.zoomTransitionMs, 250)
    })

    it('starts with showAdvanced collapsed', () => {
      const c = makeComponent()
      assert.equal((c as any).showAdvanced, false)
    })
  })
})
