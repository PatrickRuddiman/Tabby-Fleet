/**
 * UTF-16LE base64 encoding for `pwsh -EncodedCommand <base64>`.
 * Round-trips exactly: `Buffer.from(encodeForPwsh(s), 'base64').toString('utf16le') === s`.
 */
export function encodeForPwsh(command: string): string {
  return Buffer.from(command, 'utf16le').toString('base64')
}

/**
 * Escape literal `"` and `$` for inclusion inside a `pwsh -Command "& { <rendered> }"`
 * wrapper. PowerShell's backtick is its escape character, so `"` becomes `\"` (escaped
 * for the surrounding shell quote) and `$` becomes `` `$ `` (escaped to prevent
 * PowerShell variable expansion).
 */
export function escapeForPwshCommand(command: string): string {
  return command.replace(/\$/g, '`$').replace(/"/g, '\\"')
}
