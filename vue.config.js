module.exports = {
  configureWebpack: {
    output: {
      filename: 'export.js',
    },
    optimization: {
      splitChunks: false,
      minimize: process.env.NODE_ENV === 'production',
    },
  },
  filenameHashing: false,
  runtimeCompiler: true,
  productionSourceMap: false,
  css: {
    extract: false,
  },
}
