# Plan: Implement `tabby-fleet` plugin

> **Spec:** [spec.md](spec.md) — behavior-only definition of WHAT and WHY. This plan covers HOW.

## Context

The spec describes `tabby-fleet`, a Tabby Terminal plugin adding an **Agent Fleet** profile type. One profile launch produces a single tab anchored at a git repo: a root pane runs an orchestrator agent at the repo root, and one auto-arranged split pane runs per active worktree under a configurable prefix (default `.claude/worktrees/`). A filesystem watcher keeps the splits in sync. Focused panes auto-zoom; others shrink to a minimum floor.

The working directory `C:\Users\prudd\source\repos\tabby-ai-worktree` is an empty git repo (just `spec.md` and this file). The plugin is built from scratch into this directory as an npm package with the `tabby-plugin` keyword.

**Why:** spec §1 — managing N terminal tabs by hand for parallel-agent worktree workflows is the friction this plugin removes.

## Tabby API capability — verified

Confirmed against Tabby's source (`tabby-core/src/components/splitTab.component.ts`):

| Need | Tabby API | Notes |
|---|---|---|
| Open a SplitTabComponent programmatically | `TabsService.create()` + `AppService.openNewTab()` | Standard for any custom split tab use |
| Add a pane at a specific position | `SplitTabComponent.add(tab, relative, side)` — sides `'t'\|'r'\|'b'\|'l'` | Grid build: root → `.add(wt1, root, 'r')` → `.add(wt2, wt1, 'b')` → `.add(wt3, wt2, 'b')` … |
| Set per-pane size | `SplitContainer.ratios: number[]` — direct mutation; sum must equal 1; call `layout()` to apply | No setter method; pure-fn LayoutService emits normalized ratio arrays per container |
| Animate size changes | None built-in | Apply CSS `transition: width 150ms ease-out, height 150ms ease-out` to pane host elements; mutate `ratios` and let Tabby's `layout()` write new `%` values |
| Subscribe to pane focus events | `SplitTabComponent.focusChanged$` (and per-pane `focused$`/`blurred$`) | Use `focusChanged$` in fleet.service |
| Built-in maximize | `SplitTabComponent.maximize(tab)` — fixed 90/90, no animation | Fallback for spec §5 (animation jank with 10+ panes): offer as a hotkey instead of auto-zoom if needed |
| Pane metadata persistence | Tab/pane `extras` field — restart-survival UNVERIFIED | Day-1 Phase 4 task: write `extras`, restart, verify; fall back to ConfigService keyed by tab UUID if not |

**Decision:** the auto-zoom grid layout described in spec §2 ("Focus and layout" stories) is achievable. The `static-grid` alternative listed in spec §3 In stays as a documented option for users who want no zoom. The third "tabbed" mode from the v0.3 draft is dropped from v0.1.

## Files to create

```
tabby-ai-worktree/
├── package.json                  # tabby-plugin keyword, peer deps on tabby-*
├── webpack.config.js
├── tsconfig.json
├── README.md                     # install, quickstart, troubleshooting
├── src/
│   ├── index.ts                  # @NgModule, exports providers
│   ├── api.ts                    # AgentFleetProfileOptions, FleetPaneMetadata types
│   ├── services/
│   │   ├── fleet.service.ts      # launch + lifecycle, watcher event handler
│   │   ├── worktree.service.ts   # spawn git, return parsed Worktree[]
│   │   ├── watcher.service.ts    # FSWatcher with poll fallback (Appendix A.2)
│   │   ├── layout.service.ts     # computeLayoutWeights pure fn (Appendix A.5)
│   │   └── command.service.ts    # render template + pwsh encode
│   ├── providers/
│   │   ├── profile.provider.ts   # ProfileProvider for 'agent-fleet'
│   │   ├── settings.provider.ts  # SettingsTabProvider
│   │   └── hotkey.provider.ts    # stub (v0.2)
│   ├── components/
│   │   └── settings.component.ts/.pug/.scss
│   └── utils/
│       ├── porcelain.ts          # parser (Appendix A.1)
│       ├── template.ts           # renderTemplate (Appendix A.4)
│       ├── pwsh.ts               # encodeForPwsh (Appendix A.3)
│       └── vars.ts               # worktreeToVars (Appendix A.6)
└── tests/
    ├── porcelain.test.ts
    ├── template.test.ts
    ├── pwsh.test.ts
    ├── watcher.test.ts
    └── layout.test.ts
```

## Implementation phases

