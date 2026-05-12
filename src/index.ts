import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { NgbModule } from '@ng-bootstrap/ng-bootstrap'
import TabbyCoreModule, {
  ProfileProvider,
  TabRecoveryProvider,
} from 'tabby-core'
import { SettingsTabProvider } from 'tabby-settings'

import { AgentFleetProfileProvider } from './providers/profile.provider'
import { AgentFleetRecoveryProvider } from './providers/recovery.provider'
import { AgentFleetDefaultsTabProvider } from './providers/settings.provider'
import { FleetRegistry } from './services/fleet.registry'
import { AgentFleetProfileSettingsComponent } from './components/settings.component'
import { AgentFleetDefaultsTabComponent } from './components/defaults-tab.component'
import { ConfirmFleetCloseModalComponent } from './components/confirm-fleet-close-modal.component'
import { FleetDeadPaneOverlayComponent } from './components/fleet-dead-pane-overlay.component'

export const AGENT_FLEET_MODULE_CONFIG = {
  imports: [
    CommonModule,
    FormsModule,
    NgbModule,
    TabbyCoreModule,
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
