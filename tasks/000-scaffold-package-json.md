Parent slice: [plugin-scaffold](../slices/plugin-scaffold.md)
Depends on: none

# Task 000 — Clone Tabby plugin template and set package.json metadata

_Tick `[x]` on each Tasks item as you finish it, and on each Acceptance item as it passes. The unticked state is what tells the next planning run that this task is still safe to edit in place._

## Goal
Copy the Tabby plugin template's files into the repo root and rewrite `package.json` to identify the package as `tabby-fleet`.

## Tasks
- [ ] Copy the contents of `https://github.com/Eugeny/tabby-plugin-template` (use HEAD of `master`) into `C:\Users\prudd\source\repos\tabby-ai-worktree\` preserving the existing `.git`, `spec.md`, `plan.md`, and `slices/` directory.
- [ ] Edit `package.json` at the repo root: set `name` to `"tabby-fleet"`, `version` to `"0.1.0"`, `description` to `"Tabby Terminal plugin: one tab per git repo, one pane per worktree, one agent per pane."`, `keywords` to `["tabby-plugin"]`, `main` to `"dist/index.js"`, `license` to `"MIT"`.
- [ ] Remove any example components or services the template ships (e.g., `src/component.ts`, sample providers); keep only `src/index.ts` placeholder.

## Acceptance criteria
- [ ] `test -f package.json && test -f webpack.config.js && test -f tsconfig.json` exits 0.
- [ ] `node -e "const p=require('./package.json'); process.exit(p.name==='tabby-fleet' && p.keywords.includes('tabby-plugin') ? 0 : 1)"` exits 0.
- [ ] `npm install` exits 0 (no version-resolution errors).
- [ ] `git status --porcelain | grep -E '^(\?\? |M )package\.json'` is empty after staging (i.e., package.json is committable).

> If a `## Tasks` checkbox can't be completed without changing what the parent slice specifies, stop and update the slice. Do not redesign here.
