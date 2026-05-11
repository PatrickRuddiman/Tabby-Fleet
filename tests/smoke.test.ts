import { strict as assert } from 'assert'
import AgentFleetModule, { AGENT_FLEET_MODULE_CONFIG } from '../src/index'
import { AgentFleetProfileSettingsComponent } from '../src/components/settings.component'
import { AgentFleetDefaultsTabComponent } from '../src/components/defaults-tab.component'
import { ConfirmFleetCloseModalComponent } from '../src/components/confirm-fleet-close-modal.component'
import { FleetDeadPaneOverlayComponent } from '../src/components/fleet-dead-pane-overlay.component'
import { AgentFleetProfileProvider } from '../src/providers/profile.provider'
import { AgentFleetRecoveryProvider } from '../src/providers/recovery.provider'
import { AgentFleetDefaultsTabProvider } from '../src/providers/settings.provider'
import { TabbyCoreModule } from 'tabby-core'
import { NgbAccordionModule } from '@ng-bootstrap/ng-bootstrap'

describe('AgentFleetModule (smoke)', () => {
  it('is exported as a class (function)', () => {
    assert.strictEqual(typeof AgentFleetModule, 'function')
  })

  it('has the name AgentFleetModule', () => {
    assert.strictEqual(AgentFleetModule.name, 'AgentFleetModule')
  })

  it('declarations include all four fleet components', () => {
    const decls = AGENT_FLEET_MODULE_CONFIG.declarations
    assert.ok(decls.includes(AgentFleetProfileSettingsComponent))
    assert.ok(decls.includes(AgentFleetDefaultsTabComponent))
    assert.ok(decls.includes(ConfirmFleetCloseModalComponent))
    assert.ok(decls.includes(FleetDeadPaneOverlayComponent))
  })

  it('providers list contains the three multi-provider entries for ProfileProvider, TabRecoveryProvider, SettingsTabProvider', () => {
    const providers = AGENT_FLEET_MODULE_CONFIG.providers as any[]
    const classes = providers
      .filter(p => typeof p === 'object' && p?.multi === true)
      .map(p => p.useClass)
    assert.ok(classes.includes(AgentFleetProfileProvider))
    assert.ok(classes.includes(AgentFleetRecoveryProvider))
    assert.ok(classes.includes(AgentFleetDefaultsTabProvider))
  })

  it('imports list contains TabbyCoreModule and NgbAccordionModule', () => {
    const imports = AGENT_FLEET_MODULE_CONFIG.imports as any[]
    assert.ok(imports.includes(TabbyCoreModule))
    assert.ok(imports.includes(NgbAccordionModule))
  })
})