### Phase 1 — Scaffold (0.5 day)
- Clone Tabby's official plugin template into the worktree
- Strip example code; set `name: "tabby-fleet"`, `keywords: ["tabby-plugin"]`
- Empty `@NgModule`; webpack builds; load into Tabby dev via `~/.config/tabby/plugins/` symlink
- Verify: plugin appears in Tabby's plugin list

### Phase 2 — Pure functions (1 day)
Implement and unit-test in isolation. No Tabby dependencies. Lowest-risk; unblocks the rest.
- `utils/porcelain.ts` (Appendix A.1) — tests for main detection, detached, locked, prunable, CRLF
- `utils/template.ts` (Appendix A.4) — tests for `{{` `}}` escapes, unknown placeholders, special chars in branch names
- `utils/pwsh.ts` (Appendix A.3) — round-trip test (decode base64 + UTF-16LE → original)
- `utils/vars.ts` (Appendix A.6) — tests for main, detached, slash-less branch

### Phase 3 — Watcher (0.5 day)
- `services/watcher.service.ts` (Appendix A.2) — tests for debounce window, fs→poll fallback, double-stop idempotence
- Integration smoke: spawn a temp git repo, `git worktree add`, assert `onChange` fires within 500 ms (covers spec §4 — "added or removed under the configured prefix is reflected … within 1 second when watch mode is filesystem-event-based")

### Phase 4 — Tabby split integration (1 day)
Day-1 verification (highest risk; gate further work):
1. Open a hardcoded SplitTabComponent with 1 root + 2 worktree panes via `splitTab.add(...)`
2. Mutate `root.ratios` and a nested vertical container's `ratios`; assert `layout()` resizes panes
3. Write `extras` on each pane; close Tabby; reopen; assert `extras` survives
4. Subscribe to `focusChanged$`; click panes; assert fires with the right tab

If `extras` does NOT survive restart: fall back to plugin ConfigService keyed by tab UUID. The spec §2 "Restart and persistence" user stories still ship; the implementation just stores fleet metadata elsewhere.

If verification passes, build the integration:
- `services/fleet.service.ts` launch sequence per spec §2 "Fleet launch" stories
- Grid build per the API research table above (root left, vertical right column)

### Phase 5 — Layout service (1 day)
- `services/layout.service.ts` — pure `computeLayoutWeights(panes, focusedId, zoomFactor, containerSize, minFloor) → LayoutWeights[]` (Appendix A.5)
- Baseline: root weight 2 / right container weight 2; within right container, 1/N each → produces 50/50 horizontal with even vertical splits, matching spec §2 acceptance example 1
- Zoom: scale focused pane's effective weight × `zoomFactor`, renormalize, clamp at min-floor in px (convert px floor → ratio floor using `containerSize`), redistribute clamped overflow back to the focused pane — matches spec §2 acceptance for ten-pane fleet ("focused pane grows by whatever room remains")
- Tests: 1 / 2 / 3 / 5 / 10 panes; zoom on root vs zoom on worktree; floor clamping with 10+ panes
- Wire to `focusChanged$` in fleet.service; apply via ratio mutation + `layout()`
- CSS: `transition: width 150ms ease-out, height 150ms ease-out` on pane host elements (duration from the `zoomTransitionMs` setting in spec §3 In; default 150 ms per spec §4)

### Phase 6 — Fleet lifecycle (1 day)
- Launch flow wired end-to-end per spec §2 "Fleet launch" stories and acceptance examples 1, 9, 10, 11
- Watcher event handler: debounce → re-list → diff → add/remove → rebalance (covers spec §2 acceptance 2 + 3 and the "Orchestration via the root pane" user stories)
- `userDismissed` per-tab in-memory set (spec §2 "Pane lifecycle" stories + spec §3 In "per-fleet-tab in-memory tracking" bullet + spec §3 Out "Cross-session persistence of manually dismissed worktree paths")
- Root-pane close confirmation modal (spec §2 acceptance example 8)
- Cleanup on fleet tab close (spec §4 — "Closing the fleet tab releases all filesystem monitoring within 100 milliseconds")
- Notifications via `NotificationsService` when `notifyOnChange` (spec §2 "Notifications and indicators" stories + spec §4 — "at most once per pane add/remove event, within 1 second")

### Phase 7 — Profile & settings UI (1 day)
- `providers/profile.provider.ts` — register `agent-fleet` profile type, defaults per spec §3 In + Appendix C (default values)
- `providers/settings.provider.ts` + `components/settings.component.*` — surface every configurable setting from spec §3 In (24 settings total)
- Per-profile overrides through Tabby's standard profile editor

