import { Component, Inject, Optional } from '@angular/core'
import { ConfigService } from 'tabby-core'
import { AgentFleetProfileOptions, DEFAULT_PROFILE_OPTIONS } from '../api'

/**
 * Settings-tab wrapper that binds the per-profile editor to
 * `ConfigService.store.fleet.defaults`. Persists on every change via
 * `config.save()`.
 */
@Component({
  selector: 'agent-fleet-defaults-tab',
  templateUrl: './defaults-tab.component.pug',
})
export class AgentFleetDefaultsTabComponent {
  profile: { options: AgentFleetProfileOptions }

  constructor(@Optional() @Inject(ConfigService) private config: ConfigService | null) {
    this.profile = { options: this.loadOptions() }
  }

  private loadOptions(): AgentFleetProfileOptions {
    const stored = this.config?.store?.fleet?.defaults ?? {}
    return { ...DEFAULT_PROFILE_OPTIONS, ...stored }
  }

  async onChange(): Promise<void> {
    if (!this.config) return
    if (!this.config.store) this.config.store = {}
    if (!this.config.store.fleet) this.config.store.fleet = {}
    this.config.store.fleet.defaults = this.profile.options
    await this.config.save()
  }
}
