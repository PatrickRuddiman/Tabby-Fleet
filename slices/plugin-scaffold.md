Parent spec: [tabby-fleet specification](../spec.md)

# tabby-fleet — plugin-scaffold

## §1 Summary

Bootstraps the empty repo into a loadable Tabby plugin: `package.json` with the `tabby-plugin` keyword and correct peer dependencies, webpack config that bundles for Tabby's plugin loader, `tsconfig.json` with Angular decorator support, and a default-exported `@NgModule` that aggregates every provider and entry component declared by sibling slices. After this slice, `npm run build` produces a loadable plugin and Tabby boots with the `agent-fleet` profile type registered (even before any feature logic is wired).

## §2 Codebase reconnaissance

Local repo: greenfield. Only `spec.md`, `plan.md`, `slices/` exist. No `package.json`, no `tsconfig.json`, no `src/`.

Tabby plugin convention (cited in [`plan.md`](../plan.md) §17 Phase 1 and `tabby-host` recon):
- `tabby-plugin-template` is Tabby's official starter at https://github.com/Eugeny/tabby-plugin-template — webpack + TS + NgModule. This slice clones its layout.
- Tabby's plugin loader scans `node_modules/` directories under user-configured paths (Windows: `%APPDATA%\tabby\plugins\node_modules\`) for npm packages whose `package.json` lists `tabby-plugin` in `keywords`.
- Plugins ship as a single bundled `dist/index.js` referenced from `package.json`'s `main` field. Webpack `externals` keep `@angular/*`, `tabby-*`, and `rxjs` external (they're provided by the host).
- The default export of the entry module is the plugin's `@NgModule` class.

Sibling-slice contracts the scaffold wires up:
- [`tabby-host`](tabby-host.md) §4 declares `AgentFleetProfileProvider`, `AgentFleetRecoveryProvider`, and `FleetRegistry`.
- [`fleet-lifecycle`](fleet-lifecycle.md) §4 declares `ConfirmFleetCloseModalComponent` and `FleetDeadPaneOverlayComponent` (instantiated at runtime via ComponentFactoryResolver — both must be registered as entry components).
- [`profile-and-settings`](profile-and-settings.md) §4 declares `AgentFleetProfileSettingsComponent`, `AgentFleetDefaultsTabComponent`, and `AgentFleetDefaultsTabProvider`.
- [`layout-engine`](layout-engine.md) §4 ships `src/styles/fleet-transition.scss` — must be imported by the NgModule so Angular ingests it.
- All pure-function modules ([`worktree-data`](worktree-data.md), [`shell-launcher`](shell-launcher.md), [`fs-watcher`](fs-watcher.md)) don't need NgModule registration; they're imported by the providers/services that use them.

## §3 Decisions

1. **Plugin template source.** Options considered: clone `tabby-plugin-template` and adapt, hand-write from scratch matching its layout, fork a more featureful plugin (e.g. tabby-ssh) and strip. **Chosen:** clone `tabby-plugin-template`. Rationale: official, minimal, kept in sync by Tabby maintainers; matches plan.md Phase 1 verbatim.

2. **Angular and TypeScript versions.** Options considered: pin to current Tabby's exact versions, use a compatible range, latest stable. **Chosen:** match `tabby-plugin-template`'s pinned versions (devDependencies; peer-deps on Tabby itself). Rationale: Tabby loads plugins into its own Angular runtime; mismatched compiler/runtime versions break at load time.

3. **NgModule structure.** Options considered: one `AgentFleetModule` aggregating everything, sub-modules per concern (FleetCoreModule, FleetUIModule, etc.), feature-flagged module. **Chosen:** one `AgentFleetModule` default-exported from `src/index.ts`. Rationale: matches `tabby-ssh`'s single-module convention; no second NgModule consumer to justify the split; spec ships one plugin.

4. **Entry components for runtime instantiation.** Options considered: `entryComponents` array (Angular ≤14), `ComponentFactoryResolver` registration via `@Component` only (Angular 15+ Ivy), explicit declaration. **Chosen:** declare in `declarations`; rely on Ivy's automatic factory generation. Rationale: per `tabby-plugin-template`'s current state (post-Ivy migration); `entryComponents` is deprecated. Slice §7 flags the version dependency.

