import { strict as assert } from 'assert'
import { encodeForPwsh, escapeForPwshCommand } from '../src/utils/pwsh'

function roundTrip(cmd: string): string {
  return Buffer.from(encodeForPwsh(cmd), 'base64').toString('utf16le')
}

describe('pwsh', () => {
  describe('encodeForPwsh', () => {
    it('round-trips ASCII through base64 + UTF-16LE', () => {
      const cmd = 'claude --resume agent/feature'
      assert.equal(roundTrip(cmd), cmd)
    })

    it('round-trips non-ASCII (unicode) characters', () => {
      const cmd = 'echo "naïve résumé — αβγ 中文"'
      assert.equal(roundTrip(cmd), cmd)
    })

    it('round-trips the empty string', () => {
      assert.equal(roundTrip(''), '')
    })
  })

  describe('escapeForPwshCommand', () => {
    it('escapes literal double-quotes', () => {
      assert.equal(escapeForPwshCommand('echo "hello"'), 'echo \\"hello\\"')
    })

    it('escapes literal $ to prevent PowerShell variable expansion', () => {
      assert.equal(escapeForPwshCommand('echo $PATH'), 'echo `$PATH')
    })

    it('leaves single-quotes untouched', () => {
      assert.equal(escapeForPwshCommand("echo 'hi'"), "echo 'hi'")
    })

    it('escapes both $ and " when both are present', () => {
      assert.equal(
        escapeForPwshCommand('echo "$HOME"'),
        'echo \\"`$HOME\\"',
      )
    })
  })
})
