import { Injectable } from '@angular/core'
import {
  NewTabParameters,
  SplitTabComponent,
  TabRecoveryProvider,
} from 'tabby-core'
import { AgentFleetRecoveryToken } from '../api'

@Injectable({ providedIn: 'root' })
export class AgentFleetRecoveryProvider extends TabRecoveryProvider<SplitTabComponent> {
  async applicableTo(token: unknown): Promise<boolean> {
    if (!token || typeof token !== 'object') return false
    return (token as { type?: string }).type === 'agent-fleet'
  }

  async recover(token: AgentFleetRecoveryToken): Promise<NewTabParameters<SplitTabComponent> | null> {
    if (!token || token.type !== 'agent-fleet') return null
    return {
      type: SplitTabComponent,
      inputs: {
        fleetProfile: token.profile,
        recoveredPanes: token.panes,
      },
    }
  }
}
