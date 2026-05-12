# tabby-fleet

A [Tabby Terminal](https://tabby.sh) plugin that turns one git repo into one tab with a grid of agent panes — one per worktree.

You point a profile at a repo. The plugin spawns a root pane at the repo root running your orchestrator agent, plus one pane per worktree (anywhere on disk — `git worktree list` is the source of truth) running the agent of your choice, each `cd`'d into its own worktree directory. New worktrees appear as new panes within a second. Closed panes stay closed. Focus zooms.

![status](https://img.shields.io/badge/status-beta-yellow)

## Install

The plugin isn't on Tabby's plugin marketplace yet. Install from source.

```powershell
# Clone and build
git clone https://github.com/PatrickRuddiman/Tabby-Fleet.git
cd Tabby-Fleet
npm install
npm run build
```

Then link the built directory into Tabby's plugin folder. Tabby looks for plugins under `node_modules/tabby-*` inside its data dir.

**Windows (Scoop install of Tabby):**

```powershell
# Replace <CLONE> with the absolute path to your tabby-fleet clone.
$plugins = "$env:USERPROFILE\scoop\persist\tabby\data\plugins\node_modules"
New-Item -ItemType Directory -Force -Path $plugins | Out-Null
New-Item -ItemType Junction -Path "$plugins\tabby-fleet" -Target "<CLONE>"
```

**Windows (default install):**

```powershell
$plugins = "$env:APPDATA\tabby\plugins\node_modules"
New-Item -ItemType Directory -Force -Path $plugins | Out-Null
New-Item -ItemType Junction -Path "$plugins\tabby-fleet" -Target "<CLONE>"
```

**macOS / Linux:**

```bash
PLUGINS="$HOME/.config/tabby/plugins/node_modules"
mkdir -p "$PLUGINS"
ln -s "$(pwd)" "$PLUGINS/tabby-fleet"
```

Restart Tabby. If the plugin loaded you'll see an **Agent Fleet** template under "New profile".

## Run

1. Tabby → **Settings → Profiles → New profile → Agent Fleet**.
2. Configure the profile:
   - **Config tab:**
     - **Repo path** — root of the git repo (Browse… opens a folder picker).
     - **Pre-launch command** — optional, runs once at launch (e.g. `pnpm install`).
     - **Shell** — picks one of your installed Tabby Local profiles (pwsh, bash, wsl, …).
     - **Agent command** — what to run in each worktree pane. E.g. `claude`, `copilot`, `codex`, `opencode`. Runs in the worktree directory.
     - **Filters** — include/exclude detached / prunable / locked worktrees.
     - **Notifications** — focus-on-add and worktree-change toasts.
     - **Advanced** (collapsed) — separate orchestrator command for the root pane and title patterns.
   - **Themes tab:**
     - **Orchestrator** sub-tab — pick a color scheme for the root pane.
     - **Worker** sub-tab — pick a color scheme for the worktree panes.
3. Save the profile. Open it from the profile launcher.

## What to expect

**On open:**

- One tab opens with N panes arranged in a square-ish grid (`cols = ceil(sqrt(N))`, `rows = ceil(N / cols)`).
- The root pane runs your orchestrator command at the repo root. Every other pane is a worktree pane running the agent at its worktree path.
- About 400 ms after the last pane is constructed, the plugin triggers a final layout pass so xterm + PTY + agent are all sized correctly before the agent's banner renders.

**Click a pane:**

- That row gets the larger row weight; that pane gets the larger column weight within its row. The other panes shrink. Focus another pane and the ratios swap.

**`git worktree add` from anywhere:**

- The plugin polls `git worktree list` adaptively (500 ms while activity is recent, backing off to 10 s after one minute of quiet). A new worktree appears as a pane within ~500 ms. Layout rebalances to the new grid. Your typing focus is preserved — the new pane doesn't steal it.

**`git worktree remove` from anywhere:**

- Within ~500 ms the watcher sees the worktree disappear. The plugin tree-kills the agent process and all its descendants (`taskkill /F /T /PID` on Windows; `kill -group` + recursive `pgrep -P` on Unix), releases file handles, then removes the pane. The orchestrator can clean up any leftover directory.

**Close a pane (× button or `exit` in the shell):**

- The plugin tree-kills the agent before Tabby tears the shell down. Then it adds that worktree path to a session-local "dismissed" set so the watcher does NOT reopen the pane even if the worktree is still on disk — letting you safely `git worktree remove` after.

**Close the root pane:**

- Confirmation modal: closes the whole fleet tab.

**Quit and reopen Tabby:**

- The fleet tab is restored from Tabby's tab-recovery system with each pane in a dead state. Click a pane to relaunch its agent.

## Compatibility

- Tabby 1.0.230+ (Angular 15)
- Windows, macOS, Linux
- Tested daily on Windows 11 + Tabby 1.0.233 + pwsh 7 + Claude Code

## Develop

```bash
npm install
npm run watch   # rebuild on every change
npm test        # run the test suite (mocha)
```

The dev junction (above) means every `npm run build` is immediately visible to Tabby on next launch — no reinstall needed.

## License

MIT
