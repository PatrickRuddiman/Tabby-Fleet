import {
  NewTabParameters,
  PartialProfile,
  Profile,
  ProfileProvider,
  SplitTabComponent,
} from 'tabby-core'
import { AgentFleetProfileOptions, DEFAULT_PROFILE_OPTIONS } from '../api'

type AgentFleetProfile = Profile<AgentFleetProfileOptions>

export class AgentFleetProfileProvider extends ProfileProvider<AgentFleetProfile> {
  id = 'agent-fleet'
  name = 'Agent Fleet'

  configDefaults = { options: DEFAULT_PROFILE_OPTIONS }

  // Settings component is wired in task 022's final NgModule wire-up. Leaving
  // this null here keeps the provider standalone for task 014.
  settingsComponent: any = null

  async getBuiltinProfiles(): Promise<PartialProfile<AgentFleetProfile>[]> {
    return [
      {
        name: 'Agent Fleet (current dir)',
        type: 'agent-fleet',
        options: { ...DEFAULT_PROFILE_OPTIONS },
      },
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
