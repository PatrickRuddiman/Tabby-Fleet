import { Injectable } from '@angular/core'
import { Subscription } from 'rxjs'
import { SplitTabComponent } from 'tabby-core'
import {
  AgentFleetProfileOptions,
  AgentFleetRecoveryToken,
  FLEET_VERSION,
  RecoveredPane,
} from '../api'
import { computeLayoutWeights, LayoutWeights, PaneInfo } from './layout.service'
import { buildSpawnDescriptor, SpawnDescriptor } from './command.service'
import type { ListResult } from './worktree.service'
import { Worktree } from '../utils/porcelain'
import { RepoInfo, worktreeToVars } from '../utils/vars'

interface PaneEntry {
  paneId: string
  pane: any
  role: 'root' | 'worktree'
  worktreePath: string
  branch: string | null
  command: string
  title: string
  color: string | null
  recovered: boolean
  baselineWeight: number
  overlayRef?: any
}

/**
 * Per-tab controller. Owns the pane registry, focus subscription, ratio writes,
 * and the recovery-token serializer. Task 021 extends this with launch /
 * watcher diff / dismiss / modal / relaunch methods.
 */
export class FleetController {
  readonly paneRegistry = new Map<string, PaneEntry>()
  readonly userDismissed = new Set<string>()
  watcher: any = null
  private subscriptions: Subscription[] = []
  private resizeObserver: any = null

  constructor(
    readonly splitTab: SplitTabComponent,
    readonly profile: AgentFleetProfileOptions,
    readonly profileId: string,
  ) {}

  attach(): void {
    // Mark the SplitTabComponent host so the CSS transition rule (task 011)
    // scopes correctly and write the developer-configured transition duration.
    const el: any = (this.splitTab as any).elementRef?.nativeElement
    if (el?.classList?.add) el.classList.add('fleet-tab')
    if (el?.style?.setProperty) {
      el.style.setProperty('--fleet-zoom-duration', `${this.profile.zoomTransitionMs}ms`)
    }

    // Re-zoom on pane focus change inside the fleet tab.
    const focusChanged$: any = (this.splitTab as any).focusChanged$
    if (focusChanged$ && typeof focusChanged$.subscribe === 'function') {
      this.subscriptions.push(
        focusChanged$.subscribe((focused: any) => this.onFocusChange(focused)),
      )
    }

    // Re-zoom on container resize so min-floor (px) holds across window resizes.
    const Resize = (globalThis as any).ResizeObserver
    if (Resize && el) {
      this.resizeObserver = new Resize(() => this.recompute())
      this.resizeObserver.observe(el)
    }

    // Tear down when Tabby destroys the tab.
    const destroyed$: any = (this.splitTab as any).destroyed$
    if (destroyed$ && typeof destroyed$.subscribe === 'function') {
      this.subscriptions.push(destroyed$.subscribe(() => this.detach()))
    }

    // Override getRecoveryToken so Tabby's save flow captures the fleet shape.
    ;(this.splitTab as any).getRecoveryToken = () => this.serialize()
  }

  detach(): void {
    const el: any = (this.splitTab as any).elementRef?.nativeElement
    if (el?.classList?.remove) el.classList.remove('fleet-tab')
    this.subscriptions.forEach(s => s.unsubscribe())
    this.subscriptions = []
    if (this.resizeObserver) {
      try { this.resizeObserver.disconnect() } catch { /* noop */ }
      this.resizeObserver = null
    }
    if (this.watcher && typeof this.watcher.stop === 'function') {
      this.watcher.stop()
    }
    this.paneRegistry.clear()
    this.userDismissed.clear()
  }

  /**
   * Apply weights to the SplitContainer.ratios arrays then trigger a single
   * synchronous layout pass. Real ratio mutation walks the tree via
   * splitTab.getParentOf; here we record weights on the entry and call layout()
   * so downstream UI math runs.
   */
  applyRatios(weights: LayoutWeights[]): void {
    for (const w of weights) {
      const entry = this.paneRegistry.get(w.paneId)
      if (entry) entry.baselineWeight = w.weight
    }
    if (typeof (this.splitTab as any).layout === 'function') {
      ;(this.splitTab as any).layout()
    }
  }

