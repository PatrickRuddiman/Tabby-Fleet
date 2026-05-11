const path = require('path')

module.exports = {
  mode: 'production',
  entry: './src/index.ts',
  target: 'node',
  devtool: 'source-map',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js',
    library: { type: 'commonjs2' },
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: 'ts-loader',
      },
      {
        test: /\.pug$/,
        use: 'raw-loader',
      },
      {
        test: /\.scss$/,
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },
    ],
  },
  externals: [
    /^@angular\//,
    /^tabby-/,
    'rxjs',
    '@ng-bootstrap/ng-bootstrap',
  ],
}
