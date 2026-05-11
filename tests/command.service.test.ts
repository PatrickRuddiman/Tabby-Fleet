import { strict as assert } from 'assert'
import {
  buildSpawnDescriptor,
  renderTitle,
  ShellConfig,
  SpawnDescriptor,
} from '../src/services/command.service'

const ENCODED: ShellConfig = {
  shell: 'pwsh.exe',
  shellArgs: ['-NoExit', '-EncodedCommand'],
  encoding: 'encoded',
}

const COMMAND_MODE: ShellConfig = {
  shell: 'pwsh.exe',
  shellArgs: ['-NoExit', '-Command'],
  encoding: 'command',
}

const VARS = { branch: 'agent/feature' }

describe('command.service', () => {
  describe('buildSpawnDescriptor', () => {
    it("encoded mode appends a base64 payload as the last arg", () => {
      const desc = buildSpawnDescriptor('claude --resume {branch}', VARS, 'C:/repo', ENCODED)
      assert.equal(desc.command, 'pwsh.exe')
      assert.deepEqual(desc.args.slice(0, 2), ['-NoExit', '-EncodedCommand'])
      const payload = desc.args[2]
      const decoded = Buffer.from(payload, 'base64').toString('utf16le')
      assert.equal(decoded, 'claude --resume agent/feature')
    })

    it("command mode wraps the rendered command in & { ... }", () => {
      const desc = buildSpawnDescriptor('claude --resume {branch}', VARS, 'C:/repo', COMMAND_MODE)
      assert.deepEqual(desc.args.slice(0, 2), ['-NoExit', '-Command'])
      assert.equal(desc.args[2], '& { claude --resume agent/feature }')
    })

    it('cwd is passed through unchanged', () => {
      const desc = buildSpawnDescriptor('claude', {}, 'C:/some/where', ENCODED)
      assert.equal(desc.cwd, 'C:/some/where')
    })

    it('command field equals shell.shell', () => {
      const desc1 = buildSpawnDescriptor('echo hi', {}, '.', { ...ENCODED, shell: 'bash' })
      assert.equal(desc1.command, 'bash')
      const desc2 = buildSpawnDescriptor('echo hi', {}, '.', { ...COMMAND_MODE, shell: 'cmd.exe' })
      assert.equal(desc2.command, 'cmd.exe')
    })

    it('empty template still produces a valid SpawnDescriptor', () => {
      const desc: SpawnDescriptor = buildSpawnDescriptor('', {}, 'C:/repo', ENCODED)
      assert.equal(desc.command, 'pwsh.exe')
      assert.equal(desc.cwd, 'C:/repo')
      assert.equal(desc.args.length, 3)
      assert.equal(Buffer.from(desc.args[2], 'base64').toString('utf16le'), '')
    })

    it('branch with spaces and quotes round-trips through encoded mode without truncation', () => {
      const desc = buildSpawnDescriptor(
        'claude --resume {branch}',
        { branch: 'agent/feature with "spaces" and \'quotes\'' },
        'C:/repo',
        ENCODED,
      )
      const decoded = Buffer.from(desc.args[2], 'base64').toString('utf16le')
      assert.equal(decoded, 'claude --resume agent/feature with "spaces" and \'quotes\'')
    })
  })

  describe('renderTitle', () => {
    it('substitutes title-template variables', () => {
      assert.equal(renderTitle('{branch_short}', { branch_short: 'feature' }), 'feature')
    })
  })
})
