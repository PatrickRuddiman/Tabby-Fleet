import { Component, Input } from '@angular/core'

/**
 * Absolute-positioned overlay attached to fleet panes that were restored from
 * a recovery token. Shows the pane title and the originally-configured
 * command and exposes a Relaunch button that invokes `onRelaunch`.
 */
@Component({
  selector: 'agent-fleet-dead-pane-overlay',
  templateUrl: './fleet-dead-pane-overlay.component.pug',
  styleUrls: ['./fleet-dead-pane-overlay.component.scss'],
})
export class FleetDeadPaneOverlayComponent {
  @Input() paneTitle: string = ''
  @Input() command: string = ''
  @Input() onRelaunch: () => void = () => {}

  relaunch(): void {
    this.onRelaunch()
  }
}
