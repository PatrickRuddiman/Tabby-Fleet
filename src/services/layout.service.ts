export interface PaneInfo {
  id: string
  role: 'root' | 'worktree'
  baselineWeight: number
}

export interface LayoutWeights {
  paneId: string
  weight: number
  clamped: boolean
}

export type LayoutMode = 'grid' | 'static-grid'

/**
 * Pure computation of per-pane ratios for the fleet's two-container layout
 * (root container = horizontal split between root pane and right container;
 * right container = vertical stack of worktree panes). See
 * slices/layout-engine.md §4 for the full contract.
 *
 * Output is one entry per input pane, same length and order. Each entry's
 * `weight` is the pane's ratio *within its container*: the root pane's
 * weight lives in the root container alongside an implicit (1 − rootWeight)
 * slot for the right container; each worktree pane's weight lives in the
 * right container with the right-container weights summing to 1.
 */
export function computeLayoutWeights(
  panes: PaneInfo[],
  focusedId: string | null,
  zoomFactor: number,
  containerSize: { width: number; height: number },
  minFloor: { width: number; height: number },
  mode: LayoutMode,
): LayoutWeights[] {
  if (panes.length === 0) return []
  if (panes.length === 1) {
    return [{ paneId: panes[0].id, weight: 1, clamped: false }]
  }

  const rootPane = panes.find(p => p.role === 'root') ?? null
  const worktreePanes = panes.filter(p => p.role === 'worktree')

  const zeroContainer = containerSize.width <= 0 || containerSize.height <= 0
  const focusEnabled = mode === 'grid' && focusedId != null && !zeroContainer
  const focused = focusEnabled ? panes.find(p => p.id === focusedId) ?? null : null

  // ── Root container: root pane ratio (right container slot is 1 − this) ──
  let rootPaneWeight = 0.5
  let rootPaneClamped = false

  if (rootPane && worktreePanes.length > 0) {
    if (focused && focused.id === rootPane.id) {
      // Zoom on root: target = Z·rootBase / (Z·rootBase + rightBase).
      // Both baselines are 2 by spec, so this simplifies to Z / (Z + 1).
      rootPaneWeight = zoomFactor / (zoomFactor + 1)
    }
    if (!zeroContainer) {
      const widthFloorRatio = minFloor.width / containerSize.width
      // Right side must be ≥ floor — pull root down if it would crush the right.
      if (1 - rootPaneWeight < widthFloorRatio) {
        rootPaneWeight = 1 - widthFloorRatio
      }
      // Root must be ≥ floor — clamp up.
      if (rootPaneWeight < widthFloorRatio) {
        rootPaneWeight = widthFloorRatio
        rootPaneClamped = true
      }
    }
  } else if (!rootPane) {
    rootPaneWeight = 0
  } else {
    rootPaneWeight = 1
  }

  // ── Right container: worktree ratios summing to 1 (within container) ──
  let wtComputed: { id: string; weight: number; clamped: boolean }[] = []

  if (worktreePanes.length > 0) {
    const wtTotalBaseline = worktreePanes.reduce((s, p) => s + p.baselineWeight, 0)

    if (focused && focused.role === 'worktree') {
      const focusedBaseline = focused.baselineWeight
      const otherBaselineSum = wtTotalBaseline - focusedBaseline
      const targetFocused =
        otherBaselineSum > 0
          ? (zoomFactor * focusedBaseline) /
            (zoomFactor * focusedBaseline + otherBaselineSum)
          : 1
      const remaining = 1 - targetFocused
      wtComputed = worktreePanes.map(p => {
        if (p.id === focused.id) {
          return { id: p.id, weight: targetFocused, clamped: false }
        }
        const share = otherBaselineSum > 0 ? p.baselineWeight / otherBaselineSum : 0
        return { id: p.id, weight: remaining * share, clamped: false }
      })
    } else {
      wtComputed = worktreePanes.map(p => ({
        id: p.id,
        weight: wtTotalBaseline > 0 ? p.baselineWeight / wtTotalBaseline : 0,
        clamped: false,
      }))
    }

    if (!zeroContainer && containerSize.height > 0) {
      const heightFloorRatio = minFloor.height / containerSize.height
      const focusedHere = focused && focused.role === 'worktree' ? focused.id : null
      wtComputed = focusedHere
        ? clampAndRedistributeToFocused(wtComputed, heightFloorRatio, focusedHere)
        : clampAndRedistributeEven(wtComputed, heightFloorRatio)
    }
  }

  return panes.map(p => {
    if (rootPane && p.id === rootPane.id) {
      return { paneId: p.id, weight: rootPaneWeight, clamped: rootPaneClamped }
    }
    const wt = wtComputed.find(w => w.id === p.id)
    return wt
      ? { paneId: p.id, weight: wt.weight, clamped: wt.clamped }
      : { paneId: p.id, weight: 0, clamped: false }
  })
}

type WeightItem = { id: string; weight: number; clamped: boolean }

function clampAndRedistributeEven(items: WeightItem[], floorRatio: number): WeightItem[] {
  if (floorRatio <= 0) return items
  const result: WeightItem[] = items.map(i => ({ ...i }))
  let safety = 0
  while (safety++ < 1000) {
    const unclamped = result.filter(i => !i.clamped)
    const below = unclamped.filter(i => i.weight < floorRatio)
    if (below.length === 0) break
    if (below.length === unclamped.length) {
      // Every remaining pane is below floor → degenerate overflow; clamp all.
      below.forEach(b => {
        b.weight = floorRatio
        b.clamped = true
      })
      break
    }
    let surplus = 0
    below.forEach(b => {
      surplus += floorRatio - b.weight
      b.weight = floorRatio
      b.clamped = true
    })
    const stillFree = result.filter(i => !i.clamped)
    const totalFree = stillFree.reduce((s, i) => s + i.weight, 0)
    if (totalFree > 0) {
      stillFree.forEach(i => {
        i.weight -= surplus * (i.weight / totalFree)
      })
    }
  }
  return result
}

function clampAndRedistributeToFocused(
  items: WeightItem[],
  floorRatio: number,
  focusedId: string,
): WeightItem[] {
  if (floorRatio <= 0) return items
  const result: WeightItem[] = items.map(i => ({ ...i }))

  let surplus = 0
  result.forEach(i => {
    if (i.id !== focusedId && i.weight < floorRatio) {
      surplus += floorRatio - i.weight
      i.weight = floorRatio
      i.clamped = true
    }
  })

  const focused = result.find(i => i.id === focusedId)
  if (focused) {
    focused.weight -= surplus
    if (focused.weight < floorRatio) {
      focused.weight = floorRatio
      focused.clamped = true
    }
  }

  return result
}