### Phase 8 — Polish & ship (1 day)
- README: install, quickstart, full settings reference, troubleshooting (esp. the network-share fallback note — spec §2 "filesystem-event watcher fails to attach" failure mode), layout alternatives, platform support per spec §4
- Manual integration tests walking each spec §2 acceptance example on a real repo with mixed worktree states
- GitHub Actions running unit tests on Windows / Ubuntu / macOS
- npm publish as `tabby-fleet`

**Total: 6–7 days focused work.** Phase 4 is the gate — if SplitTabComponent doesn't expose what the verification expects, replan Phases 5–6 around the `static-grid` mode (spec §3 In) before continuing.

## Reuse opportunities

- `SplitTabComponent.add()` / `ratios` / `layout()` — Tabby owns grid management; no reimplementation
- `SplitTabComponent.focusChanged$` — replaces any DOM focus listener fallback
- `SplitTabComponent.maximize(tab)` — built-in 90/90 maximize is the right fallback if smooth animation jank shows up with 10+ panes; offer as a hotkey if needed
- `ProfilesService.openNewTabForProfile` — handles tab creation; the plugin only registers the profile type and post-constructs panes
- `ConfigService` — stores plugin settings + per-profile defaults
- `NotificationsService` — `notifyOnChange` toasts

## Verification

End-to-end test of the shipped plugin (covers spec §2 acceptance + spec §4 quality bars):

1. `npm run build && npm pack`; symlink built output into `~/.config/tabby/plugins/node_modules/tabby-fleet/`
2. Restart Tabby; confirm `agent-fleet` profile type appears in profile editor
3. Create a profile pointing at a test repo with: main, 2 worktrees under `.claude/worktrees/`, 1 worktree outside the prefix, 1 detached, 1 locked
4. Launch profile → tab opens with root + 2 worktree panes in a balanced grid (root left 50%, two stacked right at 25% each); outside-prefix and detached panes absent
5. Click each pane → focused pane grows ~2x; others shrink but stay clickable; transition completes within the configured duration
6. In another shell, `git worktree add .claude/worktrees/test-new -b agent/test-new` → new pane appears within 1 s; layout rebalances; no focus theft
7. `git worktree remove .claude/worktrees/test-new` → pane closes within 1 s; layout rebalances
8. Manually close a worktree pane → worktree on disk untouched; watcher does NOT reopen for the rest of the session
9. Manually close root pane → confirmation modal; "yes" closes the whole tab
10. Open 10 worktrees → min-floor (120×80 px) respected; zoom is reduced but layout doesn't break
11. Quit Tabby; reopen → fleet tab restored with dead panes; one-click relaunch works
12. Run `npm test` on Windows / Ubuntu / macOS in CI; all unit tests green

If any of steps 1–11 fail, the plugin is not v0.1-ready.

---

## Appendix A — Reference implementations

Preserved from v0.3 of the spec (since rewritten as behavior-only). These are starting points; adjust during implementation as needed.

### A.1 Porcelain parser

Output of `git -C <repoPath> worktree list --porcelain` — blank-line-separated records, each with `worktree <path>`, `HEAD <sha>`, optional `branch refs/heads/<name>` or `detached`, optional `locked [<reason>]`, optional `prunable [<reason>]`.

```typescript
export interface Worktree {
  path: string
  head: string
  branch: string | null
  locked: boolean
  lockedReason: string | null
  prunable: boolean
  prunableReason: string | null
  isMain: boolean
}

export function parseWorktreeListPorcelain(stdout: string): Worktree[] {
  const blocks = stdout.split(/\r?\n\r?\n+/).filter(b => b.trim())
  const worktrees = blocks
    .map(parseBlock)
    .filter((wt): wt is Worktree => wt !== null)
  if (worktrees.length > 0) worktrees[0].isMain = true
  return worktrees
}

function parseBlock(block: string): Worktree | null {
  const lines = block.split(/\r?\n/).filter(l => l.length > 0)
  const wt: Partial<Worktree> = {
    locked: false, lockedReason: null,
    prunable: false, prunableReason: null,
    isMain: false,
  }

  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      wt.path = line.slice('worktree '.length).trim()
    } else if (line.startsWith('HEAD ')) {
      wt.head = line.slice('HEAD '.length).trim()
    } else if (line === 'detached') {
      wt.branch = null
    } else if (line.startsWith('branch ')) {
      const ref = line.slice('branch '.length).trim()
      wt.branch = ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref
    } else if (line === 'locked') {
      wt.locked = true
    } else if (line.startsWith('locked ')) {
      wt.locked = true
      wt.lockedReason = line.slice('locked '.length).trim()
    } else if (line === 'prunable') {
      wt.prunable = true
    } else if (line.startsWith('prunable ')) {
      wt.prunable = true
      wt.prunableReason = line.slice('prunable '.length).trim()
    }
  }

  if (!wt.path || !wt.head) return null
  if (wt.branch === undefined) wt.branch = null
  return wt as Worktree
}
```

