// Stub .scss requires during mocha runs. ts-node compiles src/ TypeScript but
// can't resolve .scss imports at runtime; webpack handles them in the real
// build via sass-loader + css-loader + style-loader.
require.extensions['.scss'] = function () {}
