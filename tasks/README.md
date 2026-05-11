Parent slice(s): [plugin-scaffold](../slices/plugin-scaffold.md), [worktree-data](../slices/worktree-data.md), [shell-launcher](../slices/shell-launcher.md), [fs-watcher](../slices/fs-watcher.md), [layout-engine](../slices/layout-engine.md), [profile-and-settings](../slices/profile-and-settings.md), [tabby-host](../slices/tabby-host.md), [fleet-lifecycle](../slices/fleet-lifecycle.md), [packaging-ci-docs](../slices/packaging-ci-docs.md)

# tabby-fleet — Tasks

| # | Task | Path | Depends on | Slice |
|---|---|---|---|---|
| 000 | Clone Tabby plugin template, set package.json metadata | [000-scaffold-package-json.md](000-scaffold-package-json.md) | — | plugin-scaffold |
| 001 | Configure webpack + tsconfig | [001-webpack-tsconfig.md](001-webpack-tsconfig.md) | 000 | plugin-scaffold |
| 002 | Empty AgentFleetModule + empty api.ts + smoke test | [002-ngmodule-api-ts.md](002-ngmodule-api-ts.md) | 001 | plugin-scaffold |
| 003 | utils/porcelain.ts parser + filter + tests | [003-porcelain-parser.md](003-porcelain-parser.md) | 002 | worktree-data |
| 004 | utils/vars.ts worktreeToVars + tests | [004-worktree-vars.md](004-worktree-vars.md) | 003 | worktree-data |
| 005 | services/worktree.service.ts async wrapper + tests | [005-worktree-service.md](005-worktree-service.md) | 003, 004 | worktree-data |
| 006 | utils/template.ts renderTemplate + tests | [006-template-renderer.md](006-template-renderer.md) | 002 | shell-launcher |
| 007 | utils/pwsh.ts encoder + escaper + tests | [007-pwsh-encoder.md](007-pwsh-encoder.md) | 002 | shell-launcher |
| 008 | services/command.service.ts buildSpawnDescriptor + tests | [008-command-service.md](008-command-service.md) | 006, 007 | shell-launcher |
| 009 | services/watcher.service.ts WorktreeWatcher + tests | [009-fs-watcher.md](009-fs-watcher.md) | 002 | fs-watcher |
| 010 | services/layout.service.ts computeLayoutWeights + tests | [010-layout-service.md](010-layout-service.md) | 002 | layout-engine |
| 011 | styles/fleet-transition.scss CSS contract | [011-fleet-transition-scss.md](011-fleet-transition-scss.md) | 010 | layout-engine |
| 012 | AgentFleetProfileOptions interface + DEFAULT_PROFILE_OPTIONS in api.ts | [012-profile-options-type.md](012-profile-options-type.md) | 002 | profile-and-settings |
| 013 | FleetPaneMetadata + RecoveryToken types in api.ts | [013-fleet-metadata-types.md](013-fleet-metadata-types.md) | 012 | tabby-host |
| 014 | providers/profile.provider.ts AgentFleetProfileProvider | [014-profile-provider.md](014-profile-provider.md) | 012, 013 | tabby-host |
| 015 | providers/recovery.provider.ts AgentFleetRecoveryProvider | [015-recovery-provider.md](015-recovery-provider.md) | 013 | tabby-host |
| 016 | services/fleet.registry.ts FleetRegistry + FleetController skeleton | [016-fleet-registry.md](016-fleet-registry.md) | 005, 008, 010, 013 | tabby-host |
| 017 | components/settings.component per-profile editor | [017-settings-component.md](017-settings-component.md) | 012, 014 | profile-and-settings |
| 018 | providers/settings.provider.ts + defaults-tab.component | [018-defaults-tab.md](018-defaults-tab.md) | 017 | profile-and-settings |
| 019 | components/confirm-fleet-close-modal.component | [019-confirm-modal.md](019-confirm-modal.md) | 002 | fleet-lifecycle |
| 020 | components/fleet-dead-pane-overlay.component | [020-dead-pane-overlay.md](020-dead-pane-overlay.md) | 002 | fleet-lifecycle |
| 021 | FleetController extensions: launch + watcher + dismiss + modal + relaunch | [021-controller-extensions.md](021-controller-extensions.md) | 005, 008, 009, 010, 016, 019, 020 | fleet-lifecycle |
| 022 | Final NgModule wire-up in src/index.ts | [022-ngmodule-final-wireup.md](022-ngmodule-final-wireup.md) | 014, 015, 016, 017, 018, 019, 020, 021 | plugin-scaffold |
| 023 | README.md + CHANGELOG.md | [023-readme-changelog.md](023-readme-changelog.md) | 022 | packaging-ci-docs |
| 024 | .github/workflows/ci.yml (Win/Ubuntu/macOS) | [024-ci-workflow.md](024-ci-workflow.md) | 003, 004, 005, 006, 007, 008, 009, 010 | packaging-ci-docs |
| 025 | .github/workflows/publish.yml | [025-publish-workflow.md](025-publish-workflow.md) | 023, 024 | packaging-ci-docs |