5. **CSS shipping.** Options considered: inline in component `.scss`, separate stylesheet imported by NgModule, global stylesheet in `package.json` styles field. **Chosen:** component-scoped `.scss` files for component-local styles + one shared `src/styles/fleet-transition.scss` imported via the layout-engine's CSS contract (§4 of that slice). Imported into the NgModule via the component that owns the `.fleet-tab` class assignment. Rationale: keeps component styles encapsulated; the one global override (transition duration) is the minimal exception.

6. **Dev workflow.** Options considered: `npm link` from the dev plugin into Tabby's plugin directory, symlink the built `dist/` into Tabby's plugin directory, `npm install` from local path. **Chosen:** symlink `dist/` into `%APPDATA%\tabby\plugins\node_modules\tabby-fleet\` after each build. Rationale: matches plan.md Phase 1 ("load into Tabby dev via `~/.config/tabby/plugins/` symlink"); `npm link` chains node_modules in a way Tabby's loader doesn't follow.

7. **`package.json` shape.** Options considered: minimal (name + keyword + main), full template-style with peer-deps explicit, monorepo-style. **Chosen:** full template-style. Rationale: peer-deps make load failures debuggable (Tabby logs version mismatches); `tabby-plugin-template`'s shape is the documented contract.

## §4 Contracts & shapes

**File:** `package.json`.
- `name: "tabby-fleet"`.
- `version: "0.1.0"`.
- `main: "dist/index.js"`.
- `keywords: ["tabby-plugin"]` (the loader's discovery mechanism).
- `description: "Tabby Terminal plugin: one tab per git repo, one pane per worktree, one agent per pane."`.
- `license`: per the developer's choice (recommend MIT or Apache-2.0; not a spec concern).
- `scripts`: `build` → webpack; `watch` → webpack `--watch`; `test` → mocha or jest (chosen by tests-slice if added; for now, placeholder).
- `peerDependencies`: `@angular/core`, `@angular/common`, `@angular/forms`, `tabby-core`, `tabby-terminal`, `tabby-settings`, `@ng-bootstrap/ng-bootstrap`, `rxjs` — versions pinned to match Tabby's current release at scaffold time.
- `devDependencies`: TypeScript, webpack, webpack-cli, ts-loader, sass, sass-loader, and matching `@angular/*` packages for compile.

**File:** `webpack.config.js`.
- Entry: `./src/index.ts`.
- Output: `dist/index.js`, `library: { type: 'commonjs2' }` (Tabby loads via Node's `require`).
- Module rules: `ts-loader` for `.ts`, `raw-loader` or `pug-loader` for `.pug`, `sass-loader` + `css-loader` + `style-loader` for `.scss`.
- `externals`: every peer-dep in `package.json`, plus `@angular/*` and `tabby-*` resolved by RegExp.
- `resolve.extensions`: `.ts`, `.js`.
- `target: 'node'`. Tabby runs in Electron renderer with Node integration; bundle must allow Node `require`s for things like `fs` and `child_process` (used by `worktree-data`, `fs-watcher`, `fleet-lifecycle`).

**File:** `tsconfig.json`.
- `target: "es2020"`.
- `module: "commonjs"`.
- `experimentalDecorators: true`, `emitDecoratorMetadata: true` (Angular DI).
- `strict: true`.
- `lib: ["es2020", "dom"]`.
- `outDir: "./dist"` (overridden by webpack but kept for IDE).
- `paths`: `tabby-core`, `tabby-terminal`, `tabby-settings` mapped to the host install for type checking.

**File:** `src/index.ts`.
- Default-exports `AgentFleetModule`.
- `@NgModule` declarations:
  - `AgentFleetProfileSettingsComponent` (profile-and-settings).
  - `AgentFleetDefaultsTabComponent` (profile-and-settings).
  - `ConfirmFleetCloseModalComponent` (fleet-lifecycle).
  - `FleetDeadPaneOverlayComponent` (fleet-lifecycle).
- `@NgModule` imports:
  - `TabbyCoreModule`, `TabbyTerminalModule`, `TabbySettingsModule`.
  - `NgbAccordionModule`, `NgbModalModule` (ng-bootstrap dependencies).
  - `FormsModule` (two-way binding in settings component).
- `@NgModule` providers:
  - `{ provide: ProfileProvider, useClass: AgentFleetProfileProvider, multi: true }` (tabby-host).
  - `{ provide: TabRecoveryProvider, useClass: AgentFleetRecoveryProvider, multi: true }` (tabby-host).
  - `{ provide: SettingsTabProvider, useClass: AgentFleetDefaultsTabProvider, multi: true }` (profile-and-settings).
  - `FleetRegistry` (root-injectable; tabby-host).
- `entryComponents` (if Angular pre-Ivy): same as declarations array.

**File:** `README.md` (minimal scaffold version; full content owned by `packaging-ci-docs` slice).
- One paragraph: what the plugin does.
- One install command line: `npm install tabby-fleet` (post-publish) or symlink instructions for local dev.
- Link to `spec.md` and `plan.md`.

**Verification of scaffold (per plan.md Phase 1):**
- `npm install` succeeds without errors.
- `npm run build` produces `dist/index.js`.
- After symlinking the package into Tabby's plugin directory and restarting Tabby, the plugin appears in Settings → Plugins → installed list.
- Without any feature wiring, Tabby's profile editor shows `Agent Fleet` as a selectable profile type (because `AgentFleetProfileProvider.name = 'Agent Fleet'` is registered).
- Launching such a profile does nothing useful (downstream slices not yet implemented) — Tabby opens an empty SplitTabComponent. This is the success state for Phase 1.

**Failure modes specific to this slice:**
- Peer-dep version mismatch with Tabby: Tabby logs a load error in DevTools console; user must update `package.json` peer-dep range.
- Webpack `target` not set to `node`: `child_process` / `fs` imports in `fs-watcher` and `fleet-lifecycle` fail at runtime ("Module not found"). Phase 1 verification catches this.
- Missing `entryComponents` on Angular pre-Ivy versions: `ComponentFactoryResolver.resolveComponentFactory` throws "No component factory found" at runtime when fleet-lifecycle tries to attach the dead-pane overlay or open the confirm modal. Phase 4 verification (the first time the overlay or modal is needed) catches this.

## §5 Sequence

**Initial scaffold (plan.md Phase 1):**
1. Clone `tabby-plugin-template` contents into the worktree root, preserving `.git` (keep tabby-fleet's own commit history).
2. Replace template metadata in `package.json`: `name`, `description`, `keywords`, `main`.
3. Strip example components/services from `src/`; leave only `src/index.ts` with an empty `@NgModule` (no providers yet).
4. Run `npm install` to populate `node_modules`.
5. Run `npm run build` to produce `dist/index.js`.
6. Create symlink: `mklink /D %APPDATA%\tabby\plugins\node_modules\tabby-fleet C:\Users\prudd\source\repos\tabby-ai-worktree` (Windows) — the symlink points at the worktree root, not `dist/`, because Tabby reads `package.json` from the package root.
7. Restart Tabby; verify the plugin appears in the plugin list.

**Provider/component wiring (after sibling slices land):**
1. Each downstream slice creates its providers and components in their respective files.
2. As each lands, the developer updates `src/index.ts` to add the new entries to `declarations`, `providers`, and `imports` per §4 above.
3. Rebuild + Tabby restart after each addition; verify no DI or registration errors.

**Watch-mode dev loop:**
1. `npm run watch` keeps webpack rebuilding on file change.
2. Tabby's plugin loader does not hot-reload — each rebuild requires a Tabby restart to see changes.
3. Slice §7 flags this as an open question for dev velocity.

## §6 Out of scope

- Implementation of any provider, component, or service — owned by the slices that declared them.
- npm publishing workflow — owned by [`packaging-ci-docs`](packaging-ci-docs.md).
- GitHub Actions CI configuration — owned by [`packaging-ci-docs`](packaging-ci-docs.md).
- Unit tests — owned by per-slice test files (`tests/porcelain.test.ts`, etc.).
- The full README — `packaging-ci-docs` slice owns the user-facing README (install, quickstart, settings reference, troubleshooting).
- Hotkey provider — `src/providers/hotkey.provider.ts` deferred to v0.2 per spec §3 Out; the scaffold does not register it.

## §7 Open questions

- Tabby's exact peer-dep versions to pin (Angular major version, ng-bootstrap version, RxJS version). Resolve at scaffold time by reading the current `tabby-plugin-template`'s `package.json` from upstream.
- Whether Tabby's current plugin loader supports hot-reload via Webpack HMR or requires full restart. Restart is documented in plan.md; HMR would speed up dev iteration. Resolve during implementation by checking Tabby's plugin loader docs.
- Whether Angular pre-Ivy compatibility is needed (affects `entryComponents` declaration). Pin to current Tabby Angular version; remove `entryComponents` line if Tabby is already on Ivy.

> If the parent spec is ambiguous on anything this slice depends on, stop and update the spec. Do not invent behavior here.
