export const buildMode = process.env.NODE_ENV
export const isDev = buildMode === 'development'

export default {
  created () {
    this.buildMode = buildMode
    this.isDev = isDev
    this.isProd = !isDev
  },
}
