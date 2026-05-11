# tabby-fleet — Specification

## §1 Summary

A developer who runs multiple coding agents in parallel across git worktrees today manages each agent in a separate terminal tab — manually creating tabs, navigating each to the right worktree, and starting an agent inside it. When a new worktree is created (often by an orchestrator agent the developer is directing), a tab has to be opened for it by hand. When a worktree is merged and removed, its tab has to be closed by hand. This friction discourages the parallel-agent workflow it should enable.

`tabby-fleet` adds a profile type to the host terminal application that, on launch, opens one tab anchored to a git repository. The tab contains a root pane running an orchestrator agent at the repo root, plus one pane per active git worktree under a configurable path inside the repo. Each worktree pane runs an agent inside that worktree's directory. The plugin watches the filesystem and adds or removes panes in real time as worktrees come and go on disk. Focusing a pane enlarges it; the others shrink but remain visible and clickable.

Top-level promises:
- A single profile launch produces the root pane and one pane per matching worktree, with no manual tab or pane creation.
- A worktree added under the configured prefix on disk produces a corresponding pane within 1 second; a removed worktree closes its pane within 1 second.
- The focused pane occupies approximately twice the area of unfocused panes within the same container, and unfocused panes never shrink below the developer-configured minimum size.
- Manual dismissal of a worktree pane prevents it from reappearing for the rest of the session, even if the worktree remains on disk.
- The root pane cannot be closed accidentally; closing it requires explicit confirmation and closes the entire fleet tab.
- All filtering, command, layout, watch, and notification behavior is configurable per profile and as a default across profiles; defaults work out of the box on a fresh install.

## §2 Behavior

Personas: **developer** — the only persona. The developer configures profiles, launches fleets, drives the orchestrator agent in the root pane, and interacts with the worktree panes.

**Profile management — user stories**

- *As a developer*, I want to create an Agent Fleet profile and have it appear alongside other profile types in the host terminal's profile UI.
- *As a developer*, I want to edit any setting on an Agent Fleet profile and have the change take effect on the next launch from that profile.
- *As a developer*, I want a profile to default to "use the current working directory at launch time" so I can launch a fleet against any repo without per-repo configuration.
- *As a developer*, I want to set a default value for each configurable behavior across all Agent Fleet profiles and override any of those defaults per profile.
- *As a developer*, I want to delete an Agent Fleet profile through the host terminal's normal profile management.

**Fleet launch — user stories**

- *As a developer*, I want to launch an Agent Fleet profile and have a single new tab open with the root pane already running my chosen orchestrator command in the repo root directory.
- *As a developer*, I want the tab to automatically include one pane per existing worktree under the configured prefix at launch, with each pane running my chosen worktree command in that worktree's directory.
- *As a developer*, I want worktrees that fall outside the configured filters (path prefix, detached, prunable, locked) to be excluded from the initial fleet.
- *As a developer*, I want an optional pre-launch shell command to run once before any panes open, so I can perform setup that all panes depend on.
- *As a developer*, I want each pane's title to be rendered from a template I can configure, populated from variables that describe the worktree.

**Orchestration via the root pane — user stories**

- *As a developer*, I want to instruct the agent in the root pane to create a worktree, and have the resulting new worktree appear as a new pane in my fleet without any further action from me.
- *As a developer*, I want to instruct the agent in the root pane to remove a worktree, and have the corresponding pane close without any further action from me.

**Focus and layout — user stories**

- *As a developer*, I want clicking or otherwise focusing a pane to enlarge it relative to the others, so the agent I'm currently directing has the most screen space.
- *As a developer*, I want unfocused panes to remain visible and clickable at a configurable minimum size, even when many worktrees are present.
- *As a developer*, I want the root pane to sit on the left half of the tab at baseline (no pane focused), with worktree panes stacked on the right, so the layout is predictable across launches.
- *As a developer*, I want worktree pane ordering to be stable across launches given the same set of worktrees.
- *As a developer*, I want focusing the root pane to enlarge it the same way focusing a worktree pane does.
- *As a developer*, I want to choose between an auto-zoom layout (focus enlarges the focused pane) and a static layout (all panes share space equally regardless of focus).
- *As a developer*, I want a brief animated transition when the layout changes, with the animation duration configurable.

**Pane lifecycle — user stories**

