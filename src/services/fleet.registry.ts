import { exec } from 'child_process'
import { promisify } from 'util'
import { ApplicationRef, EnvironmentInjector, Injectable, Injector, createComponent } from '@angular/core'
import { Subscription } from 'rxjs'
import { NotificationsService, ProfilesService, SplitContainer, SplitTabComponent, TabsService } from 'tabby-core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import {
  AgentFleetProfileOptions,
  AgentFleetRecoveryToken,
  FLEET_VERSION,
  RecoveredPane,
} from '../api'
import { killProcessTree, wrapForShell } from './command.service'
import {
  listFilteredWorktrees,
  validateRepoPath,
  type ListResult,
} from './worktree.service'
import { Worktree } from '../utils/porcelain'
import { RepoInfo, worktreeToVars } from '../utils/vars'
import { WorktreeWatcher } from './watcher.service'
import { ConfirmFleetCloseModalComponent } from '../components/confirm-fleet-close-modal.component'
import { FleetDeadPaneOverlayComponent } from '../components/fleet-dead-pane-overlay.component'
import { DrawerItem, FleetWorktreeDrawerComponent } from '../components/fleet-worktree-drawer.component'

const execAsync = promisify(exec)

export interface FleetControllerDeps {
  notifications?: NotificationsService
  modal?: NgbModal
  tabsService?: TabsService
  profilesService?: ProfilesService
  resolveTheme?: (name: string | null) => Promise<any | null>
  randomTheme?: () => Promise<any | null>
  applicationRef?: ApplicationRef
  environmentInjector?: EnvironmentInjector
  injector?: Injector
}

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
  destroySub?: Subscription
  visible?: boolean
  mosaicHost?: boolean
  worktree?: Worktree
  userClosing?: boolean
}

interface ExitedEntry {
  worktreePath: string
  title: string
  branch: string | null
  worktree: Worktree
}

/**
 * Per-tab controller. Owns the pane registry, focus subscription, ratio writes,
 * and the recovery-token serializer. Task 021 extends this with launch /
 * watcher diff / dismiss / modal / relaunch methods.
 */
export class FleetController {
  readonly paneRegistry = new Map<string, PaneEntry>()
  readonly userDismissed = new Set<string>()
  watcher: WorktreeWatcher | null = null
  repoInfo: RepoInfo | null = null
  private subscriptions: Subscription[] = []
  private resizeObserver: any = null
  private drawerRef: any = null
  readonly exitedWorktrees = new Map<string, ExitedEntry>()

  constructor(
    readonly splitTab: SplitTabComponent,
    readonly profile: AgentFleetProfileOptions,
    readonly profileId: string,
    readonly deps: FleetControllerDeps = {},
  ) {}

  /** Configured grid columns, clamped to [1,8]. Defaults to 3 if unset. */
  private get maxCols(): number {
    return Math.min(8, Math.max(1, Math.floor(this.profile.maxCols || 3)))
  }
  /** Configured grid rows, clamped to [1,6]. Defaults to 2 if unset. */
  private get maxRows(): number {
    return Math.min(6, Math.max(1, Math.floor(this.profile.maxRows || 2)))
  }
  /** Total visible cells = maxCols × maxRows. */
  private get maxVisible(): number {
    return this.maxCols * this.maxRows
  }

  /**
   * Return the actual `<split-tab>` DOM host element. `BaseTabComponent`
   * doesn't expose `elementRef`; the host element only appears after Tabby
   * inserts the tab into its app container (via `viewContainerEmbeddedRef`)
   * or via the `hostView`'s root nodes. Fall back to a pane's parentElement
   * if neither is wired yet.
   */
  private hostElement(): HTMLElement | undefined {
    const tab: any = this.splitTab
    const fromEmbedded: HTMLElement | undefined = tab?.viewContainerEmbeddedRef?.rootNodes?.[0]
    if (fromEmbedded && typeof fromEmbedded.appendChild === 'function') return fromEmbedded
    const fromHostView: HTMLElement | undefined = tab?.hostView?.rootNodes?.[0]
    if (fromHostView && typeof fromHostView.appendChild === 'function') return fromHostView
    for (const entry of this.paneRegistry.values()) {
      const paneEl: HTMLElement | undefined = tab?.viewRefs?.get(entry.pane)?.rootNodes?.[0]
      const parent = paneEl?.parentElement as HTMLElement | null | undefined
      if (parent && typeof parent.appendChild === 'function') return parent
    }
    return undefined
  }

