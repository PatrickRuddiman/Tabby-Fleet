# tabby-fleet

A [Tabby Terminal](https://github.com/Eugeny/tabby) plugin that opens one tab per git repository with the orchestrator agent running in a root pane and one auto-arranged split pane per active git worktree under a configurable path. A filesystem watcher keeps the splits in sync as worktrees come and go. Focusing a pane enlarges it; the others shrink but stay visible.

## Install

```sh
npm install tabby-fleet
```

For local development, build then symlink into Tabby's plugin directory:

```sh
npm run build
# Windows
mklink /D %APPDATA%\tabby\plugins\node_modules\tabby-fleet C:\path\to\tabby-fleet
# macOS / Linux
ln -s /absolute/path/to/tabby-fleet ~/.config/tabby/plugins/node_modules/tabby-fleet
```

Restart Tabby. The **Agent Fleet** profile type appears in Settings → Profiles → New.

## Quickstart

1. Open Tabby's profile editor and create a new **Agent Fleet** profile.
2. Set **Repo path** to your repository (leave empty to use the current working directory at launch).
3. Defaults run `claude` at the repo root and `claude --resume {branch}` in each worktree under `.claude/worktrees/`.
4. Launch the profile. A tab opens with a left-side orchestrator pane plus one stacked pane per existing worktree.
5. Direct the orchestrator agent ("Create a worktree for X, refactor Y in another worktree"). New worktrees on disk become new panes within ~1 second; removed ones close their panes.

## Settings reference

| Setting | Default | Description |
|---|---|---|
| Repo path | `""` | Absolute repo path. Empty = use current working directory at launch. |
| Worktree path prefix | `.claude/worktrees/` | Only worktrees under this prefix open as panes. |
| Include detached | `false` | Open panes for detached-HEAD worktrees. |
| Include prunable | `false` | Open panes for worktrees git has marked as prunable. |
| Include locked | `true` | Open panes for locked worktrees. |
| Root command template | `claude` | Command run in the root (orchestrator) pane. |
| Root title template | `{repo} (orchestrator)` | Title shown on the root pane tab. |
| Worktree command template | `claude --resume {branch}` | Command run in each worktree pane. |
| Worktree title template | `{branch_short}` | Title shown on each worktree pane tab. |
| Root pane color | (unset) | Optional hex color for the root pane tag. |
| Worktree pane color | (unset) | Optional hex color for worktree pane tags. |
| Layout mode | `grid` | `grid` (auto-zoom on focus) or `static-grid` (no zoom). |
| Zoom factor | `2.0` | Focused pane grows to this multiple of baseline (1.0–4.0). |
| Min pane width | `120` | Pixel floor for pane width. |
| Min pane height | `80` | Pixel floor for pane height. |
| Zoom transition (ms) | `150` | Animation duration for focus zoom (0–1000). |
| Watch mode | `fs` | `fs` events, `poll` periodic, or `off` (no auto-sync). |
| Poll interval (ms) | `5000` | Used by `poll` mode or filesystem fallback (500–60000). |
| Auto-open new | `true` | Open a pane when a worktree appears on disk. |
| Auto-close removed | `true` | Close the pane when a worktree disappears from disk. |
| Steal focus on add | `false` | New panes steal focus instead of inheriting prior focus. |
| Notify on change | `true` | Show a toast when a pane is auto-added/removed. |
| Spawn mode | `eager` | `eager` (open all at launch) or `lazy` (open on demand). |
| Pre-launch command | `""` | Shell command run once before any pane opens; non-zero exit aborts. |
| Shell program | `pwsh.exe` | Executable hosting each pane's command (Windows default). |
| Shell args | `["-NoExit", "-EncodedCommand"]` | One argument per line in the settings UI. |
| Encoding mode | `encoded` | `encoded` (UTF-16LE base64) or `command` (`& { ... }` wrapper). |

The same fields are also editable as global defaults under **Settings → Agent Fleet defaults**. New profiles inherit those defaults; existing profiles keep their own values.

## Template variables

Available in `commandTemplate`, `rootCommandTemplate`, `paneTitlePattern`, `rootTitle`:

| Variable | Resolves to |
|---|---|
| `{path}` | Absolute worktree path (forward slashes) |
| `{path_native}` | Absolute worktree path (native OS separators) |
| `{branch}` | Full branch name (e.g. `agent/add-stripe-webhooks`) |
| `{branch_short}` | Branch with the first slash-separated segment removed (e.g. `add-stripe-webhooks`) |
| `{name}` | Final path component of the worktree |
| `{head}` | Full HEAD commit hash |
| `{head_short}` | First 7 characters of the HEAD hash |
| `{repo}` | Repo name (final component of the repo root path) |
| `{repo_path}` | Absolute path to the repo root |

`{{` and `}}` escape to literal `{` and `}`. Unknown placeholders are left as-is so typos are visible at the shell prompt.

Worked example with `commandTemplate = "claude --resume {branch}"` and a worktree at `C:/dev/wineapi/.claude/worktrees/add-stripe-webhooks` on branch `agent/add-stripe-webhooks`:

```
claude --resume agent/add-stripe-webhooks
```

## Layout modes

- **`grid` (default)** — root pane on the left at 50% width; worktree panes stacked vertically on the right, sharing the other 50% evenly. Focusing any pane enlarges it (default ~2× baseline within its container) while the others shrink but never below the configured minimum dimensions.
- **`static-grid`** — same baseline layout, but focus does not resize panes. Useful when many worktrees are open and the zoom animation feels distracting.

## Filesystem watcher modes

- **`fs` (default)** — uses `fs.watch` on `<repo>/.git/worktrees/`. Reflects worktree changes within ~1 second.
- **`poll`** — periodic `git worktree list` every `pollIntervalMs` (default 5 s). Use this on network shares or filesystems where `fs.watch` is unreliable.
- **`off`** — no auto-sync. New worktrees do not appear until you relaunch the profile.

When `fs` mode fails to attach (network shares, certain Docker volumes), the plugin falls back to polling automatically and shows a one-time notification indicating which mode is active.

## Troubleshooting

- **"Not a git repository: ..."** — the profile's repo path doesn't resolve to a git repo. Open the profile editor and confirm the path.
- **"command not found" in a pane** — the configured `commandTemplate` references a binary that isn't on `PATH`. The pane stays open at the shell prompt so you can investigate.
- **Worktree appeared on disk but no pane opened** — the worktree may be outside `worktreePathPrefix`, detached, prunable, or locked. Adjust the filter settings.
- **Watcher silently stopped working** — common on network shares. Set `watchMode` to `poll` in the profile. The plugin already falls back automatically and notifies on launch.
- **Plugin doesn't appear in Tabby** — restart Tabby. Confirm `tabby-plugin` is in the package's `keywords` and that the package is symlinked into Tabby's plugin directory.
- **macOS / Linux: panes don't open** — v0.1 ships Windows defaults (`pwsh.exe` + `-EncodedCommand`). Override `shell` and `shellArgs` per profile (e.g. `shell = "bash"`, `shellArgs = ["-c"]`, `encoding = "command"`). Cross-platform defaults are deferred to a later release.

## Platform support

- **Windows**: fully supported with shipped defaults.
- **macOS / Linux**: works with developer-supplied shell config (override `shell` and `shellArgs` per profile). Shipped defaults coming in a later release.

## Spec and design

See `spec.md` (behavior-only WHAT/WHY), `plan.md` (phased implementation roadmap with verified Tabby API findings), and `slices/` (per-vertical design docs).

## License

MIT.
