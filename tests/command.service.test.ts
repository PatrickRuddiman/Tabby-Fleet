import { strict as assert } from 'assert'
import { spawn } from 'child_process'
import {
  killProcessTree,
  renderTitle,
  wrapForShell,
} from '../src/services/command.service'

describe('command.service', () => {
  describe('renderTitle', () => {
    it('substitutes title-template variables', () => {
      assert.equal(renderTitle('{branch_short}', { branch_short: 'feature' }), 'feature')
    })

    it('leaves unknown variables in {curly} form unchanged', () => {
      assert.equal(renderTitle('{repo}/{unknown}', { repo: 'foo' }), 'foo/{unknown}')
    })
  })

  describe('wrapForShell', () => {
    it('returns the original argv when agentCommand is empty', () => {
      const out = wrapForShell('pwsh.exe', ['-NoExit'], '')
      assert.equal(out.command, 'pwsh.exe')
      assert.deepEqual(out.args, ['-NoExit'])
    })

    it('returns the original argv when agentCommand is whitespace only', () => {
      const out = wrapForShell('bash', [], '   ')
      assert.deepEqual(out.args, [])
    })

    it('pwsh: -NoLogo -Command <cmd> (no -NoExit so shell exits with the agent)', () => {
      const out = wrapForShell('C:/Program Files/PowerShell/7/pwsh.exe', [], 'claude')
      assert.equal(out.command, 'C:/Program Files/PowerShell/7/pwsh.exe')
      assert.deepEqual(out.args, ['-NoLogo', '-Command', 'claude'])
    })

    it('powershell.exe matches the pwsh family', () => {
      const out = wrapForShell('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe', [], 'codex')
      assert.deepEqual(out.args, ['-NoLogo', '-Command', 'codex'])
    })

    it('cmd: /C <cmd> (no /K so shell exits)', () => {
      const out = wrapForShell('C:/Windows/System32/cmd.exe', [], 'opencode')
      assert.deepEqual(out.args, ['/C', 'opencode'])
    })

    it('bash: -i -c <cmd>', () => {
      const out = wrapForShell('/bin/bash', [], 'claude')
      assert.deepEqual(out.args, ['-i', '-c', 'claude'])
    })

    it('zsh / sh / dash / ash all use the bash-family wrapper', () => {
      for (const sh of ['zsh', 'sh', 'dash', 'ash']) {
        const out = wrapForShell(`/usr/bin/${sh}`, [], 'agent')
        assert.deepEqual(out.args, ['-i', '-c', 'agent'], `for ${sh}`)
      }
    })

    it('fish: -i -C <cmd>', () => {
      const out = wrapForShell('/usr/local/bin/fish', [], 'agent')
      assert.deepEqual(out.args, ['-i', '-C', 'agent'])
    })

    it('wsl: appends -- bash -i -c <cmd> to existing wsl args', () => {
      const out = wrapForShell('wsl.exe', ['-d', 'Ubuntu'], 'agent')
      assert.deepEqual(out.args, ['-d', 'Ubuntu', '--', 'bash', '-i', '-c', 'agent'])
    })

    it('unknown shell: returns the original argv unchanged', () => {
      const out = wrapForShell('/usr/bin/exotic-shell', ['--arg'], 'agent')
      assert.deepEqual(out.args, ['--arg'])
    })

    it('handles forward and backslash paths identically (Windows path normalisation)', () => {
      const a = wrapForShell('C:\\Windows\\System32\\cmd.exe', [], 'x')
      const b = wrapForShell('C:/Windows/System32/cmd.exe', [], 'x')
      assert.deepEqual(a.args, b.args)
    })
  })

  describe('killProcessTree', () => {
    it('resolves immediately for an invalid pid (0 / negative)', async () => {
      // No process kill should be attempted.
      await killProcessTree(0)
      await killProcessTree(-1)
    })

    it('actually kills a live child process', async function () {
      this.timeout(8000)
      // Spawn a long-running child that we can verify is dead afterwards.
      const cmd = process.platform === 'win32' ? 'powershell.exe' : 'sleep'
      const args = process.platform === 'win32' ? ['-NoProfile', '-Command', 'Start-Sleep 30'] : ['30']
      const child = spawn(cmd, args, { stdio: 'ignore' })
      await new Promise(resolve => setTimeout(resolve, 200))
      assert.equal(child.killed, false)
      await killProcessTree(child.pid!)
      // Wait for the OS to reap.
      await new Promise(resolve => setTimeout(resolve, 500))
      // process.kill with signal 0 throws ESRCH when the process is gone.
      let alive = true
      try {
        process.kill(child.pid!, 0)
      } catch (e: any) {
        if (e.code === 'ESRCH') alive = false
      }
      assert.equal(alive, false, 'process should be dead after killProcessTree')
    })
  })
})
