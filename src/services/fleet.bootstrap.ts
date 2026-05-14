import { ApplicationRef, EnvironmentInjector, Injectable, Injector } from '@angular/core'
import { AppService, NotificationsService, ProfilesService, SplitTabComponent, TabsService } from 'tabby-core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { TerminalColorScheme, TerminalColorSchemeProvider } from 'tabby-terminal'
import { FleetRegistry } from './fleet.registry'
import { AgentFleetProfileOptions } from '../api'

/**
 * Subscribes to AppService.tabOpened$ and, whenever a SplitTabComponent
 * arrives with `fleetProfile` set as an input, registers it with FleetRegistry
 * and kicks off FleetController.launch(). Without this hook nothing would
 * actually spawn panes when the user opens an Agent Fleet profile.
 */
@Injectable({ providedIn: 'root' })
export class FleetBootstrap {
  // Per-fleet-tab cache so we only ask each color-scheme provider once. Cleared
  // lazily when getProviders() runs and finds a new set.
  private schemesPromise: Promise<TerminalColorScheme[]> | null = null

  // ProfilesService and TerminalColorSchemeProvider are resolved lazily via
  // `Injector.get(...)` to avoid DI cycles. ProfilesService is in a real cycle
  // (PROFILE_PROVIDER multi -> AgentFleetProfileProvider -> FleetBootstrap ->
  // ProfilesService). For TerminalColorSchemeProvider this is just defensive —
  // by the time `onTabOpened` fires the root injector is fully initialized.
  constructor(
    private readonly app: AppService,
    private readonly fleetRegistry: FleetRegistry,
    private readonly tabsService: TabsService,
    private readonly notifications: NotificationsService,
    private readonly modal: NgbModal,
    private readonly injector: Injector,
    private readonly applicationRef: ApplicationRef,
    private readonly environmentInjector: EnvironmentInjector,
  ) {
    this.app.tabOpened$.subscribe((tab: any) => this.onTabOpened(tab))
  }

  private onTabOpened(tab: any): void {
    if (!tab) return
    const fleetProfile = tab?.fleetProfile as AgentFleetProfileOptions | undefined
    if (!fleetProfile) return
    const profileId = tab?.fleetProfileId ?? 'agent-fleet'
    setTimeout(() => {
      const profilesService = this.injector.get(ProfilesService)
      const controller = this.fleetRegistry.register(tab, fleetProfile, profileId, {
        notifications: this.notifications,
        modal: this.modal,
        tabsService: this.tabsService,
        profilesService,
        resolveTheme: (name: string | null) => this.resolveTheme(name),
        randomTheme: () => this.randomTheme(),
        applicationRef: this.applicationRef,
        environmentInjector: this.environmentInjector,
        injector: this.injector,
      })
      void controller.launch()
    }, 0)
  }

  private async randomTheme(): Promise<TerminalColorScheme | null> {
    const schemes = await this.getSchemes()
    if (schemes.length === 0) return null
    return schemes[Math.floor(Math.random() * schemes.length)]
  }

  private async getSchemes(): Promise<TerminalColorScheme[]> {
    if (!this.schemesPromise) {
      this.schemesPromise = (async () => {
        const providers = this.injector.get<TerminalColorSchemeProvider[]>(
          TerminalColorSchemeProvider as any, [] as any,
        )
        if (!Array.isArray(providers) || providers.length === 0) return []
        const lists = await Promise.all(providers.map(p => p.getSchemes()))
        return lists.flat().filter((s): s is TerminalColorScheme => !!s && !!s.name)
      })().catch(err => {
        console.warn('[agent-fleet] Failed to enumerate color schemes:', err)
        return []
      })
    }
    return this.schemesPromise
  }

  private async resolveTheme(name: string | null): Promise<TerminalColorScheme | null> {
    if (!name) return null
    const schemes = await this.getSchemes()
    return schemes.find(s => s.name === name) ?? null
  }
}
