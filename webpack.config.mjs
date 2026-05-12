import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import wp from 'webpack'
import { AngularWebpackPlugin } from '@ngtools/webpack'
import { createEs2015LinkerPlugin } from '@angular/compiler-cli/linker/babel'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const linkerPlugin = createEs2015LinkerPlugin({
  linkerJitMode: true,
  fileSystem: {
    resolve: path.resolve,
    exists: fs.existsSync,
    dirname: path.dirname,
    relative: path.relative,
    readFile: fs.readFileSync,
  },
})

const isDev = !!process.env.TABBY_DEV

export default {
  target: 'node',
  entry: 'src/index.ts',
  context: __dirname,
  devtool: false,
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js',
    pathinfo: true,
    libraryTarget: 'umd',
    publicPath: 'auto',
  },
  mode: isDev ? 'development' : 'production',
  optimization: {
    minimize: false,
  },
  resolve: {
    modules: ['.', 'src', 'node_modules'].map(x => path.join(__dirname, x)),
    extensions: ['.ts', '.js'],
    mainFields: ['esm2015', 'browser', 'module', 'main'],
  },
  ignoreWarnings: [/Failed to parse source map/],
  module: {
    rules: [
      {
        test: /\.js$/,
        enforce: 'pre',
        use: {
          loader: 'source-map-loader',
          options: {
            filterSourceMappingUrl: (url, resourcePath) => {
              if (/node_modules/.test(resourcePath) && !resourcePath.includes('xterm')) {
                return false
              }
              return true
            },
          },
        },
      },
      {
        test: /\.(m?)js$/,
        loader: 'babel-loader',
        options: {
          plugins: [linkerPlugin],
          compact: false,
          cacheDirectory: true,
        },
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.ts$/,
        use: [{ loader: '@ngtools/webpack' }],
      },
      { test: /\.scss$/, use: ['@tabby-gang/to-string-loader', 'css-loader', 'sass-loader'], include: /(theme.*|component)\.scss/ },
      { test: /\.scss$/, use: ['style-loader', 'css-loader', 'sass-loader'], exclude: /(theme.*|component)\.scss/ },
    ],
  },
  externals: [
    'child_process',
    'electron',
    'fs',
    'net',
    'ngx-toastr',
    'os',
    'path',
    'readline',
    'stream',
    'util',
    /^@angular(?!\/common\/locales)/,
    /^@ng-bootstrap/,
    /^rxjs/,
    /^tabby-/,
  ],
  plugins: [
    new wp.SourceMapDevToolPlugin({
      exclude: [/node_modules/],
      filename: '[file].map',
      moduleFilenameTemplate: 'webpack-tabby-fleet:///[resource-path]',
    }),
    new AngularWebpackPlugin({
      tsconfig: path.resolve(__dirname, 'tsconfig.json'),
      directTemplateLoading: false,
      jitMode: true,
    }),
  ],
}
