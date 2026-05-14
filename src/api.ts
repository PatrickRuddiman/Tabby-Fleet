// Shared types for the tabby-fleet plugin. Consumed by ProfileProvider,
// FleetController, settings UI, and the recovery provider.

export type SpawnMode = 'eager' | 'lazy'

/**
 * The 27 fields a developer configures per profile (and as a global default
 * under config.store.fleet.defaults). Every field is required; defaults live
 * in DEFAULT_PROFILE_OPTIONS.
 */
export interface AgentFleetProfileOptions {
  // Repo + worktree filtering
  repoPath: string
  includeDetached: boolean
  includePrunable: boolean
  includeLocked: boolean
  // Shell + command
  shellProfileId: string | null
  agentCommand: string
  rootCommandTemplate: string
  // When true the orchestrator pane skips running any agent and just opens
  // the chosen shell — for users who want to drive `git worktree add/remove`
  // by hand from the orchestrator.
  orchestratorShellOnly: boolean
  rootTitle: string
  paneTitlePattern: string
  // Themes (Tabby terminal color scheme names)
  rootTheme: string | null
  worktreeTheme: string | null
  // When true, each new worker pane picks a random color scheme from the
  // installed set instead of using `worktreeTheme`. The orchestrator pane
  // is unaffected.
  worktreeThemeRandom: boolean
  // Layout
  zoomFactor: number
  minPaneWidth: number
  minPaneHeight: number
  zoomTransitionMs: number
  // Grid shape ceiling. The visible grid is at most maxCols × maxRows cells
  // (1 orchestrator + workers). Any worktree beyond that count is parked in
  // the mosaic overlay. Default 3×2 = 6 cells.
  maxCols: number
  maxRows: number
  // Watcher
  autoOpenNew: boolean
  autoCloseRemoved: boolean
  // Notifications + focus
  stealFocusOnAdd: boolean
  notifyOnChange: boolean
  // Spawn behaviour + pre-launch hook
  spawnMode: SpawnMode
  preSpawnCommand: string
}

/**
 * Per-pane metadata attached at construction time. Lives on Tabby's pane/tab
 * `extras` field where possible (see slices/tabby-host §3 decision 2).
 */
export interface FleetPaneMetadata {
  fleetTabId: string
  fleetProfileId: string
  role: 'root' | 'worktree'
  worktreePath: string
  branch: string | null
  fleetVersion: number
  spawnedAt: string
  baselineWeight: number
}

/**
 * One entry per pane in the recovery token. Carries enough information to
 * rebuild the pane with a dead-pane overlay after Tabby restart.
 */
export interface RecoveredPane {
  role: 'root' | 'worktree'
  worktreePath: string
  branch: string | null
  command: string
  title: string
  color: string | null
}

/**
 * Recovery token shape written by FleetController.getRecoveryToken and
 * consumed by AgentFleetRecoveryProvider.recover.
 */
export interface AgentFleetRecoveryToken {
  type: 'agent-fleet'
  profileId: string
  profile: AgentFleetProfileOptions
  panes: RecoveredPane[]
  tabTitle: string
  tabColor: string | null
}

export const FLEET_VERSION = 1

export const DEFAULT_PROFILE_OPTIONS: AgentFleetProfileOptions = {
  repoPath: '',
  includeDetached: false,
  includePrunable: false,
  includeLocked: true,
  shellProfileId: null,
  agentCommand: '',
  rootCommandTemplate: '',
  orchestratorShellOnly: false,
  rootTitle: '{repo} (orchestrator)',
  paneTitlePattern: '{branch_short}',
  rootTheme: null,
  worktreeTheme: null,
  worktreeThemeRandom: false,
  zoomFactor: 2.0,
  minPaneWidth: 120,
  minPaneHeight: 80,
  zoomTransitionMs: 150,
  maxCols: 3,
  maxRows: 2,
  autoOpenNew: true,
  autoCloseRemoved: true,
  stealFocusOnAdd: false,
  notifyOnChange: true,
  spawnMode: 'eager',
  preSpawnCommand: '',
}
