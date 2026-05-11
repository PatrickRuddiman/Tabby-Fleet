// Shared types for the tabby-fleet plugin. Consumed by ProfileProvider,
// FleetController, settings UI, and the recovery provider.

export type LayoutMode = 'grid' | 'static-grid'
export type WatchMode = 'fs' | 'poll' | 'off'
export type SpawnMode = 'eager' | 'lazy'
export type EncodingMode = 'encoded' | 'command'

/**
 * The 27 fields a developer configures per profile (and as a global default
 * under config.store.fleet.defaults). Every field is required; defaults live
 * in DEFAULT_PROFILE_OPTIONS.
 */
export interface AgentFleetProfileOptions {
  // Repo + worktree filtering
  repoPath: string
  worktreePathPrefix: string
  includeDetached: boolean
  includePrunable: boolean
  includeLocked: boolean
  // Command + title templates
  rootCommandTemplate: string
  rootTitle: string
  commandTemplate: string
  paneTitlePattern: string
  // Optional pane colors (hex string or null)
  rootColor: string | null
  paneColor: string | null
  // Layout
  layoutMode: LayoutMode
  zoomFactor: number
  minPaneWidth: number
  minPaneHeight: number
  zoomTransitionMs: number
  // Watcher
  watchMode: WatchMode
  pollIntervalMs: number
  autoOpenNew: boolean
  autoCloseRemoved: boolean
  // Notifications + focus
  stealFocusOnAdd: boolean
  notifyOnChange: boolean
  // Spawn behaviour + pre-launch hook
  spawnMode: SpawnMode
  preSpawnCommand: string
  // Shell that hosts each pane's command
  shell: string
  shellArgs: string[]
  encoding: EncodingMode
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
  worktreePathPrefix: '.claude/worktrees/',
  includeDetached: false,
  includePrunable: false,
  includeLocked: true,
  rootCommandTemplate: 'claude',
  rootTitle: '{repo} (orchestrator)',
  commandTemplate: 'claude --resume {branch}',
  paneTitlePattern: '{branch_short}',
  rootColor: null,
  paneColor: null,
  layoutMode: 'grid',
  zoomFactor: 2.0,
  minPaneWidth: 120,
  minPaneHeight: 80,
  zoomTransitionMs: 150,
  watchMode: 'fs',
  pollIntervalMs: 5000,
  autoOpenNew: true,
  autoCloseRemoved: true,
  stealFocusOnAdd: false,
  notifyOnChange: true,
  spawnMode: 'eager',
  preSpawnCommand: '',
  shell: 'pwsh.exe',
  shellArgs: ['-NoExit', '-EncodedCommand'],
  encoding: 'encoded',
}
