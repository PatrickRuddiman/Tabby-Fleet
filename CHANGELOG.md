# Changelog

All notable changes to this project will be documented in this file. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is [SemVer](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- New profile type **Agent Fleet** registered with Tabby's profile UI.
- One tab per fleet launch: orchestrator pane on the left, one auto-arranged split pane per active git worktree under a configurable prefix on the right.
- Filesystem watcher (`fs.watch` with poll fallback) that adds and removes panes as worktrees appear and disappear on disk, within ~1 second.
- Auto-zoom on focus: focused pane grows to roughly twice baseline; unfocused panes shrink to a configurable minimum (default 120 × 80 px) and never below.
- Static-grid layout mode that disables focus-driven zoom.
- Dead-pane overlay on panes restored after Tabby restart, with a one-click Relaunch button.
- Root-pane close confirmation modal — closing the root closes the entire fleet tab and stops monitoring.
- Manual pane dismissal: closing a worktree pane keeps the worktree on disk and prevents the watcher from re-opening it for the remainder of the session.
- Optional toasts when panes are auto-added or auto-removed.
- 27 configurable settings, per-profile and as a global default tab.
- Template variables for command and title templates: `{path}`, `{path_native}`, `{branch}`, `{branch_short}`, `{name}`, `{head}`, `{head_short}`, `{repo}`, `{repo_path}`.
- PowerShell command-hosting with `encoded` (UTF-16LE base64) and `command` (`& { ... }` wrapper) encoding modes.
- TabRecoveryProvider that round-trips fleet structure across Tabby restarts.
- Optional pre-launch shell command run once before any pane opens.

[Unreleased]: https://github.com/PatrickRuddiman/Tabby-Fleet
