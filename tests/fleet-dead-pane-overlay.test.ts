import { strict as assert } from 'assert'
import { FleetDeadPaneOverlayComponent } from '../src/components/fleet-dead-pane-overlay.component'

describe('fleet-dead-pane-overlay', () => {
  describe('FleetDeadPaneOverlayComponent', () => {
    it('instantiates with all three inputs', () => {
      const c = new FleetDeadPaneOverlayComponent()
      c.paneTitle = 'feature-x'
      c.command = 'claude --resume agent/feature-x'
      c.onRelaunch = () => {}
      assert.equal(c.paneTitle, 'feature-x')
      assert.equal(c.command, 'claude --resume agent/feature-x')
      assert.equal(typeof c.onRelaunch, 'function')
    })

    it('relaunch() invokes the onRelaunch callback', () => {
      let calls = 0
      const c = new FleetDeadPaneOverlayComponent()
      c.onRelaunch = () => { calls++ }
      c.relaunch()
      assert.equal(calls, 1)
    })

    it('default onRelaunch is a no-op and relaunch() does not throw', () => {
      const c = new FleetDeadPaneOverlayComponent()
      // No explicit assignment — should still be safely invocable.
      c.relaunch()
    })

    it('exposes the command input value verbatim (rendered inside <pre> by the template)', () => {
      const c = new FleetDeadPaneOverlayComponent()
      c.command = 'pwsh.exe -NoExit -EncodedCommand AAA=='
      assert.equal(c.command, 'pwsh.exe -NoExit -EncodedCommand AAA==')
    })
  })
})
