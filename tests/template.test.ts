import { strict as assert } from 'assert'
import { renderTemplate } from '../src/utils/template'

describe('template', () => {
  describe('renderTemplate', () => {
    it('substitutes a simple {name} placeholder', () => {
      assert.equal(renderTemplate('hello {name}', { name: 'world' }), 'hello world')
    })

    it('treats {{ as literal { and }} as literal }', () => {
      assert.equal(renderTemplate('{{', {}), '{')
      assert.equal(renderTemplate('}}', {}), '}')
      assert.equal(renderTemplate('{{name}}', { name: 'world' }), '{name}')
    })

    it('leaves unknown placeholders unchanged so the user sees their typo', () => {
      assert.equal(
        renderTemplate('claude --resume {brnach}', { branch: 'agent/x' }),
        'claude --resume {brnach}',
      )
    })

    it('does not re-substitute when a value itself contains { ... }', () => {
      assert.equal(
        renderTemplate('cmd {arg}', { arg: '{name}' }),
        'cmd {name}',
      )
    })

    it('passes through special characters in values (spaces, quotes, backslashes, non-ASCII)', () => {
      const vars = {
        a: 'agent/feature with spaces',
        b: 'agent/quote"name',
        c: 'C:\\dev\\path',
        d: 'naïve résumé',
      }
      assert.equal(
        renderTemplate('{a} | {b} | {c} | {d}', vars),
        'agent/feature with spaces | agent/quote"name | C:\\dev\\path | naïve résumé',
      )
    })

    it('renders multiple placeholders and mixes literal escapes', () => {
      assert.equal(
        renderTemplate('claude --branch {branch} --tag {{v0.1}}', { branch: 'agent/x' }),
        'claude --branch agent/x --tag {v0.1}',
      )
    })
  })
})
