Parent slice: [plugin-scaffold](../slices/plugin-scaffold.md)
Depends on: 000

# Task 001 — Configure webpack and tsconfig for Tabby plugin output

_Tick `[x]` on each Tasks item as you finish it, and on each Acceptance item as it passes. The unticked state is what tells the next planning run that this task is still safe to edit in place._

## Goal
Configure `webpack.config.js` and `tsconfig.json` to produce a `dist/index.js` CommonJS bundle that Tabby's plugin loader can `require()`, with `@angular/*`, `tabby-*`, and `rxjs` marked external.

## Tasks
- [x] Edit `webpack.config.js`: set `entry` to `./src/index.ts`, `output.path` to `dist/`, `output.filename` to `index.js`, `output.library.type` to `commonjs2`, `target: 'node'`, `externals` matching `/^@angular\//`, `/^tabby-/`, `'rxjs'`, `'@ng-bootstrap/ng-bootstrap'`. Add `ts-loader` for `.ts`, `raw-loader` (or `pug-loader`) for `.pug`, `sass-loader` + `css-loader` + `style-loader` for `.scss`.
- [x] Edit `tsconfig.json`: set `compilerOptions.target` to `"es2020"`, `module` to `"commonjs"`, `experimentalDecorators: true`, `emitDecoratorMetadata: true`, `strict: true`, `lib: ["es2020", "dom"]`, `outDir: "./dist"`.
- [x] Add an `npm` script `build` running `webpack` and `watch` running `webpack --watch`.

## Acceptance criteria
- [x] `npm run build` exits 0 (succeeds with an empty/placeholder `src/index.ts`).
- [x] `test -f dist/index.js` exits 0.
- [x] `node -e "const m=require('./dist/index.js'); process.exit(0)"` exits 0 (bundle loads without error).
- [x] `grep -E '^[^/]*externals' webpack.config.js` matches at least one line declaring externals.
- [x] `npx tsc --noEmit` exits 0.

> If a `## Tasks` checkbox can't be completed without changing what the parent slice specifies, stop and update the slice. Do not redesign here.
