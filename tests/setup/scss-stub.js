// Test-runtime stubs:
// 1. Make .scss imports a no-op (webpack handles them in the real build).
// 2. Alias tabby-* and @ng-bootstrap/ng-bootstrap to local stub files so
//    ts-node + mocha can resolve them. The real packages are provided by
//    the Tabby host at plugin load time (webpack externalizes them).

const Module = require('module')
const path = require('path')

require.extensions['.scss'] = function () {}

const ALIASES = {
  'tabby-core': path.join(__dirname, '..', 'stubs', 'tabby-core.js'),
  'tabby-terminal': path.join(__dirname, '..', 'stubs', 'tabby-terminal.js'),
  'tabby-settings': path.join(__dirname, '..', 'stubs', 'tabby-settings.js'),
  '@ng-bootstrap/ng-bootstrap': path.join(__dirname, '..', 'stubs', 'ng-bootstrap.js'),
  '@angular/forms': path.join(__dirname, '..', 'stubs', 'angular-forms.js'),
}

const origResolve = Module._resolveFilename
Module._resolveFilename = function (request, ...rest) {
  if (Object.prototype.hasOwnProperty.call(ALIASES, request)) {
    return ALIASES[request]
  }
  return origResolve.call(this, request, ...rest)
}
