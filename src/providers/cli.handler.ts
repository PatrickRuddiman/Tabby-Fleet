import { Injectable } from '@angular/core'
import * as TabbyCore from 'tabby-core'
import type { CLIEvent, CLIHandler as ICLIHandler } from 'tabby-core/typings/api/cli'

// tabby-core 1.0.231-nightly's published .d.ts barrel re-exports drop CLIHandler
// even though the runtime bundle exports it. Pull the value off the top-level
// module, then cast through the deep-path type so the rest of this file remains
// type-safe.
const CLIHandler = (TabbyCore as unknown as { CLIHandler: typeof ICLIHandler }).CLIHandler

/**
 * Swallows the spurious `second-instance` events that fire whenever Tabby's
 * bundled node-pty tears down a Windows PTY.
 *
 * In `windowsPtyAgent.js` the non-conpty.dll branch of `kill()` calls
 * `child_process.fork(path.join(__dirname, 'conpty_console_list_agent'), …)`
 * to enumerate the console process list. In an Electron renderer
 * `process.execPath` is `tabby.exe`, so `fork()` ends up spawning
 * `tabby.exe node_modules\node-pty\lib\conpty_console_list_agent <pid>`.
 * Electron's single-instance lock forwards that as a `secondInstance` event,
 * Tabby's `OpenPathCLIHandler` tries to `fs.lstat` the (asar-internal,
 * nonexistent) path, and the resulting ENOENT becomes a red Angular toast.
 *
 * One toast is invisible. Fourteen — i.e. closing a fleet tab with that many
 * panes — overwhelm the renderer and crash the window when DevTools isn't
 * attached. This handler claims those events at top priority before
 * OpenPathCLIHandler ever sees them.
 */
@Injectable({ providedIn: 'root' })
export class FleetSuppressConptyHelperCLIHandler extends CLIHandler {
  firstMatchOnly = true
  priority = 1000

  async handle(event: CLIEvent): Promise<boolean> {
    if (!event?.secondInstance) return false
    const op = event.argv?._?.[0]
    if (typeof op !== 'string') return false
    return /node-pty[\\/]lib[\\/]conpty_console_list_agent$/.test(op)
  }
}
