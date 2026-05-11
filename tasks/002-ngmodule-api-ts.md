Parent slice: [plugin-scaffold](../slices/plugin-scaffold.md)
Depends on: 001

# Task 002 — Empty AgentFleetModule, empty api.ts, smoke test

_Tick `[x]` on each Tasks item as you finish it, and on each Acceptance item as it passes. The unticked state is what tells the next planning run that this task is still safe to edit in place._

## Goal
Create the default-exported `AgentFleetModule`, an empty `api.ts` for shared types, and one trivial unit test so subsequent tasks land on a working test infrastructure.

## Tasks
- [ ] Create `src/index.ts` exporting a default `@NgModule` class `AgentFleetModule` with empty `declarations`, `imports: [TabbyCoreModule, TabbyTerminalModule]`, empty `providers`. Import `TabbyCoreModule` from `tabby-core` and `TabbyTerminalModule` from `tabby-terminal`.
- [ ] Create `src/api.ts` as an empty file containing only an `export {}` statement (placeholder; later tasks add type declarations).
- [ ] Create `tests/smoke.test.ts` containing a single test that imports `AgentFleetModule` from `../src/index` and asserts it is a function (Angular module class).
- [ ] Add `mocha` + `ts-node` + `@types/node` to `devDependencies` (or jest equivalents, matching whatever `tabby-plugin-template` ships). Add `npm` script `test` running the test framework against `tests/**/*.test.ts`.

## Acceptance criteria
- [ ] `npm test` exits 0 and `tests/smoke.test.ts` is reported as run (1 passing).
- [ ] `npm run build` exits 0.
- [ ] `node -e "const m=require('./dist/index.js'); process.exit(m.default ? 0 : 1)"` exits 0 (default export present).
- [ ] `test -f src/api.ts` exits 0.
- [ ] `grep -nE '@NgModule' src/index.ts` matches at least one line.

> If a `## Tasks` checkbox can't be completed without changing what the parent slice specifies, stop and update the slice. Do not redesign here.