  attach(): void {
    // Mark the SplitTabComponent host so the CSS transition rule (task 011)
    // scopes correctly and write the developer-configured transition duration.
    // BaseTabComponent doesn't expose ElementRef directly; the host element is
    // accessible via viewContainerEmbeddedRef once Tabby has inserted the tab.
    // At attach() time it may not be ready yet — retry on the next frame.
    const applyHostStyles = () => {
      const el = this.hostElement()
      if (!el) return false
      if (!el.classList.contains('fleet-tab')) el.classList.add('fleet-tab')
      if (el.style?.setProperty) {
        el.style.setProperty('--fleet-zoom-duration', `${this.profile.zoomTransitionMs}ms`)
      }
      return true
    }
    if (!applyHostStyles()) {
      setTimeout(applyHostStyles, 0)
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
    const attachResizeObserver = () => {
      if (!Resize || this.resizeObserver) return
      const host = this.hostElement()
      if (!host) {
        setTimeout(attachResizeObserver, 100)
        return
      }
      this.resizeObserver = new Resize(() => this.recompute())
      this.resizeObserver.observe(host)
    }
    attachResizeObserver()

    // Tear down when Tabby destroys the tab.
    const destroyed$: any = (this.splitTab as any).destroyed$
    if (destroyed$ && typeof destroyed$.subscribe === 'function') {
      this.subscriptions.push(destroyed$.subscribe(() => this.detach()))
    }

    // Override getRecoveryToken so Tabby's save flow captures the fleet shape.
    ;(this.splitTab as any).getRecoveryToken = () => this.serialize()
  }

  detach(): void {
    const el = this.hostElement()
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
    for (const entry of this.paneRegistry.values()) {
      entry.destroySub?.unsubscribe()
    }
    this.paneRegistry.clear()
    this.userDismissed.clear()
    this.exitedWorktrees.clear()
    this.destroyDrawer()
  }

  /**
   * Reshape `splitTab.root` into a grid:
   *   - Outer container is vertical, holding one row per grid row.
   *   - Each row container is horizontal, holding that row's panes.
   * Grid dimensions: cols = ceil(sqrt(N)), rows = ceil(N / cols).
   * Pane order in the grid follows insertion order from `paneRegistry` (root
   * pane first, then worktrees as they were added).
   *
   * If `focusedPane` is provided, that row gets a larger row ratio and the
   * pane gets a larger column ratio within its row — visible zoom-on-focus.
   * Pass `null` for a uniform layout.
   *
   * Tab instances are reused (we move references, not recreate them) so PTYs
   * stay alive across rebuilds.
   */
  rebuildGrid(focusedPane: any = null): void {
    const entries = [...this.paneRegistry.values()]
    if (entries.length === 0) {
      this.destroyDrawer()
      return
    }

    // Reset flags; recomputed below.
    for (const e of entries) { e.visible = true; e.mosaicHost = false }

    // Partition into visible grid + hidden overflow when over the cap.
    // Slot 1 = orchestrator. Slots 2..maxVisible = workers[0..maxVisible-2].
    // Beyond maxVisible the worker panes stay mounted at ratio 0 so PTYs and
    // scrollback survive; they appear in the Worktree Drawer as inactive
    // cards and can be swapped back into slot maxVisible on click.
    let activeEntries: PaneEntry[] = entries
    let hiddenEntries: PaneEntry[] = []
    let forceShape = false

    if (entries.length > this.maxVisible) {
      const orchestrator = entries.find(e => e.role === 'root') ?? entries[0]
      const workers = entries.filter(e => e !== orchestrator)
      const activeWorkers = workers.slice(0, this.maxVisible - 1)
      const overflow = workers.slice(this.maxVisible - 1)
      activeEntries = [orchestrator, ...activeWorkers]
      hiddenEntries = overflow
      for (const e of hiddenEntries) e.visible = false
      forceShape = true
    }

    const N = activeEntries.length
    // When at the cap (overflow path) the grid shape is the user-configured
    // maxCols × maxRows. Below the cap the grid scales naturally so smaller
    // fleets still look like a sensible square-ish arrangement.
    const cols = forceShape ? this.maxCols : Math.ceil(Math.sqrt(N))
    const rows = forceShape ? this.maxRows : Math.ceil(N / cols)
    const zoom = Math.max(1, this.profile.zoomFactor || 1)

    // Partition active panes into rows (row-major).
    const rowGroups: PaneEntry[][] = []
    for (let r = 0; r < rows; r++) {
      rowGroups.push(activeEntries.slice(r * cols, (r + 1) * cols))
    }

    // Locate focused pane in the grid (only honoured when visible).
    let focusedRow = -1
    let focusedCol = -1
    if (focusedPane) {
      for (let r = 0; r < rowGroups.length; r++) {
        const c = rowGroups[r].findIndex(e => e.pane === focusedPane)
        if (c >= 0) { focusedRow = r; focusedCol = c; break }
      }
    }

    // Row weights → outer vertical ratios.
    const rowWeights = rowGroups.map((_, r) => (r === focusedRow ? zoom : 1))
    const rowTotal = rowWeights.reduce((a, b) => a + b, 0)
    const outerRatios = rowWeights.map(w => w / rowTotal)

    // Build new tree.
    const outer = new SplitContainer()
    outer.orientation = 'v'
    outer.children = []
    outer.ratios = []
    for (let r = 0; r < rowGroups.length; r++) {
      const group = rowGroups[r]
      const colWeights = group.map((_, c) => (r === focusedRow && c === focusedCol) ? zoom : 1)
      const colTotal = colWeights.reduce((a, b) => a + b, 0)
      const colRatios = colWeights.map(w => w / colTotal)

      // Single pane in a row: don't bother nesting a horizontal container,
      // just put the pane directly in the outer column.
      if (group.length === 1) {
        outer.children.push(group[0].pane)
        outer.ratios.push(outerRatios[r])
      } else {
        const rowContainer = new SplitContainer()
        rowContainer.orientation = 'h'
        rowContainer.children = group.map(e => e.pane)
        rowContainer.ratios = colRatios
        outer.children.push(rowContainer)
        outer.ratios.push(outerRatios[r])
      }
    }

    // Park hidden panes as ratio-0 siblings of the visible rows so Tabby
    // keeps their viewRefs mounted (PTYs stay alive, scrollback survives).
    for (const e of hiddenEntries) {
      outer.children.push(e.pane)
      outer.ratios.push(0)
    }

    const splitTabAny = this.splitTab as any
    splitTabAny.root = outer
    if (typeof splitTabAny.layout === 'function') splitTabAny.layout()

    this.syncDrawer(activeEntries, hiddenEntries)
  }

  /**
   * Build the Active / Inactive item lists for the drawer and ensure the
   * drawer component is mounted on the fleet tab's root element. The drawer
   * is always present once the fleet has any pane; it just sits collapsed as
   * a chevron strip until the user opens it.
   */
  private syncDrawer(activeEntries: PaneEntry[], hiddenEntries: PaneEntry[]): void {
    const activeItems: DrawerItem[] = activeEntries.map(e => ({
      key: e.paneId,
      title: e.title,
      branch: e.branch,
      kind: 'alive-active' as const,
    }))
    const parkedItems: DrawerItem[] = hiddenEntries.map(e => ({
      key: e.paneId,
      title: e.title,
      branch: e.branch,
      kind: 'alive-parked' as const,
    }))
    const exitedItems: DrawerItem[] = [...this.exitedWorktrees.values()].map(e => ({
      key: e.worktreePath,
      title: e.title,
      branch: e.branch,
      kind: 'exited' as const,
    }))
    const inactiveItems = [...parkedItems, ...exitedItems]

    const mountEl = this.hostElement()
    if (!mountEl) {
      // Host element not ready yet — Tabby hasn't inserted the splitTab into
      // its container. Try again on the next tick.
      setTimeout(() => this.rebuildGrid(), 0)
      return
    }

    if (this.drawerRef) {
      const instance = this.drawerRef.instance
      instance.activeItems = activeItems
      instance.inactiveItems = inactiveItems
      instance.onSelect = (item: DrawerItem) => this.onDrawerClick(item)
      try { this.drawerRef.changeDetectorRef?.detectChanges() } catch { /* noop */ }
      const node: HTMLElement = this.drawerRef.location.nativeElement
      if (node.parentElement !== mountEl) mountEl.appendChild(node)
      return
    }

    const envInjector = this.deps.environmentInjector
    const appRef = this.deps.applicationRef
    if (!envInjector || !appRef) return

    const ref = createComponent(FleetWorktreeDrawerComponent, {
      environmentInjector: envInjector,
      elementInjector: this.deps.injector,
    })
    ref.instance.activeItems = activeItems
    ref.instance.inactiveItems = inactiveItems
    ref.instance.onSelect = (item: DrawerItem) => this.onDrawerClick(item)
    appRef.attachView(ref.hostView)
    try { ref.changeDetectorRef.detectChanges() } catch { /* noop */ }
    mountEl.appendChild(ref.location.nativeElement)
    this.drawerRef = ref
  }

  private destroyDrawer(): void {
    if (!this.drawerRef) return
    const ref = this.drawerRef
    try {
      const node: HTMLElement | undefined = ref.location?.nativeElement
      if (node?.parentElement) node.parentElement.removeChild(node)
    } catch { /* noop */ }
    try { this.deps.applicationRef?.detachView(ref.hostView) } catch { /* noop */ }
    try { ref.destroy?.() } catch { /* noop */ }
    this.drawerRef = null
  }

  /**
   * Drawer card click dispatcher:
   *   - alive-active   → focus that pane in the grid
   *   - alive-parked   → swap into slot maxVisible (last visible slot),
   *                      displacing whatever was there into the parked pool
   *   - exited         → spawn a fresh pane for the worktree
   */
  onDrawerClick(item: DrawerItem): void {
    if (item.kind === 'alive-active') {
      const entry = this.paneRegistry.get(item.key)
      if (entry) {
        try { (this.splitTab as any).focus?.(entry.pane) } catch { /* noop */ }
      }
      return
    }
    if (item.kind === 'alive-parked') {
      this.bringIntoLastSlot(item.key)
      return
    }
    if (item.kind === 'exited') {
      void this.relaunchExited(item.key)
      return
    }
  }

  /**
   * Spawn a fresh worker pane for a previously-exited worktree. Appended to
   * the end of the registry; if total panes pushes past maxVisible the
   * extras spill into the drawer's Inactive section on the next rebuildGrid.
   */
  async relaunchExited(worktreePath: string): Promise<void> {
    const exited = this.exitedWorktrees.get(worktreePath)
    if (!exited || !this.repoInfo) return
    // addPaneForWorktree clears both maps on its own, but delete preemptively
    // so the drawer doesn't briefly show the about-to-launch card.
    this.exitedWorktrees.delete(worktreePath)
    this.userDismissed.delete(worktreePath)
    try {
      await this.addPaneForWorktree(exited.worktree, this.repoInfo)
    } catch (err: any) {
      // Put it back so the user can try again.
      this.exitedWorktrees.set(worktreePath, exited)
      this.notify('error', `Failed to relaunch ${exited.title}`, String(err?.message ?? err))
      this.rebuildGrid()
    }
  }

  /**
   * Swap the promoted parked worker into slot maxVisible (last visible cell),
   * displacing slot maxVisible's current occupant into the parked pool.
   * Orchestrator (slot 1) is never touched.
   *
   * No tab is added or removed; PTYs survive. Map insertion order = grid order.
   */
  bringIntoLastSlot(promotedPaneId: string): void {
    const promoted = this.paneRegistry.get(promotedPaneId)
    if (!promoted || promoted.role !== 'worktree') return
    const all = [...this.paneRegistry.values()]
    const orchestrator = all.find(e => e.role === 'root')
    if (!orchestrator) return
    const workers = all.filter(e => e !== orchestrator)
    // workers[0..maxVisible-2] fill slots 2..maxVisible. Last visible worker
    // slot = workers[maxVisible - 2].
    const lastSlotIndex = this.maxVisible - 2
    const displaced = workers[lastSlotIndex]
    if (!displaced || displaced.paneId === promotedPaneId) return
    const visibleWorkers = workers.slice(0, lastSlotIndex).filter(e => e !== promoted)
    const rest = workers.filter(e => e !== promoted && e !== displaced && !visibleWorkers.includes(e))
    const newWorkers = [...visibleWorkers, promoted, ...rest, displaced]

    this.paneRegistry.clear()
    this.paneRegistry.set(orchestrator.paneId, orchestrator)
    for (const w of newWorkers) this.paneRegistry.set(w.paneId, w)

    this.rebuildGrid(promoted.pane)
    try { (this.splitTab as any).focus?.(promoted.pane) } catch { /* noop */ }
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
    // Orchestrator pane resolution:
    //   - shell-only flag wins → empty template → wrapForShell returns the
    //     bare shell argv (just a plain shell, no agent)
    //   - else rootCommandTemplate if explicitly set (Advanced override)
    //   - else fall back to the shared agentCommand
    const rootOverride = (this.profile.rootCommandTemplate ?? '').trim()
    const template = isRoot
      ? (this.profile.orchestratorShellOnly
          ? ''
          : rootOverride !== '' ? rootOverride : this.profile.agentCommand)
      : this.profile.agentCommand
    const titleTemplate = isRoot ? this.profile.rootTitle : this.profile.paneTitlePattern
    const color: string | null = null

    const vars = worktreeToVars(wt, repo)
    const agentCommand = render(template, vars)
    const title = render(titleTemplate, vars)

    if (!this.deps.tabsService || !this.deps.profilesService) {
      throw new Error('FleetController missing tabsService/profilesService deps')
    }

    const localProfile = await this.resolveShellProfile()
    if (!localProfile) {
      this.notify('error', 'Agent Fleet: no local shell profile available')
      throw new Error('no local shell profile')
    }

    const baseOptions = (localProfile as any).options ?? {}
    const wrapped = wrapForShell(baseOptions.command ?? '', baseOptions.args ?? [], agentCommand)
    // Worker random-theme mode wins over a configured worktreeTheme so users
    // can opt into per-pane variety without clearing their saved selection.
    // Orchestrator theme is always the fixed `rootTheme` regardless.
    let resolvedScheme: any = null
    if (!isRoot && this.profile.worktreeThemeRandom && this.deps.randomTheme) {
      resolvedScheme = await this.deps.randomTheme()
    } else {
      const themeName = isRoot ? this.profile.rootTheme : this.profile.worktreeTheme
      resolvedScheme = this.deps.resolveTheme ? await this.deps.resolveTheme(themeName) : null
    }
    const clonedProfile: any = {
      ...localProfile,
      id: `agent-fleet:${isRoot ? 'root' : 'wt'}:${this.paneRegistry.size}`,
      name: title,
      isBuiltin: false,
      isTemplate: false,
      // Force tabby-terminal to destroy worker panes when their session ends
      // (agent process exits → shell exits → PTY closes). Without this the
      // user's default behaviorOnSessionEnd (typically 'auto') leaves the
      // pane lingering. Orchestrator inherits the user default so a manual
      // `exit` doesn't surprise-close the fleet.
      ...(isRoot ? {} : { behaviorOnSessionEnd: 'close' as const }),
      // Tabby's TerminalTab reads profile.terminalColorScheme (top-level, not
      // inside options) for the active scheme. Resolved scheme object — not a
      // { name } stub — is what `configureColors` consumes.
      ...(resolvedScheme ? { terminalColorScheme: resolvedScheme } : {}),
      options: {
        ...baseOptions,
        cwd: wt.path,
        command: wrapped.command,
        args: wrapped.args,
      },
    }

    const provider = this.deps.profilesService.providerForProfile(clonedProfile)
    if (!provider) {
      this.notify('error', `Agent Fleet: no profile provider for type "${clonedProfile.type}"`)
      throw new Error('no provider')
    }
    const params = await provider.getNewTabParameters(clonedProfile as any)
    const tab: any = this.deps.tabsService.create(params)
    if (typeof tab.setTitle === 'function') tab.setTitle(title)

    // Attach the tab through Tabby's normal lifecycle (DOM mount, PTY spawn,
    // tab-event registration). The 'side' here is irrelevant — `rebuildGrid`
    // will replace splitTab.root immediately afterwards with the correct grid
    // tree. We just need add() to wire `tab.parent` and run attachTabView.
    const lastEntry = [...this.paneRegistry.values()].slice(-1)[0]
    const relative: any = isRoot ? null : (lastEntry?.pane ?? null)
    await this.splitTab.add(tab, relative, 'r')

    const paneId = clonedProfile.id
    const entry: PaneEntry = {
      paneId,
      pane: tab,
      role: isRoot ? 'root' : 'worktree',
      worktreePath: wt.path,
      branch: wt.branch,
      command: `${wrapped.command} ${wrapped.args.join(' ')}`.trim(),
      title,
      color,
      recovered: false,
      baselineWeight: isRoot ? 2 : 1,
      worktree: wt,
    }
    this.paneRegistry.set(paneId, entry)
    // Re-launch wins over a prior dismiss / exit; the pane is alive again.
    this.userDismissed.delete(wt.path)
    this.exitedWorktrees.delete(wt.path)

    if (!isRoot) {
      const destroyed$: any = tab.destroyed$ ?? tab.closed$
      if (destroyed$ && typeof destroyed$.subscribe === 'function') {
        entry.destroySub = destroyed$.subscribe(() => {
          if (entry.userClosing) {
            // User clicked X / closed the tab → permanent dismiss.
            this.userDismissed.add(entry.worktreePath)
          } else if (entry.worktree) {
            // Agent process exited on its own → keep the worktree available
            // for relaunch via the mosaic.
            this.exitedWorktrees.set(entry.worktreePath, {
              worktreePath: entry.worktreePath,
              title: entry.title,
              branch: entry.branch,
              worktree: entry.worktree,
            })
          }
          this.paneRegistry.delete(entry.paneId)
          this.rebuildGrid()
        })
      }
    }

    // Override canClose so Tabby's "X is still running. Kill?" prompt never
    // fires for our panes. Tabby's LocalTerminalTabComponent.canClose checks
    // session.getChildProcesses() and prompts the user when an agent is
    // alive — but our model is "the agent IS the pane", so the answer is
    // always "kill the agent and proceed". We tree-kill first (so the agent
    // and its descendants release their handles before Tabby tears down the
    // shell PTY), then return true. Works for individual pane close, fleet
    // tab close, and full Tabby window close (which propagates canClose
    // through every pane).
    const tabAny: any = tab
    if (typeof tabAny.canClose === 'function' && !tabAny.__fleetCanCloseWrapped) {
      tabAny.canClose = async () => {
        // Flag this pane as user-dismissed before tear-down so the destroyed$
        // subscription routes it to userDismissed instead of the exited queue.
        entry.userClosing = true
        await this.killPaneChildren(tab)
        return true
      }
      tabAny.__fleetCanCloseWrapped = true
    }

    // Also wrap session.destroy as a belt-and-suspenders measure for any code
    // path that reaches teardown without going through canClose (shell exit,
    // PTY-side errors). Fire-and-forget so Tabby's teardown isn't blocked.
    const session: any = (tab as any).session
    if (session && typeof session.destroy === 'function' && !session.__fleetKillWrapped) {
      const origDestroy = session.destroy.bind(session)
      session.destroy = (...args: any[]) => {
        void this.killPaneChildren(tab)
        return origDestroy(...args)
      }
      session.__fleetKillWrapped = true
    }

    // Reshape into the grid right after attach.
    this.rebuildGrid()

    return entry
  }

  async removePaneForWorktree(worktreePath: string): Promise<void> {
    const entry = [...this.paneRegistry.values()].find(e => e.worktreePath === worktreePath)
    if (!entry) return
    entry.destroySub?.unsubscribe()
    // Watcher-driven path: we have time to await the tree-kill before tearing
    // the shell down, so file locks are guaranteed released before the next
    // operation (typically the user's already-failed `git worktree remove`
    // retry, or our own cleanup of the leftover dir).
    await this.killPaneChildren(entry.pane)
    if (typeof (this.splitTab as any).removeTab === 'function') {
      ;(this.splitTab as any).removeTab(entry.pane)
    }
    this.paneRegistry.delete(entry.paneId)
  }

  private onFocusChange(focused: any): void {
    // Tabby's tab components don't carry our paneId. Identify the focused
    // pane by reference equality against the registry.
    const focusedPane = focused && [...this.paneRegistry.values()].some(e => e.pane === focused)
      ? focused
      : null
    this.rebuildGrid(focusedPane)
  }

  /**
   * Rebuild the grid using whichever pane is currently focused (per the
   * SplitTab). Used by ResizeObserver and any out-of-band rebalance trigger.
   */
  recompute(): void {
    const focused = (this.splitTab as any).getFocusedTab?.() ?? null
    this.rebuildGrid(focused)
  }

  /**
   * Launch sequence per fleet-lifecycle slice §5: resolve repo path → validate
   * → run pre-launch command → list filtered worktrees → attach watcher →
   * build initial panes (root first, then worktrees) → apply baseline ratios.
   * Aborts on any failure with a NotificationsService.error if injected.
   */
  async launch(): Promise<void> {
    const repoPath = (this.profile.repoPath ?? '').trim()
    if (!repoPath) {
      this.notify('error', 'Agent Fleet launch failed', 'No repo path configured')
      return
    }

    const valid = await validateRepoPath(repoPath)
    if (valid.ok !== true) {
      const err = (valid as { ok: false; error: { message: string } }).error
      this.notify('error', 'Not a git repository', `${repoPath}: ${err.message}`)
      return
    }

    if (this.profile.preSpawnCommand && this.profile.preSpawnCommand.trim()) {
      try {
        await execAsync(this.profile.preSpawnCommand, { cwd: repoPath, timeout: 30000 })
      } catch (err: any) {
        const code = err?.code ?? err?.exitCode ?? 'error'
        this.notify(
          'error',
          'Pre-launch command failed',
          `${this.profile.preSpawnCommand} exited with code ${code}`,
        )
        return
      }
    }

    const filterOptions = {
      repoPath,
      includeDetached: this.profile.includeDetached,
      includePrunable: this.profile.includePrunable,
      includeLocked: this.profile.includeLocked,
    }
    const listed: ListResult = await listFilteredWorktrees(repoPath, filterOptions)
    if (listed.ok !== true) {
      const err = (listed as { ok: false; error: { message: string } }).error
      this.notify('error', 'Failed to list worktrees', err.message)
      return
    }
    const okListed = listed as { ok: true; value: { repo: RepoInfo; worktrees: Worktree[] } }
    this.repoInfo = okListed.value.repo

    // Attach watcher (adaptive `git worktree list` poller).
    this.watcher = new WorktreeWatcher(repoPath, () => { void this.onWatcherChange() })
    this.watcher.start()

    // Build initial pane set (root + filtered worktrees).
    let previousPaneId: string | null = null
    const repoInfo = this.repoInfo
    for (const wt of okListed.value.worktrees) {
      const previousFocused = (this.splitTab as any).getFocusedTab?.()
      const entry: PaneEntry = await this.addPaneForWorktree(wt, repoInfo, {
        isRoot: wt.isMain,
        previousPaneId,
      })
      previousPaneId = entry.paneId
      // Tabby's onAfterTabAdded queues `focus(newTab)` on setImmediate; restore
      // via setTimeout(…, 0) which runs after that setImmediate fires.
      if (!this.profile.stealFocusOnAdd && previousFocused) {
        setTimeout(() => (this.splitTab as any).focus?.(previousFocused), 0)
      }
    }

    // Final settle: wait for xterm + PTY + agent process to finish their
    // startup writes, then force one more grid pass. xterm doesn't reflow
    // already-rendered rows on resize, so the goal is to make sure the
    // final pane dims are propagated to the PTY before the agent's prompt
    // begins drawing.
    setTimeout(() => this.rebuildGrid(), 400)
  }

  /** Re-list, diff against current worktree panes, add/remove, rebalance. */
  async onWatcherChange(): Promise<void> {
    if (!this.repoInfo) return
    const filterOptions = {
      repoPath: this.repoInfo.path,
      includeDetached: this.profile.includeDetached,
      includePrunable: this.profile.includePrunable,
      includeLocked: this.profile.includeLocked,
    }
    const listed = await listFilteredWorktrees(this.repoInfo.path, filterOptions)
    if (listed.ok !== true) return
    const okWatch = listed as { ok: true; value: { repo: RepoInfo; worktrees: Worktree[] } }

    const incoming = new Map(
      okWatch.value.worktrees.filter(w => !w.isMain).map(w => [w.path, w]),
    )
    const currentPaths = new Set(
      [...this.paneRegistry.values()].filter(e => e.role === 'worktree').map(e => e.worktreePath),
    )

    const toAdd: Worktree[] = []
    for (const [path, wt] of incoming) {
      if (!currentPaths.has(path) && !this.userDismissed.has(path)) toAdd.push(wt)
    }
    const toRemove: string[] = []
    if (this.profile.autoCloseRemoved) {
      for (const path of currentPaths) {
        if (!incoming.has(path)) toRemove.push(path)
      }
    }

    let changed = false

    if (this.profile.autoOpenNew) {
      for (const wt of toAdd) {
        const previousFocused = (this.splitTab as any).getFocusedTab?.()
        const entry = await this.addPaneForWorktree(wt, this.repoInfo)
        if (!this.profile.stealFocusOnAdd && previousFocused) {
          setTimeout(() => (this.splitTab as any).focus?.(previousFocused), 0)
        }
        if (this.profile.notifyOnChange) {
          this.notify('info', `Worktree added: ${entry.title}`)
        }
        changed = true
      }
    }

    for (const path of toRemove) {
      const entry = [...this.paneRegistry.values()].find(e => e.worktreePath === path)
      await this.removePaneForWorktree(path)
      if (this.profile.notifyOnChange) {
        this.notify('info', `Worktree closed: ${entry?.title ?? path}`)
      }
      changed = true
    }

    // A worktree gone from `git worktree list` can no longer be relaunched —
    // drop any stale exited entries so the mosaic stays accurate.
    for (const path of [...this.exitedWorktrees.keys()]) {
      if (!incoming.has(path)) {
        this.exitedWorktrees.delete(path)
        changed = true
      }
    }

    if (changed) {
      this.rebuildGrid()
      setTimeout(() => this.rebuildGrid(), 400)
    }
  }

  /** Mark a worktree path as user-dismissed; remove its pane; never re-open in this fleet. */
  async dismissPane(worktreePath: string): Promise<void> {
    this.userDismissed.add(worktreePath)
    await this.removePaneForWorktree(worktreePath)
    this.rebuildGrid()
  }

  /** Open the close-confirmation modal; resolve true on confirm, false on cancel. */
  async confirmRootClose(): Promise<boolean> {
    if (!this.deps.modal) return true
    const ref: any = this.deps.modal.open(ConfirmFleetCloseModalComponent)
    if (ref?.componentInstance) {
      ref.componentInstance.repoName = this.repoInfo?.name ?? ''
    }
    try {
      const result = await ref.result
      return result === true
    } catch {
      return false
    }
  }

  /** Re-run a dead pane's stored command. Clears the recovered flag and tears down its overlay. */
  async relaunchPane(paneId: string): Promise<void> {
    const entry = this.paneRegistry.get(paneId)
    if (!entry) return
    entry.recovered = false
    if (entry.overlayRef) {
      try { entry.overlayRef.destroy?.() } catch { /* noop */ }
      entry.overlayRef = null
    }
  }

  /**
   * Marker reference so webpack keeps FleetDeadPaneOverlayComponent in the
   * bundle for runtime overlay attachment (per fleet-lifecycle §5 step 11).
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private static readonly _overlayRef = FleetDeadPaneOverlayComponent

  private notify(kind: 'info' | 'error' | 'notice', text: string, details?: string): void {
    const svc = this.deps.notifications as any
    if (!svc) return
    if (kind === 'info' && typeof svc.info === 'function') svc.info(text, details)
    else if (kind === 'error' && typeof svc.error === 'function') svc.error(text, details)
    else if (kind === 'notice' && typeof svc.notice === 'function') svc.notice(text)
  }

  /**
   * Enumerate the immediate children of a pane's shell PTY and force-kill
   * each subtree. Tabby's own pty.kill() only terminates the shell process —
   * descendants (the agent process, its sub-agents, file watchers, etc.) are
   * left orphaned and keep file handles on the worktree directory, blocking
   * `git worktree remove` on Windows. We kill those subtrees first so the
   * shell's exit releases all locks cleanly.
   */
  private async killPaneChildren(pane: any): Promise<void> {
    const session: any = pane?.session
    if (!session || typeof session.getChildProcesses !== 'function') return
    let children: any[] = []
    try {
      children = (await session.getChildProcesses()) ?? []
    } catch { return }
    const pids = children
      .map(c => typeof c?.pid === 'number' ? c.pid : null)
      .filter((p): p is number => p !== null && p > 0)
    if (pids.length === 0) return
    await Promise.all(pids.map(p => killProcessTree(p)))
  }

  /**
   * Find the Tabby Local profile the user selected for fleet panes. Falls back
   * to the first available local profile when `shellProfileId` is null or the
   * stored id no longer resolves (the user deleted that profile, etc.).
   */
  private async resolveShellProfile(): Promise<any | null> {
    const svc = this.deps.profilesService as any
    if (!svc || typeof svc.getProfiles !== 'function') return null
    const wanted = this.profile.shellProfileId
    const all: any[] = await svc.getProfiles({ includeBuiltin: true })
    const byId = wanted ? all.find(p => p?.id === wanted) : null
    if (byId) return byId
    const locals = all.filter(p => p?.type === 'local')
    if (locals.length > 0) return locals[0]
    const fallback = all.find(p => p && !p.isTemplate && p.type !== 'agent-fleet' && p.options?.command)
    return fallback ?? null
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
    deps: FleetControllerDeps = {},
  ): FleetController {
    const existing = this.controllers.get(splitTab)
    if (existing) return existing
    const controller = new FleetController(splitTab, profile, profileId, deps)
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