## Dependency graph

```
000 ──> 001 ──> 002 ─┬──> 003 ──> 004 ──> 005 ─────────────────┐
                    │                                          │
                    ├──> 006 ─┐                                │
                    │         ├──> 008 ───────────────────────┤
                    ├──> 007 ─┘                                │
                    │                                          │
                    ├──> 009 ─────────────────────────────────┤
                    │                                          │
                    ├──> 010 ──> 011                           │
                    │            │                             │
                    └──> 012 ──> 013 ──┬──> 014 ──┬──> 017 ──> 018 ──┐
                                       │          │                  │
                                       ├──> 015   │                  │
                                       │          │                  │
                                       └──> 016 ◀─┘                  │
                                            │                        │
                                            └──────────┐             │
                                                       │             │
                                       019 ──┐         │             │
                                       020 ──┤         │             │
                                             ▼         ▼             │
                                            021 ◀─ (also 005,008,009,010)
                                             │                       │
                                             ▼                       │
                                            022 ◀─ (also 014,015,016,017,018,019,020)
                                             │                       │
                                             ▼                       │
                                            023 ──┐                  │
                                                  ├──> 024 ──> 025   │
                                            (024 also depends on 003-010 unit tests)
```

### Cross-cutting parallelism

After **002** lands, the following pairs/groups can be tasked in parallel (no inter-dependencies):
- **003** + **006** + **007** + **009** + **010** + **012** (all depend only on 002).
- **004** depends on 003; **005** on 003+004; **008** on 006+007; **011** on 010 — these run in parallel within their subtrees.
- **013** depends on 012 and unblocks the tabby-host integration path.
- **019** + **020** are independent UI components; can land any time after 002.

### Critical path

The longest dependency chain (one task per node, sequential):
**000 → 001 → 002 → 012 → 013 → 016 → 021 → 022 → 023 → 025**, i.e. 10 tasks. Everything else parallelizes around this spine.

### Suggested PR batches

If you want to land in chunks rather than per-task:
1. **Scaffold (000–002)** — project skeleton + smoke test.
2. **Pure utils (003–010)** — porcelain, vars, template, pwsh, command, watcher, layout. All testable in isolation.
3. **CSS (011)** — single-file addition; merge with batch 2 if you prefer.
4. **Types + Tabby integration (012–016)** — profile provider, recovery provider, FleetRegistry skeleton.
5. **Settings UI (017–018)** — settings component + global defaults tab.
6. **Lifecycle UI (019–020)** — modal + overlay components.
7. **Controller wiring (021)** — the big integration task; everything assembles here.
8. **Module + docs + CI (022–025)** — final wire-up, README, CHANGELOG, workflows.
