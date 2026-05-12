import { Component, Inject, Input, OnInit } from '@angular/core'
import { PartialProfile, PlatformService, Profile, ProfilesService } from 'tabby-core'
import { TerminalColorScheme, TerminalColorSchemeProvider } from 'tabby-terminal'
import { AgentFleetProfileOptions, DEFAULT_PROFILE_OPTIONS } from '../api'

type AgentFleetProfile = Profile<AgentFleetProfileOptions>

interface NumericBounds { min: number; max: number }

const BOUNDS: Partial<Record<keyof AgentFleetProfileOptions, NumericBounds>> = {
  zoomFactor: { min: 1.0, max: 4.0 },
  minPaneWidth: { min: 40, max: 4000 },
  minPaneHeight: { min: 40, max: 4000 },
  zoomTransitionMs: { min: 0, max: 1000 },
}

/**
 * Per-profile editor mounted by Tabby's profile editor for agent-fleet
 * profiles. Two-way binds 27 fields of AgentFleetProfileOptions. Numeric
 * fields clamp on blur via clampField. `shellArgs` round-trips through the
 * textarea via shellArgsToText / shellArgsFromText.
 */
@Component({
  selector: 'agent-fleet-profile-settings',
  template: `
    <div class="fleet-settings" *ngIf="profile?.options">
      <ul ngbNav #topNav="ngbNav" class="nav-tabs fleet-tabs">
        <li ngbNavItem>
          <a ngbNavLink>Config</a>
          <ng-template ngbNavContent>
            <div class="tab-body">
              <fieldset class="fleet-section">
                <legend>Repo</legend>
                <div class="form-group">
                  <label>Repo path</label>
                  <div class="input-group">
                    <input class="form-control" type="text" [(ngModel)]="profile.options.repoPath" placeholder="leave empty for current directory" />
                    <button type="button" class="btn btn-secondary" (click)="browseRepoPath()">Browse...</button>
                  </div>
                </div>
                <div class="form-group">
                  <label>Pre-launch command</label>
                  <input class="form-control" type="text" [(ngModel)]="profile.options.preSpawnCommand" />
                </div>
              </fieldset>

              <fieldset class="fleet-section">
                <legend>Shell &amp; agent</legend>
                <div class="form-group">
                  <label>Shell</label>
                  <select class="form-control" [(ngModel)]="profile.options.shellProfileId">
                    <option [ngValue]="null">(Tabby default shell)</option>
                    <option *ngFor="let p of shellProfiles" [ngValue]="p.id">{{ p.name }}</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Worker command</label>
                  <input class="form-control" type="text" [(ngModel)]="profile.options.agentCommand" placeholder="e.g. claude, copilot, codex, opencode" />
                  <small class="form-text text-muted">Runs in each worker pane's worktree directory.</small>
                </div>
                <div class="form-group">
                  <button type="button" class="btn btn-link btn-sm p-0" (click)="showAdvanced = !showAdvanced">
                    {{ showAdvanced ? '▾' : '▸' }} Advanced (override orchestrator separately)
                  </button>
                </div>
                <ng-container *ngIf="showAdvanced">
                  <div class="form-group">
                    <label>Orchestrator command</label>
                    <input class="form-control" type="text" [(ngModel)]="profile.options.rootCommandTemplate" placeholder="leave blank to use Worker command" />
                    <small class="form-text text-muted">Override for the orchestrator pane (cwd = repo path). Blank = same as Worker command.</small>
                  </div>
                  <div class="form-group">
                    <label>Orchestrator title</label>
                    <input class="form-control" type="text" [(ngModel)]="profile.options.rootTitle" />
                  </div>
                  <div class="form-group">
                    <label>Worker title pattern</label>
                    <input class="form-control" type="text" [(ngModel)]="profile.options.paneTitlePattern" />
                  </div>
                </ng-container>
              </fieldset>

              <fieldset class="fleet-section">
                <legend>Filters</legend>
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="fleet-inc-detached" [(ngModel)]="profile.options.includeDetached" />
                  <label class="form-check-label" for="fleet-inc-detached">Include detached worktrees</label>
                </div>
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="fleet-inc-prunable" [(ngModel)]="profile.options.includePrunable" />
                  <label class="form-check-label" for="fleet-inc-prunable">Include prunable worktrees</label>
                </div>
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="fleet-inc-locked" [(ngModel)]="profile.options.includeLocked" />
                  <label class="form-check-label" for="fleet-inc-locked">Include locked worktrees</label>
                </div>
              </fieldset>

              <fieldset class="fleet-section">
                <legend>Notifications</legend>
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="fleet-steal-focus" [(ngModel)]="profile.options.stealFocusOnAdd" />
                  <label class="form-check-label" for="fleet-steal-focus">Focus newly-added panes</label>
                </div>
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="fleet-notify-change" [(ngModel)]="profile.options.notifyOnChange" />
                  <label class="form-check-label" for="fleet-notify-change">Notify when panes are added or removed</label>
                </div>
              </fieldset>
            </div>
          </ng-template>
        </li>

        <li ngbNavItem>
          <a ngbNavLink>Themes</a>
          <ng-template ngbNavContent>
            <div class="tab-body">
              <ul ngbNav #themeNav="ngbNav" class="nav-tabs fleet-subtabs">
                <li ngbNavItem>
                  <a ngbNavLink>Orchestrator</a>
                  <ng-template ngbNavContent>
                    <div class="theme-grid">
                      <button type="button" class="theme-card" [class.active]="profile.options.rootTheme === null"
                              (click)="profile.options.rootTheme = null">
                        <div class="theme-preview default"><span>default</span></div>
                        <div class="theme-name">(Tabby default)</div>
                      </button>
                      <button type="button" class="theme-card" *ngFor="let t of colorSchemes"
                              [class.active]="profile.options.rootTheme === t.name"
                              (click)="profile.options.rootTheme = t.name">
                        <div class="theme-preview" [style.background]="t.background || '#000'" [style.color]="t.foreground || '#fff'">
                          <div class="sample-line"><span class="prompt" [style.color]="(t.colors || [])[2]">$</span> ls -la</div>
                          <div class="sample-line"><span [style.color]="(t.colors || [])[4]">drwx</span> <span [style.color]="(t.colors || [])[6]">src/</span></div>
                          <div class="color-row">
                            <span class="color-dot" *ngFor="let c of (t.colors || []).slice(0, 8)" [style.background]="c"></span>
                          </div>
                          <div class="color-row">
                            <span class="color-dot" *ngFor="let c of (t.colors || []).slice(8, 16)" [style.background]="c"></span>
                          </div>
                        </div>
                        <div class="theme-name">{{ t.name }}</div>
                      </button>
                    </div>
                  </ng-template>
                </li>
                <li ngbNavItem>
                  <a ngbNavLink>Worker</a>
                  <ng-template ngbNavContent>
                    <div class="theme-grid">
                      <button type="button" class="theme-card" [class.active]="profile.options.worktreeTheme === null"
                              (click)="profile.options.worktreeTheme = null">
                        <div class="theme-preview default"><span>default</span></div>
                        <div class="theme-name">(Tabby default)</div>
                      </button>
                      <button type="button" class="theme-card" *ngFor="let t of colorSchemes"
                              [class.active]="profile.options.worktreeTheme === t.name"
                              (click)="profile.options.worktreeTheme = t.name">
                        <div class="theme-preview" [style.background]="t.background || '#000'" [style.color]="t.foreground || '#fff'">
                          <div class="sample-line"><span class="prompt" [style.color]="(t.colors || [])[2]">$</span> ls -la</div>
                          <div class="sample-line"><span [style.color]="(t.colors || [])[4]">drwx</span> <span [style.color]="(t.colors || [])[6]">src/</span></div>
                          <div class="color-row">
                            <span class="color-dot" *ngFor="let c of (t.colors || []).slice(0, 8)" [style.background]="c"></span>
                          </div>
                          <div class="color-row">
                            <span class="color-dot" *ngFor="let c of (t.colors || []).slice(8, 16)" [style.background]="c"></span>
                          </div>
                        </div>
                        <div class="theme-name">{{ t.name }}</div>
                      </button>
                    </div>
                  </ng-template>
                </li>
              </ul>
              <div class="subtab-content" [ngbNavOutlet]="themeNav"></div>
            </div>
          </ng-template>
        </li>
      </ul>
      <div class="tab-content" [ngbNavOutlet]="topNav"></div>
    </div>
  `,
  styles: [`
    :host .fleet-settings { display: block; padding: 0.5rem 0; }
    :host .fleet-section {
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 0.25rem;
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
    }
    :host .fleet-section legend {
      padding: 0 0.5rem;
      font-weight: 600;
      font-size: 0.95em;
      width: auto;
    }
    :host .form-group { margin-bottom: 0.75rem; }
    :host .form-group label { display: block; margin-bottom: 0.25rem; font-weight: 500; }
    :host .form-group small.form-text { display: block; margin-top: 0.25rem; opacity: 0.7; font-size: 0.85em; }
    :host .form-check { margin-bottom: 0.5rem; }
    :host .form-check-label { margin-left: 0.35rem; }
    :host .fleet-tabs { margin-bottom: 0.75rem; }
    :host .fleet-subtabs { margin-bottom: 0.75rem; }
    :host .tab-body { padding: 0.5rem 0; }
    :host .subtab-content { padding-top: 0.5rem; }
    :host .theme-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 0.75rem;
      margin-top: 0.25rem;
    }
    :host .theme-card {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 0.3rem;
      padding: 0.5rem;
      text-align: left;
      cursor: pointer;
      transition: border-color 120ms, box-shadow 120ms, transform 120ms;
    }
    :host .theme-card:hover {
      border-color: rgba(255, 255, 255, 0.5);
      transform: translateY(-1px);
    }
    :host .theme-card.active {
      border-color: #0d6efd;
      box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.35);
    }
    :host .theme-preview {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px;
      border-radius: 0.2rem;
      font-family: "Consolas", "Cascadia Mono", "Menlo", monospace;
      font-size: 0.8em;
      min-height: 96px;
    }
    :host .theme-preview.default {
      background: rgba(255, 255, 255, 0.04);
      align-items: center;
      justify-content: center;
      color: rgba(255, 255, 255, 0.55);
    }
    :host .theme-preview .sample-line { line-height: 1.25; }
    :host .theme-preview .prompt { font-weight: 600; margin-right: 0.4em; }
    :host .theme-preview .color-row {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 3px;
      margin-top: auto;
    }
    :host .theme-preview .color-dot {
      display: block;
      width: 100%;
      height: 8px;
      border-radius: 1px;
    }
    :host .theme-name {
      margin-top: 0.5rem;
      font-size: 0.85em;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `],
})
export class AgentFleetProfileSettingsComponent implements OnInit {
  @Input() profile!: PartialProfile<AgentFleetProfile> & { options: AgentFleetProfileOptions }

  shellProfiles: Profile[] = []
  colorSchemes: TerminalColorScheme[] = []
  showAdvanced = false

  constructor(
    private platform: PlatformService,
    private profiles: ProfilesService,
    @Inject(TerminalColorSchemeProvider) private schemeProviders: TerminalColorSchemeProvider[],
  ) {}

  async ngOnInit(): Promise<void> {
    const all = await this.profiles.getProfiles({ includeBuiltin: true })
    this.shellProfiles = all.filter(p => p.type === 'local')

    const lists = await Promise.all(this.schemeProviders.map(p => p.getSchemes()))
    const seen = new Set<string>()
    this.colorSchemes = lists.flat().filter(s => {
      if (!s?.name || seen.has(s.name)) return false
      seen.add(s.name)
      return true
    }).sort((a, b) => a.name.localeCompare(b.name))
  }

  async browseRepoPath(): Promise<void> {
    const picked = await this.platform.pickDirectory('Select repository', 'Select')
    if (picked) {
      this.ensureOptions().repoPath = picked
    }
  }

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

}