- *As a developer*, I want to manually close a worktree pane and have the underlying worktree remain on disk, so closing a pane is purely a UI action.
- *As a developer*, I want a worktree pane I dismissed manually not to reappear in the same fleet, even while the underlying worktree remains on disk and my watch mode is active.
- *As a developer*, I want to be prompted before the root pane closes, with the prompt explicitly stating that confirming will close the entire fleet tab.
- *As a developer*, I want closing the fleet tab to stop all filesystem monitoring associated with it.
- *As a developer*, I want an optional notification each time a pane is auto-added or auto-removed, so I'm aware of fleet changes without losing focus.
- *As a developer*, I want pane-add events to optionally steal focus (off by default), so newly added agents don't yank me out of what I'm doing.

**Visual distinction — user stories**

- *As a developer*, I want to assign an optional color tag to root panes and a separate optional color tag to worktree panes, so I can tell their roles apart at a glance.

**Restart and persistence — user stories**

- *As a developer*, I want a fleet tab to reappear after the host application restarts, with its previous layout structure intact, so I don't lose orientation.
- *As a developer*, I want each restored pane to indicate that its command is not running, and to offer a one-click relaunch action that re-runs the originally configured command for that pane.

**Acceptance — examples**

- *Given* a profile configured with repo path `C:\dev\wineapi`, worktree path prefix `.claude/worktrees/`, root command template `claude`, worktree command template `claude --resume {branch}`, and the repo has two worktrees at `.claude/worktrees/add-stripe-webhooks` (branch `agent/add-stripe-webhooks`) and `.claude/worktrees/refactor-db-layer` (branch `agent/refactor-db-layer`), *when* the profile is launched, *then* a new tab opens containing three panes: a root pane on the left running `claude` with working directory `C:\dev\wineapi`, and two right-side panes stacked vertically running `claude --resume agent/add-stripe-webhooks` and `claude --resume agent/refactor-db-layer` in their respective worktree directories.
- *Given* a fleet is open with a root pane and two worktree panes, *when* an external process runs `git worktree add .claude/worktrees/new-feature -b agent/new-feature` in the repo, *then* within 1 second a third worktree pane appears in the right column, runs the configured worktree command for the new worktree, the three right-side panes resize to share the right column evenly, and focus remains on whichever pane the developer last had focused.
- *Given* a fleet is open with a root pane and three worktree panes, *when* an external process runs `git worktree remove .claude/worktrees/refactor-db-layer`, *then* within 1 second the corresponding pane closes, the remaining two worktree panes resize to share the right column evenly, and the visible content of unaffected panes is preserved.
- *Given* a fleet has a root pane and four worktree panes A, B, C, D evenly stacked on the right, *when* the developer clicks pane B, *then* pane B's visible area grows to approximately twice its previous share of the right column, panes A, C, and D shrink proportionally, the root pane's share is unchanged, and the transition completes within the configured duration (default 150 milliseconds).
- *Given* a fleet has a root pane and three worktree panes on the right, *when* the developer clicks the root pane, *then* the root pane's share of the tab width grows from approximately one-half to approximately two-thirds, the right-side worktree panes collectively shrink to approximately one-third of the tab width while preserving their relative sizing to each other, and the transition completes within the configured duration.
- *Given* a fleet contains ten worktree panes plus the root, and the configured minimum pane height is 80 pixels, *when* the developer focuses any worktree pane, *then* unfocused worktree panes shrink only until they hit 80 pixels in height, the focused pane grows by whatever room remains (which may be less than twice its baseline), and no pane is rendered smaller than the minimum.
- *Given* a fleet has three worktree panes, *when* the developer manually closes the middle worktree pane, *then* that pane disappears, the remaining two panes resize to share the right column evenly, the underlying worktree remains on disk, and no new pane is auto-created for that worktree path for the remainder of the session — even if a filesystem event for that path fires later.
- *Given* a fleet has a root pane, *when* the developer attempts to close the root pane, *then* a confirmation prompt appears stating that confirming will close the entire fleet tab; if the developer confirms, the entire fleet tab closes and all filesystem monitoring associated with it stops; if the developer cancels, no panes change.
- *Given* a profile with an empty repo path is launched while the host terminal's active tab has a valid git repository as its working directory, *when* the launch begins, *then* that working directory is used as the repo root and the launch proceeds normally.
- *Given* a profile is launched whose repo path is not a git repository, *when* the launch begins, *then* the launch aborts within 2 seconds with a user-visible error identifying the path and the reason; no tab opens.
- *Given* a profile has a non-empty pre-launch shell command, *when* the launch begins, *then* the pre-launch command runs to completion before any pane opens; if it exits non-zero, the launch aborts with a user-visible error showing the command name and exit code, and no tab opens.
- *Given* a worktree's branch name contains characters that would normally need shell quoting (e.g. `agent/feature with spaces`, or `agent/quote"name`), *when* the worktree's pane is created, *then* the configured worktree command receives the branch name exactly as the rendered template specifies, with no quoting errors and no argument truncation.
- *Given* watch mode is set to filesystem-event-based and the repo is on a network share where filesystem events do not fire reliably, *when* a worktree is added externally, *then* the corresponding pane appears within one poll interval (default 5 seconds) because the system falls back to periodic polling; a one-time user-visible notice on the fleet tab indicates which watch mode is active.
- *Given* the host terminal application is closed with a fleet tab open, *when* it is restarted, *then* the fleet tab reappears with the same number of panes in the same layout positions; each pane shows that its command is not running and presents a one-click action to relaunch the command originally configured for that pane.

