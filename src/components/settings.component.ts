import { Component, Input } from '@angular/core'
import { PartialProfile, Profile } from 'tabby-core'
import { AgentFleetProfileOptions, DEFAULT_PROFILE_OPTIONS } from '../api'

type AgentFleetProfile = Profile<AgentFleetProfileOptions>

interface NumericBounds { min: number; max: number }

const BOUNDS: Partial<Record<keyof AgentFleetProfileOptions, NumericBounds>> = {
  zoomFactor: { min: 1.0, max: 4.0 },
  minPaneWidth: { min: 40, max: 4000 },
  minPaneHeight: { min: 40, max: 4000 },
  zoomTransitionMs: { min: 0, max: 1000 },
  pollIntervalMs: { min: 500, max: 60000 },
}

/**
 * Per-profile editor mounted by Tabby's profile editor for agent-fleet
 * profiles. Two-way binds 27 fields of AgentFleetProfileOptions. Numeric
 * fields clamp on blur via clampField. `shellArgs` round-trips through the
 * textarea via shellArgsToText / shellArgsFromText.
 */
@Component({
  selector: 'agent-fleet-profile-settings',
  templateUrl: './settings.component.pug',
  styleUrls: ['./settings.component.scss'],
})
export class AgentFleetProfileSettingsComponent {
  @Input() profile!: PartialProfile<AgentFleetProfile> & { options: AgentFleetProfileOptions }

  ensureOptions(): AgentFleetProfileOptions {
    if (!this.profile) {
      this.profile = { options: { ...DEFAULT_PROFILE_OPTIONS } } as any
    }
    if (!this.profile.options) {
      this.profile.options = { ...DEFAULT_PROFILE_OPTIONS }
    }
    return this.profile.options
  }

  /** Clamp a numeric option in-place to its documented bounds. */
  clampField(name: keyof AgentFleetProfileOptions): void {
    const bounds = BOUNDS[name]
    if (!bounds) return
    const opts = this.ensureOptions()
    const raw = opts[name] as unknown as number
    const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : bounds.min
    const clamped = Math.min(bounds.max, Math.max(bounds.min, value))
    ;(opts as any)[name] = clamped
  }

  /** Serialise shellArgs to a textarea string (one arg per line). */
  shellArgsToText(args: string[]): string {
    return args.join('\n')
  }

  /** Parse a textarea string back into shellArgs (split on newlines, drop empties). */
  shellArgsFromText(text: string): string[] {
    return text.split(/\r?\n/).map(s => s.trim()).filter(s => s.length > 0)
  }

  /** Two-way binding for the `shellArgs` textarea. */
  get shellArgsText(): string {
    return this.shellArgsToText(this.ensureOptions().shellArgs)
  }

  set shellArgsText(text: string) {
    this.ensureOptions().shellArgs = this.shellArgsFromText(text)
  }
}
