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
  template: `
    <div class="fleet-defaults-tab">
      <h3>Agent Fleet defaults</h3>
      <p class="text-muted">These settings seed every new Agent Fleet profile. Existing profiles keep their current values.</p>
      <agent-fleet-profile-settings [profile]="profile" (change)="onChange()"></agent-fleet-profile-settings>
    </div>
  `,
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
