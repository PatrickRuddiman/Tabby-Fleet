import { Component, Input } from '@angular/core'

/**
 * Absolute-positioned overlay attached to fleet panes that were restored from
 * a recovery token. Shows the pane title and the originally-configured
 * command and exposes a Relaunch button that invokes `onRelaunch`.
 */
@Component({
  selector: 'agent-fleet-dead-pane-overlay',
  template: `
    <div class="fleet-overlay">
      <div class="fleet-overlay-card">
        <h4 class="fleet-overlay-title">{{ paneTitle }}</h4>
        <p class="text-muted">Command:</p>
        <pre class="fleet-overlay-cmd">{{ command }}</pre>
        <button type="button" class="btn btn-primary" (click)="relaunch()">Relaunch</button>
      </div>
    </div>
  `,
  styles: [`
    :host .fleet-overlay {
      position: absolute;
      inset: 0;
      z-index: 1000;
      pointer-events: auto;
      background: rgba(0, 0, 0, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    :host .fleet-overlay-card {
      background: #ffffff;
      color: #212529;
      padding: 1.5rem;
      border-radius: 0.5rem;
      max-width: 90%;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }
    :host .fleet-overlay-title { margin: 0 0 0.5rem 0; font-weight: 600; }
    :host .fleet-overlay-cmd {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      background: rgba(0, 0, 0, 0.05);
      padding: 0.5rem 0.75rem;
      border-radius: 0.25rem;
      margin-bottom: 1rem;
      white-space: pre-wrap;
      word-break: break-word;
    }
  `],
})
export class FleetDeadPaneOverlayComponent {
  @Input() paneTitle: string = ''
  @Input() command: string = ''
  @Input() onRelaunch: () => void = () => {}

  relaunch(): void {
    this.onRelaunch()
  }
}
