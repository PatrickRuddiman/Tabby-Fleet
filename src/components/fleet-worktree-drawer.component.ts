import { Component, HostBinding, Input } from '@angular/core'

export interface DrawerItem {
  key: string
  title: string
  branch: string | null
  kind: 'alive-active' | 'alive-parked' | 'exited'
}

/**
 * Right-pinned collapsible drawer.
 *
 * Collapsed (default): a 40px vertical strip with a double-chevron toggle at
 * the top and a stack of compact chips below — one per worktree, labelled
 * with the first 2 chars of the branch slug, colour-coded by state.
 *
 * Expanded: 280px panel showing Active/Inactive cards (title + branch) with
 * the same click semantics. Clicking a chip or card delegates to onSelect.
 */
@Component({
  selector: 'agent-fleet-worktree-drawer',
  template: `
    <button class="chevron-toggle" type="button"
            (click)="toggle()"
            [title]="expanded ? 'Collapse drawer' : 'Expand drawer (' + inactiveItems.length + ' parked)'">
      <span class="chevron-arrow"></span>
      <span class="chevron-arrow"></span>
      <span class="count" *ngIf="!expanded && inactiveItems.length > 0">{{ inactiveItems.length }}</span>
    </button>

    <div class="chip-stack" *ngIf="!expanded">
      <button *ngFor="let item of activeItems; trackBy: trackByKey"
              type="button"
              class="chip active"
              (click)="select(item)"
              [title]="chipTooltip(item)">
        {{ chipLabel(item) }}
      </button>
      <div class="chip-divider" *ngIf="activeItems.length > 0 && inactiveItems.length > 0"></div>
      <button *ngFor="let item of inactiveItems; trackBy: trackByKey"
              type="button"
              class="chip"
              [class.exited]="item.kind === 'exited'"
              (click)="select(item)"
              [title]="chipTooltip(item)">
        {{ chipLabel(item) }}
      </button>
    </div>

    <div class="drawer-body" *ngIf="expanded">
      <div class="section">
        <div class="section-label">Active <span class="muted">({{ activeItems.length }})</span></div>
        <button *ngFor="let item of activeItems; trackBy: trackByKey"
                type="button" class="card active"
                (click)="select(item)"
                title="Focus this pane">
          <div class="card-title">{{ item.title }}</div>
          <div class="card-branch">{{ item.branch || '(detached)' }}</div>
        </button>
      </div>
      <div class="divider"></div>
      <div class="section">
        <div class="section-label">Inactive <span class="muted">({{ inactiveItems.length }})</span></div>
        <div class="empty-state" *ngIf="inactiveItems.length === 0">No parked worktrees.</div>
        <button *ngFor="let item of inactiveItems; trackBy: trackByKey"
                type="button" class="card"
                [class.exited]="item.kind === 'exited'"
                (click)="select(item)"
                [title]="item.kind === 'exited' ? 'Relaunch this worktree' : 'Bring into the grid'">
          <div class="card-title">
            <span class="dot" [class.exited]="item.kind === 'exited'"></span>
            {{ item.title }}
          </div>
          <div class="card-branch">{{ item.branch || '(detached)' }}</div>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      width: 40px;
      z-index: 1000;
      pointer-events: auto;
      display: block;
      background: rgba(15, 15, 18, 0.92);
      border-left: 1px solid rgba(255, 255, 255, 0.08);
      transition: width 180ms ease;
      overflow: hidden;
      box-sizing: border-box;
      color: #e9ecef;
    }
    :host([expanded='true']) {
      width: 280px;
    }
    :host .chevron-toggle {
      position: relative;
      width: 100%;
      height: 28px;
      background: rgba(45, 45, 52, 0.98);
      color: #e9ecef;
      border: none;
      border-bottom: 1px solid rgba(255, 255, 255, 0.10);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      gap: 1px;
      z-index: 2;
    }
    :host .chevron-toggle:hover {
      background: #3a3a44;
    }
    :host .chevron-arrow {
      width: 0;
      height: 0;
      border-style: solid;
      border-width: 4px 5px 4px 0;
      border-color: transparent #e9ecef transparent transparent;
      transition: transform 180ms ease;
    }
    :host([expanded='true']) .chevron-arrow {
      transform: rotate(180deg);
    }
    :host .count {
      position: absolute;
      top: 2px;
      right: 4px;
      font-size: 0.6rem;
      background: #5179e0;
      color: #fff;
      border-radius: 8px;
      padding: 0 4px;
      font-weight: 700;
      line-height: 1.3;
      min-width: 14px;
      text-align: center;
    }
    :host .chip-stack {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 8px 4px;
      overflow-y: auto;
      overflow-x: hidden;
      height: calc(100% - 28px);
      box-sizing: border-box;
    }
    :host .chip {
      width: 30px;
      height: 30px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.10);
      background: #1a1d20;
      color: #e9ecef;
      font: 600 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex: 0 0 auto;
      padding: 0;
      transition: background 120ms, border-color 120ms, transform 80ms;
    }
    :host .chip:hover {
      background: #2b2f33;
      border-color: rgba(255, 255, 255, 0.25);
    }
    :host .chip:active {
      transform: translateY(1px);
    }
    :host .chip.active {
      border-color: rgba(103, 201, 139, 0.55);
      background: rgba(103, 201, 139, 0.08);
    }
    :host .chip.exited {
      border-color: rgba(217, 122, 85, 0.55);
      background: rgba(217, 122, 85, 0.10);
    }
    :host .chip-divider {
      width: 22px;
      height: 1px;
      background: rgba(255, 255, 255, 0.12);
      margin: 2px 0;
      flex: 0 0 auto;
    }
    :host .drawer-body {
      position: absolute;
      left: 0;
      right: 0;
      top: 28px;
      bottom: 0;
      overflow-y: auto;
      padding: 0.6rem 0.6rem 0.6rem 0.6rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      box-sizing: border-box;
    }
    :host .section {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }
    :host .section-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #adb5bd;
      padding: 0 0.2rem;
    }
    :host .section-label .muted {
      color: #6c757d;
      font-weight: 400;
    }
    :host .divider {
      height: 1px;
      background: rgba(255, 255, 255, 0.08);
      margin: 0.2rem 0;
    }
    :host .empty-state {
      font-size: 0.78rem;
      color: #6c757d;
      padding: 0.3rem 0.2rem;
      font-style: italic;
    }
    :host .card {
      background: #2b2f33;
      color: #e9ecef;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 0.35rem;
      padding: 0.45rem 0.55rem;
      text-align: left;
      cursor: pointer;
      transition: background 120ms, border-color 120ms, transform 80ms;
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      min-width: 0;
      font: inherit;
    }
    :host .card:hover {
      background: #3a3f44;
      border-color: rgba(255, 255, 255, 0.18);
    }
    :host .card:active {
      transform: translateY(1px);
    }
    :host .card.active {
      border-color: rgba(103, 201, 139, 0.30);
    }
    :host .card.exited {
      background: #2a2422;
      border-color: rgba(217, 122, 85, 0.25);
    }
    :host .card.exited:hover {
      background: #3a3030;
      border-color: rgba(217, 122, 85, 0.50);
    }
    :host .card-title {
      font-weight: 600;
      font-size: 0.82rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    :host .dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      background: #67c98b;
      flex: 0 0 auto;
    }
    :host .dot.exited {
      background: #d97a55;
    }
    :host .card-branch {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.7rem;
      color: #adb5bd;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `],
})
export class FleetWorktreeDrawerComponent {
  @Input() activeItems: DrawerItem[] = []
  @Input() inactiveItems: DrawerItem[] = []
  @Input() onSelect: (item: DrawerItem) => void = () => {}

  expanded = false

  @HostBinding('attr.expanded') get expandedAttr(): string | null {
    return this.expanded ? 'true' : null
  }

  toggle(): void {
    this.expanded = !this.expanded
  }

  select(item: DrawerItem): void {
    this.onSelect(item)
  }

  chipLabel(item: DrawerItem): string {
    const source = (item.title || item.branch || '').trim()
    if (!source) return '??'
    const clean = source.replace(/^[^a-zA-Z0-9]+/, '')
    return (clean.slice(0, 2) || '??').toUpperCase()
  }

  chipTooltip(item: DrawerItem): string {
    const action = item.kind === 'exited'
      ? 'Click to relaunch'
      : item.kind === 'alive-parked'
        ? 'Click to bring into grid'
        : 'Click to focus'
    return `${item.title} (${item.branch || 'detached'}) — ${action}`
  }

  trackByKey(_index: number, item: DrawerItem): string {
    return `${item.kind}:${item.key}`
  }
}
