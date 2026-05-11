const ESCAPE_OPEN = '\x00OPEN\x00'
const ESCAPE_CLOSE = '\x00CLOSE\x00'

export function renderTemplate(template: string, vars: Record<string, string>): string {
  let result = template.replace(/\{\{/g, ESCAPE_OPEN).replace(/\}\}/g, ESCAPE_CLOSE)
  result = result.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? vars[key] : match))
  return result
    .replace(new RegExp(ESCAPE_OPEN, 'g'), '{')
    .replace(new RegExp(ESCAPE_CLOSE, 'g'), '}')
}