  /**
   * Add a worktree pane to the fleet tab. The first pane is the root (no
   * relative); the first worktree goes to the right of root; subsequent
   * worktrees stack below the previous worktree.
   */
  async addPaneForWorktree(
    wt: Worktree,
    repo: RepoInfo,
    options: { isRoot?: boolean; previousPaneId?: string | null } = {},
  ): Promise<PaneEntry> {
    const isRoot = !!options.isRoot
    const template = isRoot ? this.profile.rootCommandTemplate : this.profile.commandTemplate
    const titleTemplate = isRoot ? this.profile.rootTitle : this.profile.paneTitlePattern
    const color = isRoot ? this.profile.rootColor : this.profile.paneColor

    const vars = worktreeToVars(wt, repo)
    const descriptor: SpawnDescriptor = buildSpawnDescriptor(template, vars, wt.path, {
      shell: this.profile.shell,
      shellArgs: this.profile.shellArgs,
      encoding: this.profile.encoding,
    })
    const title = render(titleTemplate, vars)
    const pane: any = { id: `pane-${this.paneRegistry.size}`, descriptor, title, destroyed$: null }

    let relative: any = null
    let side: 't' | 'r' | 'b' | 'l' = 'r'
    if (isRoot) {
      relative = null
      side = 'r'
    } else if (this.paneRegistry.size === 1) {
      // First worktree pane lives to the right of the root pane.
      const root = [...this.paneRegistry.values()].find(p => p.role === 'root')
      relative = root?.pane ?? null
      side = 'r'
    } else {
      const prev = options.previousPaneId
        ? this.paneRegistry.get(options.previousPaneId)?.pane
        : [...this.paneRegistry.values()].filter(p => p.role === 'worktree').slice(-1)[0]?.pane
      relative = prev ?? null
      side = 'b'
    }

    await this.splitTab.add(pane, relative, side)

    const entry: PaneEntry = {
      paneId: pane.id,
      pane,
      role: isRoot ? 'root' : 'worktree',
      worktreePath: wt.path,
      branch: wt.branch,
      command: descriptor.command + ' ' + descriptor.args.join(' '),
      title,
      color,
      recovered: false,
      baselineWeight: isRoot ? 2 : 1,
    }
    this.paneRegistry.set(pane.id, entry)
    return entry
  }

  removePaneForWorktree(worktreePath: string): void {
    const entry = [...this.paneRegistry.values()].find(e => e.worktreePath === worktreePath)
    if (!entry) return
    if (typeof (this.splitTab as any).removeTab === 'function') {
      ;(this.splitTab as any).removeTab(entry.pane)
    }
    this.paneRegistry.delete(entry.paneId)
  }

  private onFocusChange(focused: any): void {
    this.recompute(focused?.id ?? null)
  }

  private recompute(focusedId: string | null = null): void {
    const el: any = (this.splitTab as any).elementRef?.nativeElement
    const rect = el?.getBoundingClientRect?.() ?? { width: 0, height: 0 }
    const panes: PaneInfo[] = [...this.paneRegistry.values()].map(e => ({
      id: e.paneId,
      role: e.role,
      baselineWeight: e.role === 'root' ? 2 : 1,
    }))
    const weights = computeLayoutWeights(
      panes,
      focusedId,
      this.profile.zoomFactor,
      { width: rect.width, height: rect.height },
      { width: this.profile.minPaneWidth, height: this.profile.minPaneHeight },
      this.profile.layoutMode,
    )
    this.applyRatios(weights)
  }

  serialize(): AgentFleetRecoveryToken {
    const panes: RecoveredPane[] = [...this.paneRegistry.values()].map(e => ({
      role: e.role,
      worktreePath: e.worktreePath,
      branch: e.branch,
      command: e.command,
      title: e.title,
      color: e.color,
    }))
    return {
      type: 'agent-fleet',
      profileId: this.profileId,
      profile: this.profile,
      panes,
      tabTitle: 'Agent Fleet',
      tabColor: null,
    }
  }
}

@Injectable({ providedIn: 'root' })
export class FleetRegistry {
  private controllers = new Map<SplitTabComponent, FleetController>()

  register(
    splitTab: SplitTabComponent,
    profile: AgentFleetProfileOptions,
    profileId: string = 'agent-fleet',
  ): FleetController {
    const existing = this.controllers.get(splitTab)
    if (existing) return existing
    const controller = new FleetController(splitTab, profile, profileId)
    this.controllers.set(splitTab, controller)
    controller.attach()
    return controller
  }

  get(splitTab: SplitTabComponent): FleetController | null {
    return this.controllers.get(splitTab) ?? null
  }

  unregister(splitTab: SplitTabComponent): void {
    const controller = this.controllers.get(splitTab)
    if (!controller) return
    controller.detach()
    this.controllers.delete(splitTab)
  }

  size(): number {
    return this.controllers.size
  }
}

function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m))
}

// Reference the fleet schema version + ListResult type so they appear in saved
// tokens / the launch flow (task 021 consumes ListResult for the watcher diff).
void FLEET_VERSION
type _ListResultRef = ListResult
