import { Component, Input } from '@angular/core'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'

/**
 * NgbModal content shown when the developer tries to close the root pane of
 * an Agent Fleet tab. Resolves to `true` on confirm, dismisses on cancel.
 */
@Component({
  selector: 'agent-fleet-confirm-close-modal',
  template: `
    <div class="modal-header">
      <h4 class="modal-title">Close this fleet?</h4>
      <button type="button" class="btn-close" aria-label="Close" (click)="cancel()"></button>
    </div>
    <div class="modal-body">
      <p>Closing the root will close the entire fleet tab and stop monitoring <code>{{ repoName }}</code>.</p>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" (click)="cancel()">Cancel</button>
      <button type="button" class="btn btn-danger" (click)="confirm()">Close fleet</button>
    </div>
  `,
  styles: [`
    :host .modal-body code {
      background: rgba(0, 0, 0, 0.05);
      padding: 0.1em 0.35em;
      border-radius: 0.2em;
    }
  `],
})
export class ConfirmFleetCloseModalComponent {
  @Input() repoName: string = ''

  constructor(public activeModal: NgbActiveModal) {}

  confirm(): void {
    this.activeModal.close(true)
  }

  cancel(): void {
    this.activeModal.dismiss()
  }
}
