import { Component, Input } from '@angular/core'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'

/**
 * NgbModal content shown when the developer tries to close the root pane of
 * an Agent Fleet tab. Resolves to `true` on confirm, dismisses on cancel.
 */
@Component({
  selector: 'agent-fleet-confirm-close-modal',
  templateUrl: './confirm-fleet-close-modal.component.pug',
  styleUrls: ['./confirm-fleet-close-modal.component.scss'],
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
