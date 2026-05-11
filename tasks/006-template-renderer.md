Parent slice: [shell-launcher](../slices/shell-launcher.md)
Depends on: 002

# Task 006 — Template renderer with `{var}` substitution and `{{` `}}` escapes

_Tick `[x]` on each Tasks item as you finish it, and on each Acceptance item as it passes. The unticked state is what tells the next planning run that this task is still safe to edit in place._

## Goal
Pure-function `renderTemplate(template, vars)` that substitutes `{var}` placeholders, treats `{{` and `}}` as literal `{` and `}`, and leaves unknown placeholders untouched so the user sees their typo.

## Tasks
- [ ] Create `src/utils/template.ts` exporting `renderTemplate(template: string, vars: Record<string, string>): string` per [`plan.md`](../plan.md) Appendix A.4 verbatim (sentinel-based escape, then `\{(\w+)\}` substitution, then sentinel restore).
- [ ] Create `tests/template.test.ts` with cases: (a) simple `{name}` substitution, (b) literal `{{` produces `{`, (c) literal `}}` produces `}`, (d) unknown `{xyz}` passes through unchanged, (e) value containing `{` is inserted literally without re-substitution, (f) value containing spaces / quotes / backslashes / non-ASCII (`agent/feature with spaces`, `agent/quote"name`) passes through verbatim.

## Acceptance criteria
- [ ] `npm test -- --grep template` exits 0 with at least 6 passing cases.
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `grep -nE 'export function renderTemplate' src/utils/template.ts` matches one line.
- [ ] `test -f tests/template.test.ts` exits 0.

> If a `## Tasks` checkbox can't be completed without changing what the parent slice specifies, stop and update the slice. Do not redesign here.
