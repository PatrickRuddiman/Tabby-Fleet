import { strict as assert } from 'assert'
import { ConfirmFleetCloseModalComponent } from '../src/components/confirm-fleet-close-modal.component'

function makeMockActiveModal() {
  const calls: Array<{ method: string; arg: any }> = []
  return {
    calls,
    close: (v: any) => calls.push({ method: 'close', arg: v }),
    dismiss: (v?: any) => calls.push({ method: 'dismiss', arg: v }),
  }
}

describe('confirm-fleet-close-modal', () => {
  describe('ConfirmFleetCloseModalComponent', () => {
    it('instantiates with a mocked NgbActiveModal', () => {
      const modal = makeMockActiveModal()
      const c = new ConfirmFleetCloseModalComponent(modal as any)
      assert.equal(c.activeModal, modal)
    })

    it('confirm() calls activeModal.close(true)', () => {
      const modal = makeMockActiveModal()
      const c = new ConfirmFleetCloseModalComponent(modal as any)
      c.confirm()
      assert.equal(modal.calls.length, 1)
      assert.equal(modal.calls[0].method, 'close')
      assert.equal(modal.calls[0].arg, true)
    })

    it('cancel() calls activeModal.dismiss()', () => {
      const modal = makeMockActiveModal()
      const c = new ConfirmFleetCloseModalComponent(modal as any)
      c.cancel()
      assert.equal(modal.calls.length, 1)
      assert.equal(modal.calls[0].method, 'dismiss')
    })

    it('exposes the repoName Input for the template to render', () => {
      const modal = makeMockActiveModal()
      const c = new ConfirmFleetCloseModalComponent(modal as any)
      c.repoName = 'wineapi'
      assert.equal(c.repoName, 'wineapi')
    })
  })
})
