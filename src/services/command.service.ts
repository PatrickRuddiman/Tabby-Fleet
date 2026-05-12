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

/**
 * Override a Tabby Local profile's shell argv so the shell auto-executes
 * `agentCommand` on startup and stays interactive afterwards. Shell is
 * detected by the basename of `shellCommand` (the local profile's
 * `options.command`). Returns the original argv unchanged when `agentCommand`
 * is empty or the shell is unrecognised.
 */
export function wrapForShell(
  shellCommand: string,
  shellArgs: string[],
  agentCommand: string,
): { command: string; args: string[] } {
  if (!agentCommand || !agentCommand.trim()) {
    return { command: shellCommand, args: shellArgs }
  }
  const base = (shellCommand || '').toLowerCase().replace(/\\/g, '/').split('/').pop() ?? ''
  if (/^(pwsh|powershell)(\.exe)?$/.test(base)) {
    return { command: shellCommand, args: ['-NoExit', '-Command', agentCommand] }
  }
  if (/^cmd(\.exe)?$/.test(base)) {
    return { command: shellCommand, args: ['/K', agentCommand] }
  }
  if (/^wsl(\.exe)?$/.test(base)) {
    return {
      command: shellCommand,
      args: [...shellArgs, '--', 'bash', '-i', '-c', `${agentCommand}; exec bash`],
    }
  }
  if (/^fish(\.exe)?$/.test(base)) {
    return { command: shellCommand, args: ['-i', '-C', agentCommand] }
  }
  if (/^(bash|zsh|sh|dash|ash)(\.exe)?$/.test(base)) {
    const shellName = base.replace(/\.exe$/, '')
    return { command: shellCommand, args: ['-i', '-c', `${agentCommand}; exec ${shellName}`] }
  }
  // Unknown shell — leave argv alone; user can override via the Advanced section.
  return { command: shellCommand, args: shellArgs }
}
