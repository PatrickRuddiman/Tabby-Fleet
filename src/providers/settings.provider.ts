import { Injectable } from '@angular/core'
import { SettingsTabProvider } from 'tabby-settings'
import { AgentFleetDefaultsTabComponent } from '../components/defaults-tab.component'

@Injectable({ providedIn: 'root' })
export class AgentFleetDefaultsTabProvider extends SettingsTabProvider {
  id = 'agent-fleet-defaults'
  title = 'Agent Fleet defaults'
  iconClass = 'fas fa-layer-group'

  getComponentType(): any {
    return AgentFleetDefaultsTabComponent
  }
}