Filtering rules (spec §3 In): first record returned by git is the main worktree (→ root pane, never filtered). For the rest, apply in order: path prefix match (case-insensitive on Windows) → detached inclusion → prunable inclusion → locked inclusion. Sort survivors by `path` ascending.

### A.2 Watcher service

Watches `<repoPath>/.git/worktrees/` for filesystem events. Falls back to polling when `fs.watch` errors (most often on network shares — see spec §2 failure mode).

```typescript
import * as fs from 'fs'
import * as path from 'path'

export class WorktreeWatcher {
  private watcher: fs.FSWatcher | null = null
  private pollHandle: NodeJS.Timeout | null = null
  private debounceHandle: NodeJS.Timeout | null = null

  constructor(
    private repoPath: string,
    private onChange: () => void,
    private debounceMs: number = 250,
  ) {}

  start(mode: 'fs' | 'poll', pollIntervalMs: number = 5000): void {
    if (mode === 'fs') {
      try {
        const worktreesDir = path.join(this.repoPath, '.git', 'worktrees')
        if (fs.existsSync(worktreesDir)) {
          this.watcher = fs.watch(worktreesDir, { persistent: false }, () => {
            this.debouncedFire()
          })
        } else {
          const gitDir = path.join(this.repoPath, '.git')
          this.watcher = fs.watch(gitDir, { persistent: false }, (eventType, filename) => {
            if (filename === 'worktrees') this.debouncedFire()
          })
        }
        return
      } catch (err) {
        console.warn('FS watch failed, falling back to polling:', err)
      }
    }
    this.startPolling(pollIntervalMs)
  }

  private startPolling(intervalMs: number): void {
    this.pollHandle = setInterval(() => this.debouncedFire(), intervalMs)
  }

  private debouncedFire(): void {
    if (this.debounceHandle) clearTimeout(this.debounceHandle)
    this.debounceHandle = setTimeout(() => this.onChange(), this.debounceMs)
  }

  stop(): void {
    if (this.watcher) { this.watcher.close(); this.watcher = null }
    if (this.pollHandle) { clearInterval(this.pollHandle); this.pollHandle = null }
    if (this.debounceHandle) { clearTimeout(this.debounceHandle); this.debounceHandle = null }
  }
}
```

On each `onChange` fire, fleet.service re-runs `git worktree list --porcelain`, parses, filters, and diffs against the panes currently in the tab — adding/removing as needed and rebalancing.

### A.3 PowerShell wrapper

Two encoding strategies, exposed as a per-profile `encoding` setting (spec §3 In — "Shell program and argument list used to host each pane's command"):

- **`encoded` (default, recommended)** — encode rendered command as UTF-16LE base64, pass to `pwsh -NoExit -EncodedCommand <base64>`. Zero quoting issues. Command not human-readable in process list.
- **`command`** — pass rendered command as `pwsh -NoExit -Command "& { <rendered command> }"`. Requires escaping literal `"` in rendered command before substitution. Human-readable in process list.

```typescript
export function encodeForPwsh(command: string): string {
  return Buffer.from(command, 'utf16le').toString('base64')
}
```

Round-trip test: `Buffer.from(encodeForPwsh(cmd), 'base64').toString('utf16le') === cmd`.

### A.4 Template renderer

Supports `{var}` substitution, `{{` `}}` as literal `{` `}`, and unknown placeholders left as-is (so users see their typo rather than getting silent empty substitution).

```typescript
export function renderTemplate(template: string, vars: Record<string, string>): string {
  const ESCAPE_OPEN = '\x00OPEN\x00'
  const ESCAPE_CLOSE = '\x00CLOSE\x00'
  let result = template.replace(/\{\{/g, ESCAPE_OPEN).replace(/\}\}/g, ESCAPE_CLOSE)
  result = result.replace(/\{(\w+)\}/g, (match, key) => key in vars ? vars[key] : match)
  return result.replace(new RegExp(ESCAPE_OPEN, 'g'), '{').replace(new RegExp(ESCAPE_CLOSE, 'g'), '}')
}
```

Available variables (spec §3 In — "Template variables"): `path`, `path_native`, `branch`, `branch_short`, `name`, `head`, `head_short`, `repo`, `repo_path`. For detached worktrees, `branch` and `branch_short` substitute to `(detached@{head_short})`.

### A.5 Layout service signature

