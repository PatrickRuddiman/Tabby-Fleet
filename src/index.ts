import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { NgbModule } from '@ng-bootstrap/ng-bootstrap'
import TabbyCoreModule, {
  ProfileProvider,
  TabRecoveryProvider,
} from 'tabby-core'
import * as TabbyCore from 'tabby-core'
import type { CLIHandler as ICLIHandler } from 'tabby-core/typings/api/cli'
// See providers/cli.handler.ts — tabby-core's nightly .d.ts barrel drops
// CLIHandler from the top-level exports; the runtime value is still there.
const CLIHandler = (TabbyCore as unknown as { CLIHandler: typeof ICLIHandler }).CLIHandler
import { SettingsTabProvider } from 'tabby-settings'

import { AgentFleetProfileProvider } from './providers/profile.provider'
import { AgentFleetRecoveryProvider } from './providers/recovery.provider'
import { AgentFleetDefaultsTabProvider } from './providers/settings.provider'
import { FleetSuppressConptyHelperCLIHandler } from './providers/cli.handler'
import { FleetRegistry } from './services/fleet.registry'
import { AgentFleetProfileSettingsComponent } from './components/settings.component'
import { AgentFleetDefaultsTabComponent } from './components/defaults-tab.component'
import { ConfirmFleetCloseModalComponent } from './components/confirm-fleet-close-modal.component'
import { FleetDeadPaneOverlayComponent } from './components/fleet-dead-pane-overlay.component'
import { FleetWorktreeDrawerComponent } from './components/fleet-worktree-drawer.component'

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
    FleetWorktreeDrawerComponent,
  ],
  providers: [
    { provide: ProfileProvider, useClass: AgentFleetProfileProvider, multi: true },
    { provide: TabRecoveryProvider, useClass: AgentFleetRecoveryProvider, multi: true },
    { provide: SettingsTabProvider, useClass: AgentFleetDefaultsTabProvider, multi: true },
    { provide: CLIHandler, useClass: FleetSuppressConptyHelperCLIHandler, multi: true },
    FleetRegistry,
  ],
}

@NgModule(AGENT_FLEET_MODULE_CONFIG)
export default class AgentFleetModule {}
