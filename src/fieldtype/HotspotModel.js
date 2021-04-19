import { nanoid } from 'nanoid'

export default class HotspotModel {
  constructor ({ position, sku, fallbackURL, id, creatorId, sharedId }) {
    if (!position || isNaN(position.x) || isNaN(position.y)) {
      throw new Error('Hotspot requires at least a \'position\' with \'x\' and \'y\' coordinates')
    }

    this.position = position
    this.sku = sku || null
    this.fallbackURL = fallbackURL || null
    this.id = id || nanoid()
    this.creatorId = creatorId
    this.sharedId = sharedId || null

    this.selected = false
    this.node = null
  }
}
