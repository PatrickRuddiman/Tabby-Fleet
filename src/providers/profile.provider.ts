import { Injectable } from '@angular/core'
import {
  NewTabParameters,
  PartialProfile,
  Profile,
  ProfileProvider,
  SplitTabComponent,
} from 'tabby-core'
import { AgentFleetProfileOptions, DEFAULT_PROFILE_OPTIONS } from '../api'
import { AgentFleetProfileSettingsComponent } from '../components/settings.component'
import { FleetBootstrap } from '../services/fleet.bootstrap'

type AgentFleetProfile = Profile<AgentFleetProfileOptions>

@Injectable()
export class AgentFleetProfileProvider extends ProfileProvider<AgentFleetProfile> {
  id = 'agent-fleet'
  name = 'Agent Fleet'

  configDefaults = { options: DEFAULT_PROFILE_OPTIONS }

  settingsComponent = AgentFleetProfileSettingsComponent

  // Injecting FleetBootstrap here is what eagerly instantiates the bootstrap
  // service at app startup (ProfileProvider multi-providers are resolved during
  // bootstrap). The bootstrap then subscribes to AppService.tabOpened$.
  constructor(_bootstrap: FleetBootstrap) {
    super()
  }

  async getBuiltinProfiles(): Promise<PartialProfile<AgentFleetProfile>[]> {
    return [
      {
        id: 'agent-fleet:template',
        type: 'agent-fleet',
        name: 'Agent Fleet',
        icon: 'fas fa-code-branch',
        options: { ...DEFAULT_PROFILE_OPTIONS },
        isBuiltin: true,
        isTemplate: true,
        weight: -1,
      } as PartialProfile<AgentFleetProfile>,
    ]
  }

  async getNewTabParameters(profile: AgentFleetProfile): Promise<NewTabParameters> {
    return {
      type: SplitTabComponent,
      inputs: { fleetProfile: profile.options },
    }
  }

  getDescription(profile: PartialProfile<AgentFleetProfile>): string {
    const repoPath = profile?.options?.repoPath
    return repoPath && repoPath.length > 0 ? repoPath : '(current directory)'
  }
}
