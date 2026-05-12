import { exec } from 'child_process'
import { promisify } from 'util'
import { Injectable } from '@angular/core'
import { Subscription } from 'rxjs'
import { NotificationsService, ProfilesService, SplitContainer, SplitTabComponent, TabsService } from 'tabby-core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import {
  AgentFleetProfileOptions,
  AgentFleetRecoveryToken,
  FLEET_VERSION,
  RecoveredPane,
} from '../api'
import { computeLayoutWeights, LayoutWeights, PaneInfo } from './layout.service'
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

const execAsync = promisify(exec)

export interface FleetControllerDeps {
  notifications?: NotificationsService
  modal?: NgbModal
  tabsService?: TabsService
  profilesService?: ProfilesService
  resolveTheme?: (name: string | null) => Promise<any | null>
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

  constructor(
    readonly splitTab: SplitTabComponent,
    readonly profile: AgentFleetProfileOptions,
    readonly profileId: string,
    readonly deps: FleetControllerDeps = {},
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
    for (const entry of this.paneRegistry.values()) {
      entry.destroySub?.unsubscribe()
    }
    this.paneRegistry.clear()
    this.userDismissed.clear()
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
    if (entries.length === 0) return

    const N = entries.length
    const cols = Math.ceil(Math.sqrt(N))
    const rows = Math.ceil(N / cols)
    const zoom = Math.max(1, this.profile.zoomFactor || 1)

    // Partition panes into rows (row-major).
    const rowGroups: PaneEntry[][] = []
    for (let r = 0; r < rows; r++) {
      rowGroups.push(entries.slice(r * cols, (r + 1) * cols))
    }

    // Locate focused pane in the grid.
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

    const splitTabAny = this.splitTab as any
    splitTabAny.root = outer
    if (typeof splitTabAny.layout === 'function') splitTabAny.layout()
  }

  /**
   * Backwards-compatible shim. Old code paths (recompute, watcher diff) call
   * applyRatios; route them through rebuildGrid so a single mechanism owns
   * the layout.
   */
  applyRatios(_weights: LayoutWeights[]): void {
    const focused = (this.splitTab as any).getFocusedTab?.() ?? null
    this.rebuildGrid(focused)
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
    const template = isRoot ? this.profile.rootCommandTemplate : this.profile.agentCommand
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
    const themeName = isRoot ? this.profile.rootTheme : this.profile.worktreeTheme
    const resolvedScheme = this.deps.resolveTheme ? await this.deps.resolveTheme(themeName) : null
    const clonedProfile: any = {
      ...localProfile,
      id: `agent-fleet:${isRoot ? 'root' : 'wt'}:${this.paneRegistry.size}`,
      name: title,
      isBuiltin: false,
      isTemplate: false,
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
    }
    this.paneRegistry.set(paneId, entry)

    if (!isRoot) {
      const destroyed$: any = tab.destroyed$ ?? tab.closed$
      if (destroyed$ && typeof destroyed$.subscribe === 'function') {
        entry.destroySub = destroyed$.subscribe(() => {
          this.userDismissed.add(entry.worktreePath)
          this.paneRegistry.delete(entry.paneId)
          this.rebuildGrid()
        })
      }
    }

    // Wrap session.destroy so that whenever Tabby tears down this pane (× button,
    // shell exit, fleet close), we first tree-kill the agent and its descendants.
    // Without this the shell dies via TerminateProcess but its child processes
    // (claude.exe, sub-agents, watchers) become orphans that keep file handles on
    // the worktree dir — blocking `git worktree remove` on Windows.
    const session: any = (tab as any).session
    if (session && typeof session.destroy === 'function' && !session.__fleetKillWrapped) {
      const origDestroy = session.destroy.bind(session)
      session.destroy = (...args: any[]) => {
        // Fire-and-forget — don't block Tabby's teardown.
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

  recompute(focusedId: string | null = null): void {
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
      'grid',
    )
    this.applyRatios(weights)
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
