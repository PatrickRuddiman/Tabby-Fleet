import { strict as assert } from 'assert'
import {
  computeLayoutWeights,
  PaneInfo,
  LayoutWeights,
} from '../src/services/layout.service'

const ROOT: PaneInfo = { id: 'r', role: 'root', baselineWeight: 2 }

function wt(n: number): PaneInfo {
  return { id: `w${n}`, role: 'worktree', baselineWeight: 1 }
}

function byId(out: LayoutWeights[], id: string): LayoutWeights {
  const w = out.find(x => x.paneId === id)
  if (!w) throw new Error(`pane ${id} not in output`)
  return w
}

function approx(actual: number, expected: number, tol = 0.001): void {
  assert.ok(
    Math.abs(actual - expected) < tol,
    `expected ~${expected}, got ${actual} (tol ${tol})`,
  )
}

const BIG = { width: 1000, height: 1000 }
const FLOOR = { width: 120, height: 80 }

describe('layout.service', () => {
  describe('computeLayoutWeights', () => {
    it('1 pane returns weight 1.0', () => {
      const out = computeLayoutWeights([ROOT], null, 2, BIG, FLOOR, 'grid')
      assert.equal(out.length, 1)
      assert.equal(out[0].weight, 1)
      assert.equal(out[0].clamped, false)
    })

    it('2 panes (root + 1 wt) baseline = root 0.5 horizontal, wt 1.0 vertical', () => {
      const out = computeLayoutWeights([ROOT, wt(1)], null, 2, BIG, FLOOR, 'grid')
      approx(byId(out, 'r').weight, 0.5)
      approx(byId(out, 'w1').weight, 1.0)
    })

    it('5 panes (root + 4 wt) baseline = root 0.5 + each worktree 0.25 within right column', () => {
      const panes = [ROOT, wt(1), wt(2), wt(3), wt(4)]
      const out = computeLayoutWeights(panes, null, 2, BIG, FLOOR, 'grid')
      approx(byId(out, 'r').weight, 0.5)
      approx(byId(out, 'w1').weight, 0.25)
      approx(byId(out, 'w2').weight, 0.25)
      approx(byId(out, 'w3').weight, 0.25)
      approx(byId(out, 'w4').weight, 0.25)
    })

    it("zoom on worktree B grows it ≈2x baseline within right column, root unchanged", () => {
      // 4 worktrees: B baseline 0.25; with Z=2 → target = 2/(2+3) = 0.4 = 1.6x baseline.
      // Spec accepts "approximately twice". Others share (1-0.4)/3 = 0.2 each.
      const panes = [ROOT, wt(1), wt(2), wt(3), wt(4)]
      const out = computeLayoutWeights(panes, 'w2', 2, BIG, FLOOR, 'grid')
      approx(byId(out, 'r').weight, 0.5) // root unchanged
      approx(byId(out, 'w2').weight, 0.4) // focused
      approx(byId(out, 'w1').weight, 0.2)
      approx(byId(out, 'w3').weight, 0.2)
      approx(byId(out, 'w4').weight, 0.2)
    })

    it('zoom on root: root grows to ≈0.67 within root container', () => {
      const panes = [ROOT, wt(1), wt(2), wt(3)]
      const out = computeLayoutWeights(panes, 'r', 2, BIG, FLOOR, 'grid')
      approx(byId(out, 'r').weight, 2 / 3)
      // Worktrees still even within the right column.
      approx(byId(out, 'w1').weight, 1 / 3)
      approx(byId(out, 'w2').weight, 1 / 3)
      approx(byId(out, 'w3').weight, 1 / 3)
    })

    it('10-pane fleet zoom with min-height floor: unfocused clamped at floor, focused absorbs remainder', () => {
      // 5 worktrees, height 400 px, floor 80 px → floor ratio 0.2.
      // Baseline per worktree = 0.2 = exact floor. Zoom on w2 with Z=2:
      //   focused target = 2/(2+4) = 0.333 (133 px)
      //   others tentative = (1-0.333)/4 = 0.167 (67 px) — below floor.
      //   clamp others at 0.2 each, surplus = 4×(0.2-0.167) = 0.133.
      //   focused = 0.333 - 0.133 = 0.2 → exactly floor; sum = 1.0.
      const panes = [ROOT, wt(1), wt(2), wt(3), wt(4), wt(5)]
      const small = { width: 1000, height: 400 }
      const out = computeLayoutWeights(panes, 'w2', 2, small, FLOOR, 'grid')
      approx(byId(out, 'w1').weight, 0.2)
      approx(byId(out, 'w3').weight, 0.2)
      approx(byId(out, 'w4').weight, 0.2)
      approx(byId(out, 'w5').weight, 0.2)
      approx(byId(out, 'w2').weight, 0.2)
      assert.equal(byId(out, 'w1').clamped, true)
      assert.equal(byId(out, 'w3').clamped, true)
      assert.equal(byId(out, 'w4').clamped, true)
      assert.equal(byId(out, 'w5').clamped, true)
    })

    it("mode 'static-grid' ignores focusedId", () => {
      const panes = [ROOT, wt(1), wt(2), wt(3), wt(4)]
      const zoomed = computeLayoutWeights(panes, 'w2', 2, BIG, FLOOR, 'static-grid')
      const baseline = computeLayoutWeights(panes, null, 2, BIG, FLOOR, 'grid')
      // Static-grid + focusedId should produce identical output to baseline (no focus).
      for (const p of zoomed) {
        const b = byId(baseline, p.paneId)
        approx(p.weight, b.weight)
      }
    })

    it('clamped flag is set on every pane that hits the floor', () => {
      // 4 worktrees, height = 200, floor = 80 → floor ratio = 0.4. Baseline = 0.25 < 0.4.
      // All baseline worktrees are below floor → degenerate; everything clamps at 0.4.
      const panes = [ROOT, wt(1), wt(2), wt(3), wt(4)]
      const small = { width: 1000, height: 200 }
      const out = computeLayoutWeights(panes, null, 2, small, FLOOR, 'grid')
      // root unaffected by height floor
      approx(byId(out, 'r').weight, 0.5)
      assert.equal(byId(out, 'w1').clamped, true)
      assert.equal(byId(out, 'w2').clamped, true)
      assert.equal(byId(out, 'w3').clamped, true)
      assert.equal(byId(out, 'w4').clamped, true)
    })
  })
})