**Failure modes**

- *Repo path does not resolve to a git repository* — launch aborts with a user-visible error identifying the path; no tab opens.
- *Repo path is empty and the current working directory is not a git repository* — the developer is prompted with a folder picker; canceling aborts the launch with no tab opened; selecting an invalid folder aborts the launch with a user-visible error.
- *Pre-launch command exits non-zero* — launch aborts with a user-visible error showing the command name and exit code; no tab opens.
- *Filesystem-event watcher fails to attach* — the system falls back to periodic polling at the configured interval, and a one-time user-visible notice on the fleet tab states that the fallback occurred and which mode is active.
- *A worktree is added under the prefix but excluded by another filter (detached/prunable/locked when the corresponding inclusion setting is off)* — no pane opens for it and no notification fires.
- *A worktree is reported by git but its path is not present on disk* — the pane opens, the configured command runs in the shell, the resulting error output (from the shell or the agent) is visible in the pane, and the pane remains open for relaunch.
- *Number of worktrees is large enough that minimum-size floors consume all available space* — newly added panes still appear; the focused pane grows by less than the configured zoom factor; no pane renders below the configured minimum.
- *Same repo path is launched in two fleet tabs simultaneously* — both tabs open independently, each with its own monitoring; worktree changes are reflected in both.
- *Configured root or worktree command is not on `PATH`* — the pane opens, the shell starts, and the shell's "command not found" error is visible in the pane; the pane remains open.
- *A pane's command exits on its own* — the pane remains open showing the shell prompt; the system does not close panes in response to command exit.
- *The fleet tab is closed manually* — all monitoring tied to that tab stops; no orphaned watchers remain.
- *The host application is force-quit while a fleet tab is open* — on next launch the fleet tab is restored per the restart user story; no settings or profile data is corrupted by the abrupt close.

## §3 Scope

