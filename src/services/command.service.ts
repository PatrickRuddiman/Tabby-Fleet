import { execFile as execFileCB } from 'child_process'
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
 * `agentCommand` and exits when the agent exits — so closing the pane / the
 * Tabby window doesn't trip Tabby's "X is still running" prompt for an
 * orphaned shell. Shell is detected by the basename of `shellCommand`
 * (the local profile's `options.command`). Returns the original argv
 * unchanged when `agentCommand` is empty or the shell is unrecognised.
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
    // No -NoExit: when the agent exits, pwsh exits, the pane closes cleanly.
    return { command: shellCommand, args: ['-NoLogo', '-Command', agentCommand] }
  }
  if (/^cmd(\.exe)?$/.test(base)) {
    // /C exits after the command; /K would keep the shell open.
    return { command: shellCommand, args: ['/C', agentCommand] }
  }
  if (/^wsl(\.exe)?$/.test(base)) {
    return {
      command: shellCommand,
      args: [...shellArgs, '--', 'bash', '-i', '-c', agentCommand],
    }
  }
  if (/^fish(\.exe)?$/.test(base)) {
    return { command: shellCommand, args: ['-i', '-C', agentCommand] }
  }
  if (/^(bash|zsh|sh|dash|ash)(\.exe)?$/.test(base)) {
    // No trailing `exec $SHELL`: when the agent exits, the shell exits.
    return { command: shellCommand, args: ['-i', '-c', agentCommand] }
  }
  // Unknown shell — leave argv alone; user can override via the Advanced section.
  return { command: shellCommand, args: shellArgs }
}

/**
 * Forcibly kill `pid` and every descendant in its process tree. Cross-platform.
 *
 * Windows: shells out to `taskkill /F /T /PID <pid>` which traverses the
 * parent-child tree and force-terminates each.
 *
 * Unix: signals the process group (works when the target is a session/group
 * leader, which is true for node-pty's POSIX backend via setsid), walks
 * descendants via `pgrep -P` for any stragglers, then escalates to SIGKILL
 * after a 200ms grace period.
 *
 * Always best-effort: errors are swallowed (process may already be dead, or
 * we may lack permissions on some descendants).
 */
export function killProcessTree(pid: number): Promise<void> {
  if (!pid || pid <= 0) return Promise.resolve()
  if (process.platform === 'win32') {
    return new Promise<void>(resolve => {
      execFileCB('taskkill', ['/F', '/T', '/PID', String(pid)], () => resolve())
    })
  }
  return killTreeUnix(pid)
}

async function killTreeUnix(pid: number): Promise<void> {
  // Group kill first — works if pid is a session leader (node-pty sets that up).
  try { process.kill(-pid, 'SIGTERM') } catch { /* not a group leader */ }
  try { process.kill(pid, 'SIGTERM') } catch { /* already dead */ }
  // Walk descendants in case the group kill missed orphans.
  const children = await listChildrenUnix(pid)
  for (const c of children) await killTreeUnix(c)
  await new Promise(r => setTimeout(r, 200))
  try { process.kill(-pid, 'SIGKILL') } catch { /* */ }
  try { process.kill(pid, 'SIGKILL') } catch { /* */ }
}

function listChildrenUnix(pid: number): Promise<number[]> {
  return new Promise(resolve => {
    execFileCB('pgrep', ['-P', String(pid)], (err, stdout) => {
      if (err) { resolve([]); return }
      const pids = stdout.split('\n').filter(Boolean).map(s => parseInt(s, 10)).filter(n => !isNaN(n))
      resolve(pids)
    })
  })
}
