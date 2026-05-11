import 'reflect-metadata'
import { NgModule } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { NgbAccordionModule, NgbModalModule } from '@ng-bootstrap/ng-bootstrap'
import {
  ProfileProvider,
  TabRecoveryProvider,
  TabbyCoreModule,
} from 'tabby-core'
import { TabbyTerminalModule } from 'tabby-terminal'
import { SettingsTabProvider, TabbySettingsModule } from 'tabby-settings'

import './styles/fleet-transition.scss'

import { AgentFleetProfileProvider } from './providers/profile.provider'
import { AgentFleetRecoveryProvider } from './providers/recovery.provider'
import { AgentFleetDefaultsTabProvider } from './providers/settings.provider'
import { FleetRegistry } from './services/fleet.registry'
import { AgentFleetProfileSettingsComponent } from './components/settings.component'
import { AgentFleetDefaultsTabComponent } from './components/defaults-tab.component'
import { ConfirmFleetCloseModalComponent } from './components/confirm-fleet-close-modal.component'
import { FleetDeadPaneOverlayComponent } from './components/fleet-dead-pane-overlay.component'

/**
 * Module configuration exported separately so tests can introspect it without
 * relying on Angular's reflect-metadata machinery.
 */
export const AGENT_FLEET_MODULE_CONFIG = {
  imports: [
    TabbyCoreModule,
    TabbyTerminalModule,
    TabbySettingsModule,
    NgbAccordionModule,
    NgbModalModule,
    FormsModule,
  ],
  declarations: [
    AgentFleetProfileSettingsComponent,
    AgentFleetDefaultsTabComponent,
    ConfirmFleetCloseModalComponent,
    FleetDeadPaneOverlayComponent,
  ],
  providers: [
    { provide: ProfileProvider, useClass: AgentFleetProfileProvider, multi: true },
    { provide: TabRecoveryProvider, useClass: AgentFleetRecoveryProvider, multi: true },
    { provide: SettingsTabProvider, useClass: AgentFleetDefaultsTabProvider, multi: true },
    FleetRegistry,
  ],
}

@NgModule(AGENT_FLEET_MODULE_CONFIG)
export default class AgentFleetModule {}
