import { strict as assert } from 'assert'
import { AgentFleetProfileSettingsComponent } from '../src/components/settings.component'
import { DEFAULT_PROFILE_OPTIONS } from '../src/api'

function makeComponent(): AgentFleetProfileSettingsComponent {
  const c = new AgentFleetProfileSettingsComponent()
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
      c.profile.options.pollIntervalMs = 999_999_999
      c.clampField('pollIntervalMs')
      assert.equal(c.profile.options.pollIntervalMs, 60_000)
    })

    it('shellArgsFromText splits on newlines and drops empty lines', () => {
      const c = makeComponent()
      const text = '-NoExit\r\n-EncodedCommand\n\n  \n'
      const args = c.shellArgsFromText(text)
      assert.deepEqual(args, ['-NoExit', '-EncodedCommand'])
    })

    it('shellArgs round-trip (array → text → array) is identity', () => {
      const c = makeComponent()
      const original = ['-NoExit', '-EncodedCommand']
      const text = c.shellArgsToText(original)
      const roundTripped = c.shellArgsFromText(text)
      assert.deepEqual(roundTripped, original)
    })
  })
})