```typescript
export interface PaneInfo {
  id: string
  role: 'root' | 'worktree'
  baselineWeight: number
}

export interface LayoutWeights {
  paneId: string
  weight: number     // relative weight for flex layout
  clamped: boolean   // true if this pane hit the min-size floor
}

export function computeLayoutWeights(
  panes: PaneInfo[],
  focusedId: string | null,
  zoomFactor: number,
  containerSize: { width: number; height: number },
  minFloor: { width: number; height: number },
): LayoutWeights[] {
  // Group panes by their layout container (root is solo on left; worktrees share right).
  // Compute effective weights with zoom applied.
  // Apply min-size floor and redistribute clamped overflow back to focused.
  // Pure, no side effects.
}
```

**Shrink math.** Given focused pane baseline weight `w_focused` and zoom factor `Z`, with other panes at baseline weights `w_1 … w_n`: focused pane's effective weight is `w_focused × Z`. A pragmatic heuristic that works in practice: shrink unfocused weights by 0.5 as a starting point; apply min-floor; redistribute clamped overflow back to focused. With many panes, focused will be slightly under `Z×` baseline because the floors consume the space — this is correct and matches spec §2 acceptance for the ten-pane case.

Output map drives mutation of `SplitContainer.ratios[]` followed by `layout()`. Tabby writes `%` widths/heights; CSS transition handles the animation.

### A.6 worktreeToVars helper

Maps a parsed `Worktree` + repo metadata to the variable map consumed by `renderTemplate`.

```typescript
export function worktreeToVars(
  wt: Worktree,
  repo: { name: string; path: string; mainBranch: string; mainHead: string },
): Record<string, string> {
  if (wt.isMain) {
    return {
      path: repo.path,
      path_native: repo.path.replace(/\//g, path.sep),
      branch: repo.mainBranch,
      branch_short: repo.mainBranch,
      name: repo.name,
      head: repo.mainHead,
      head_short: repo.mainHead.slice(0, 7),
      repo: repo.name,
      repo_path: repo.path,
    }
  }

  const branchShort = wt.branch
    ? wt.branch.includes('/') ? wt.branch.slice(wt.branch.indexOf('/') + 1) : wt.branch
    : `(detached@${wt.head.slice(0, 7)})`

  return {
    path: wt.path,
    path_native: wt.path.replace(/\//g, path.sep),
    branch: wt.branch ?? `(detached@${wt.head.slice(0, 7)})`,
    branch_short: branchShort,
    name: wt.path.split('/').pop() ?? wt.path,
    head: wt.head,
    head_short: wt.head.slice(0, 7),
    repo: repo.name,
    repo_path: repo.path,
  }
}
```

## Appendix B — Pane metadata schema

Every pane in a fleet tab carries:

```typescript
interface FleetPaneMetadata {
  fleetTabId: string             // UUID shared across all panes in this fleet tab
  fleetProfileId: string         // the agent-fleet profile that created this tab
  role: 'root' | 'worktree'
  worktreePath: string           // absolute, forward slashes
  branch: string | null          // null for detached worktrees
  fleetVersion: number           // schema version, currently 1
  spawnedAt: string              // ISO-8601 timestamp
  baselineWeight: number         // for layout math
}
```

The fleet tab itself carries `fleetTabId` and `fleetProfileId`. Stored on Tabby's pane/tab `extras` field. Restart persistence is verified day 1 of Phase 4 — if `extras` doesn't survive restart, store the mapping in plugin ConfigService keyed by tab UUID instead.

## Appendix C — Default option values

Defaults the profile provider registers (spec §3 In — every configurable setting):

| Setting | Default |
|---|---|
| Repo path | `""` (use current working directory at launch) |
| Worktree path prefix | `.claude/worktrees/` |
| Include detached | `false` |
| Include prunable | `false` |
| Include locked | `true` |
| Root command template | `claude` |
| Root title template | `{repo} (orchestrator)` |
| Worktree command template | `claude --resume {branch}` |
| Worktree title template | `{branch_short}` |
| Root pane color | (unset) |
| Worktree pane color | (unset) |
| Layout mode | `grid` (auto-zoom) |
| Zoom factor | `2.0` |
| Min pane width | `120` px |
| Min pane height | `80` px |
| Zoom transition duration | `150` ms |
| Watch mode | `fs` (falls back to `poll` on error) |
| Poll interval | `5000` ms |
| Auto-open new | `true` |
| Auto-close removed | `true` |
| Steal focus on add | `false` |
| Notify on change | `true` |
| Spawn mode | `eager` |
| Pre-launch command | `""` |
| Shell program | `pwsh.exe` |
| Shell args | `["-NoExit", "-EncodedCommand"]` |
| Encoding mode | `encoded` |
