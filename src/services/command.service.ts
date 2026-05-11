import { renderTemplate } from '../utils/template'
import { encodeForPwsh, escapeForPwshCommand } from '../utils/pwsh'

export type SpawnDescriptor = {
  command: string
  args: string[]
  cwd: string
}

export type ShellConfig = {
  shell: string
  shellArgs: string[]
  encoding: 'encoded' | 'command'
}

/**
 * Render a command template and produce the spawn descriptor for the host's
 * `child_process.spawn` (or Tabby's pane construction). Dispatches on
 * `shell.encoding`:
 *   - 'encoded' appends the UTF-16LE base64 payload to `shell.shellArgs`
 *     (paired with `-EncodedCommand` in the defaults).
 *   - 'command' wraps the rendered command in `& { ... }` after escaping `"` and `$`,
 *     then appends to `shell.shellArgs` (paired with `-Command` in the defaults).
 */
export function buildSpawnDescriptor(
  template: string,
  vars: Record<string, string>,
  cwd: string,
  shell: ShellConfig,
): SpawnDescriptor {
  const rendered = renderTemplate(template, vars)
  if (shell.encoding === 'encoded') {
    return {
      command: shell.shell,
      args: [...shell.shellArgs, encodeForPwsh(rendered)],
      cwd,
    }
  }
  const wrapped = '& { ' + escapeForPwshCommand(rendered) + ' }'
  return {
    command: shell.shell,
    args: [...shell.shellArgs, wrapped],
    cwd,
  }
}

/**
 * Render a title template. Same engine as `renderTemplate`; named separately for
 * semantic clarity at call sites that produce pane titles rather than commands.
 */
export function renderTitle(template: string, vars: Record<string, string>): string {
  return renderTemplate(template, vars)
}