In:
- A new profile type, named for orchestrating multiple agents across git worktrees, selectable in the same place as other profile types in the host terminal application.
- Per-profile and global-default configuration of the following behaviors:
  - Repo path (explicit absolute path, or empty to mean "use current working directory at launch").
  - Worktree path prefix that bounds which worktrees become panes.
  - Whether detached worktrees are included.
  - Whether prunable worktrees are included.
  - Whether locked worktrees are included.
  - Root pane command template.
  - Root pane title template.
  - Worktree pane command template.
  - Worktree pane title template.
  - Optional root pane color.
  - Optional worktree pane color.
  - Layout mode: auto-zoom grid or static grid.
  - Zoom factor (multiplier applied to the focused pane's baseline share).
  - Minimum pane width in pixels.
  - Minimum pane height in pixels.
  - Layout transition duration in milliseconds.
  - Watch mode: filesystem events, periodic polling, or off.
  - Poll interval in milliseconds (used when watch mode is polling, or when filesystem events fall back to polling).
  - Whether newly detected worktrees auto-open as panes.
  - Whether removed worktrees auto-close their panes.
  - Whether pane-add events steal focus.
  - Whether pane-add and pane-remove events surface a notification.
  - Spawn mode: eager (all panes opened at launch) or lazy (panes open on first interaction).
  - Optional pre-launch shell command.
  - Shell program and argument list used to host each pane's command.
- Template variables available in command and title templates: absolute worktree path with forward slashes, absolute worktree path with native separators, full branch name, branch name with the first slash-separated segment removed, final path component of the worktree, full HEAD commit hash, first seven characters of the HEAD hash, repo name, repo root absolute path.
- For the root pane's templates, the same variables resolve relative to the main worktree, except branch-related variables resolve to the repo's current branch; for detached worktrees, branch variables resolve to a synthetic identifier including the short HEAD hash.
- Worktree filter rules applied in order: path-prefix match (case-insensitive on Windows); detached inclusion; prunable inclusion; locked inclusion.
- Stable ordering of worktree panes by ascending absolute path.
- Auto-zoom grid layout: root pane on the left at one-half tab width at baseline; worktree panes stacked vertically on the right and sharing the right half evenly at baseline; focusing any pane enlarges its share to approximately the configured zoom factor times its baseline within its container, with the others shrinking proportionally but never below the configured minimum dimensions.
- Static grid layout: same baseline as the auto-zoom grid, but focus changes do not resize panes.
- Real-time pane addition when a new worktree appearing under the configured prefix matches the filters.
- Real-time pane removal when a worktree under the configured prefix is no longer present (subject to the auto-close-removed setting).
- Per-fleet-tab in-memory tracking of worktree paths whose panes were manually dismissed, so they are not auto-recreated for the remainder of that tab's lifetime.
- Confirmation prompt before root-pane close; confirming closes the entire fleet tab.
- Cleanup of all filesystem monitoring when a fleet tab closes.
- Restoration of fleet tab layout after host-application restart, with each restored pane indicating its command is not running and offering a one-click relaunch.
- Optional notifications when a pane is auto-added or auto-removed.
- Optional color distinction between root panes and worktree panes.

Out:
- Creation, deletion, or pruning of worktrees by the plugin itself (the developer or the orchestrator agent performs these via git directly).
- Merge, pull-request, or review workflows.
- Configuration of the agent CLI itself beyond what is passed through the command and argument templates.
- A single fleet containing worktrees from more than one repository.
- Remote git repositories or non-local paths.
- Monitoring of the working tree contents of any worktree (only the set of worktrees, not their contents, is watched).
- A status dashboard summarizing agent activity across panes.
- A toolbar button, keyboard shortcut, or menu action that triggers fleet operations outside the normal profile-launch flow.
- Per-pane fleet-specific right-click actions (open in editor, run diff, restart agent, remove worktree).
- Auto-relaunch of pane commands on host-application restart (restart leaves dead panes that the developer relaunches with one click).
- A manual zoom toggle separate from focus-driven zoom.
- Worktree creation UI inside the plugin.
- Cross-session persistence of manually dismissed worktree paths (dismissal is per-fleet-tab in-memory only).
- Status badges or decorators reflecting agent state per pane.

## §4 Quality bars

- A worktree added or removed under the configured prefix is reflected in the fleet tab within 1 second when watch mode is filesystem-event-based, or within one poll interval (default 5000 milliseconds) when polling.
- Focus-driven zoom transition completes within the configured duration (default 150 milliseconds).
- Unfocused panes are never rendered below the configured minimum dimensions; defaults are 120 pixels wide and 80 pixels tall.
- A fleet with up to 10 worktree panes shows no frame drops at 60 Hz during a focus-change transition.
- Launching a profile whose repo path does not resolve to a git repository aborts within 2 seconds with a user-visible error.
- Closing the fleet tab releases all filesystem monitoring within 100 milliseconds.
- Branch names and worktree paths containing spaces, double quotes, single quotes, backslashes, or non-ASCII characters are passed to the configured command exactly as rendered, with no quoting errors and no argument truncation.
- Per-profile and global default settings persist across host-application restarts.
- v0.1 ships with defaults configured for Windows. On macOS and Linux the developer must override the shell program and argument list for v0.1; cross-platform shell defaults are deferred to a later release.
- Notifications fire at most once per pane add/remove event, within 1 second of the pane change.

## §5 Open questions

- For v0.1, is macOS and Linux a supported configuration (the developer overrides the shell setting and the plugin works) or unsupported (Windows-only)?
- When the same repo path is opened in two simultaneous fleet tabs, should the second launch warn the developer, silently open a second fleet, or refuse?
- After restart, should a dead pane block input until relaunched, or accept input as a plain shell so the developer can use it manually before relaunching?
- When a profile is edited while a fleet from that profile is open, do any changes apply live (color, minimum pane dimensions, layout mode, transition duration) or do all changes require a relaunch?
- If a worktree is renamed on disk (removed under one path and added under another with the same branch within a short time window), is this treated as remove-then-add (pane closes and a new pane opens), or as a rename (one pane persists and only retitles)?
- Should the "command not running" indicator on restored panes also appear when a pane's command exits during normal operation (not just after restart), or is that case strictly handled by the pane staying open at the shell prompt?

> If any requirement is ambiguous, stop and ask. Before producing a plan, list your assumptions and the implementation choices you intend to make. Do not write code until those are confirmed.

---

Implementation plan: see [plan.md](plan.md) for the phased roadmap, verified Tabby API findings, and reference code starters preserved from the v0.3 draft of this spec.
