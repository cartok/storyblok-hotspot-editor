<template>
  <div class="editor">
    <div class="editor__header">
      <!-- TODO: fix BEM -->
      <div class="editor__header__topbar">
        <div class="g-no-select">
          <!-- A slot for the asset selector -->
          <slot />
        </div>
        <div class="stretched-input">
          <label :for="`${id}-sku`" class="g-no-select">
            SKU:
          </label>
          <input
            :id="`${id}-sku`"
            type="text"
            :disabled="!selectedHotspot || hasMultipleSelectedHotspots"
            :value="selectedHotspot && selectedHotspot.sku"
            @input="event => setInputValue(event, 'sku')"
            @keydown.esc="event => event.target.blur()"
          >
        </div>
        <div class="stretched-input">
          <label :for="`${id}-fallback`" class="g-no-select">
            Fallback URL:
          </label>
          <input
            :id="`${id}-fallback`"
            type="text"
            :disabled="!selectedHotspot || hasMultipleSelectedHotspots"
            :value="selectedHotspot && selectedHotspot.fallbackURL"
            @input="$event => setInputValue($event, 'fallbackURL')"
            @keydown.esc="event => event.target.blur()"
          >
        </div>
        <button
          class="uk-button g-no-select"
          :disabled="!selectedHotspot"
          @click="deleteSelectedHotspots"
        >
          Delete Hotspot
        </button>
      </div>
    </div>

    <div
      v-if="src"
      ref="editorBody"
      class="editor__body"
      @mouseup.right.prevent
    >
      <div class="editor__body__content">
        <img
          ref="image"
          :src="src"
          class="editor__body__image"
          :width="imageWidth"
          :height="imageHeight"
          @dragstart.prevent
          @load="resizeImage"
          @mousedown.left="mouseAddHotspot"
        >
        <svg
          ref="hotspotContainer"
          class="editor__body__hotspots"
          xmlns="http://www.w3.org/2000/svg"
          :width="imageWidth"
          :height="imageHeight"
          :viewBox="`0 0 ${imageWidth} ${imageHeight}`"
        >
          <g
            v-for="hotspot in hotspots"
            :key="hotspot.id"
            ref="hotspots"
            :transform="`translate(${Math.round(imageWidth * hotspot.position.x)}, ${Math.round(imageHeight * hotspot.position.y)})`"
          >
            <circle :r="hotspotOuterRadius" class="editor__body__hotspots__hotspot__outer-circle" />
            <g
              :data-id="hotspot.id"
              class="editor__body__hotspots__hotspot"
              :class="{
                'editor__body__hotspots__hotspot--selected': hotspot.selected,
                'editor__body__hotspots__hotspot--hover': !hotspot.selected && !moveEvent,
              }"
              @mousedown.left="mouseSelectAndMoveHotspot"
            >
              <circle
                :r="hotspotInnerRadius"
                :stroke-width="hotspotInnerStrokeWidth"
                class="editor__body__hotspots__hotspot__circle"
              />

              <svg
                v-if="hotspot.sharedId"
                :width="hotspotInnerWidth"
                :height="hotspotInnerWidth"
                :x="-hotspotInnerWidth/2"
                :y="-hotspotInnerWidth/2"
              >
                <text
                  x="50%"
                  y="50%"
                  dominant-baseline="middle"
                  text-anchor="middle"
                >
                  {{ hotspot.sharedId }}
                </text>
              </svg>

              <template v-else>
                <line
                  :x1="-hotspotLineLength / 2"
                  y1="0"
                  :x2="hotspotLineLength / 2"
                  y2="0"
                  :stroke-width="hotspotCrossStrokeWidth"
                  stroke
                  class="editor__body__hotspots__hotspot__line"
                />
                <line
                  x1="0"
                  :y1="-hotspotLineLength / 2"
                  x2="0"
                  :y2="hotspotLineLength / 2"
                  :stroke-width="hotspotCrossStrokeWidth"
                  class="editor__body__hotspots__hotspot__line"
                />
              </template>
            </g>
          </g>
        </svg>
      </div>
    </div>

    <div v-else class="editor__instructions g-no-select">
      <div class="editor__instructions__box">
        <p>Click on 'Select asset' to select an image to work with.</p>
      </div>
    </div>
  </div>
</template>

<script>
import { throttle, debounce } from 'throttle-debounce'
import { omit } from 'lodash-es'

import HotspotModel from '@/fieldtype/HotspotModel'
import { getMousePosition } from '@/fieldtype/mouse'
import { isKeyHit, isShortcutHit, isModifierHit } from '@/fieldtype/keyboard'

// TODO: could detect refresh rate to also optimize for 144hz or 240hz (try out 'refresh-rate' package)
const FPS = 60
const INPUT_THROTTLE_MS = 1000 / (FPS + (FPS / 3))

const MOVE_EVENT_STYLESHEET = (() => {
  const sheet = document.createElement('style')
  sheet.innerHTML = `
    * {
      cursor: grabbing !important;
    }
    :not(.editor__body__content) > * {
      pointer-events: none;
    }
  `
  sheet.id = 'MOVE_EVENT_STYLESHEET'
  return sheet
})()

const SELECT_MODE_STYLESHEET = (() => {
  const sheet = document.createElement('style')
  sheet.innerHTML = `
    * {
      cursor: pointer !important;
    }
    :not(.editor__body__hotspots__hotspot) > * {
      pointer-events: none;
    }
  `
  sheet.id = 'SELECT_MODE_STYLESHEET'
  return sheet
})()

/**
 * The editor takes an image src to work with and creates or modifies hotspots.
 */
export default {
  name: 'Editor',
  props: {
    value: {
      type: Array,
      default: () => [],
    },
    src: String,
    id: String,
    clipboard: Object,
    sharedHotspotIds: Object,
    getFreeId: Function,
  },
  data () {
    return {
      hotspots: this.value,
      imageWidth: 0,
      imageHeight: 0,
      moveEvent: false,
      selectMode: false,
      selectedHotspot: null,
      activeElement: null,
      resized: false,
    }
  },
  computed: {
    hasMultipleSelectedHotspots () {
      return this.hotspots.filter(hotspot => hotspot.selected).length > 1
    },
    paneHasFocus () {
      if (!this.activeElement) {
        return Boolean(this.hotspots.length)
      }
      return (this.$refs.editorBody && this.$refs.editorBody.contains(this.activeElement))
        || this.activeElement === document.body
        || this.activeElement.tagName === 'BUTTON'
    },
    allowEditorActions () {
      return Boolean(this.paneHasFocus && this.src)
    },
  },
  watch: {
    async src (value) {
      // Regain focus after leaving the sb-asset-selector
      // Problem is that this watcher will not trigger when the user selected the same image
      window.focus()

      // Reset width and height on image change to not load the full size image
      // before the calculation of best fitting proportions in this.resizeImage()
      if (value) {
        this.imageWidth = 0
        this.imageHeight = 0
        await this.$nextTick()
        this.resizeImage()
      }
    },
    allowEditorActions: {
      immediate: true,
      handler (value) {
        if (value) {
          this.bindKeyEvents()
        } else {
          this.unbindKeyEvents()
        }
      },
    },
    selectMode (value) {
      if (value) {
        document.body.appendChild(SELECT_MODE_STYLESHEET)
      } else {
        document.getElementById('SELECT_MODE_STYLESHEET').remove()
      }
    },
    async sharedHotspotIds () {
      await this.$nextTick()
      this.updateNodeReferences()
    },
    hotspots: {
      deep: true,
      handler: debounce(200, function (value) {
        const hotspots = value.map(hotspot => omit(hotspot, ['node', 'selected']))
        this.$emit('input', hotspots)
      }),
    },
  },
  created () {
    this.hotspotInnerRadius = 20
    this.hotspotInnerStrokeWidth = 0.2 * this.hotspotInnerRadius
    this.hotspotInnerWidth = (this.hotspotInnerRadius + this.hotspotInnerStrokeWidth) * 2
    this.hotspotOuterRadius = 1.75 * this.hotspotInnerRadius
    this.hotspotCrossStrokeWidth = this.hotspotInnerStrokeWidth / 2
    this.hotspotLineLength = 0.8 * this.hotspotInnerRadius
  },
  mounted () {
    this.resize()
    window.addEventListener('resize', this.resize, false)

    this.activeElement = document.activeElement
    window.addEventListener('focus', this.updateActiveElement, true)
    window.addEventListener('blur', this.updateActiveElement, true)

    if (this.src) {
      this.updateNodeReferences()
    }
  },
  beforeDestroy () {
    window.removeEventListener('resize', this.resize)

    window.removeEventListener('focus', this.updateActiveElement)
    window.removeEventListener('blur', this.updateActiveElement)
    this.activeElement = null

    this.unbindKeyEvents()

    window.removeEventListener('mouseup', this.mouseEndMovingHotspot)
    window.removeEventListener('mousemove', this.mouseMoveHotspot)
  },
  methods: {
    updateNodeReferences () {
      this.hotspots = this.hotspots.map(hotspot => ({
        ...hotspot,
        node: Array.from(this.$refs.hotspotContainer.querySelectorAll('g g'))
          .find(node => node.dataset.id === hotspot.id),
      }))
    },
    updateActiveElement () {
      this.activeElement = document.activeElement
    },

    resize: throttle(INPUT_THROTTLE_MS, function () {
      if (this.src) {
        this.resizeImage()
      }
    }),
    resizeImage () {
      const { editorBody, image } = this.$refs
      const editorRect = this.$el.getBoundingClientRect()
      const editorBodyRect = editorBody.getBoundingClientRect()
      const imageMaxHeight = editorBodyRect.height
      const imageMaxWidth = editorRect.width

      let imageWidth = image.naturalWidth
      let imageHeight = image.naturalHeight
      if (imageWidth > imageMaxWidth) {
        imageWidth = imageMaxWidth
        imageHeight = image.naturalHeight * imageWidth / image.naturalWidth
      }
      if (imageHeight > imageMaxHeight) {
        imageHeight = imageMaxHeight
        imageWidth = image.naturalWidth * imageHeight / image.naturalHeight
      }

      cancelAnimationFrame(this.preventDefault)
      this.prevMoveAnimationId = requestAnimationFrame(() => {
        this.imageWidth = imageWidth
        this.imageHeight = imageHeight
      })
    },

    setInputValue (event, key) {
      // mutating here, debouncing is done in the hotspots watcher
      this.selectedHotspot[key] = event.target.value
    },

    /**
     * @param {string} id - id of the hotspot
     * @param {Object} event- event to check for key modifiers
     */
    async selectHotspot (id) {
      this.hotspots = this.hotspots.reduce((hotspots, hotspot) => {
        if (hotspot.id === id) {
          hotspot.selected = this.selectMode
            ? !hotspot.selected
            : true
        } else if (!this.selectMode) {
          hotspot.selected = false
        }
        return [...hotspots, hotspot]
      }, [])

      // bring hotspot to the front
      await this.$nextTick()
      const hotspot = this.hotspots.find(hotspot => hotspot.id === id)
      this.$refs.hotspotContainer.appendChild(hotspot.node.parentElement)

      this.selectedHotspot = hotspot
    },
    deleteSelectedHotspots (event) {
      const ids = this.hotspots
        .filter(hotspot => hotspot.selected && hotspot.sharedId)
        .map(hotspot => hotspot.sharedId)

      this.hotspots = this.hotspots.reduce((hotspots, hotspot) => {
        return hotspot.selected
          ? hotspots
          : [...hotspots, hotspot]
      }, [])

      this.selectedHotspot = null

      this.$emit('delete', ids)
      event.target.blur()
    },
    selectAllHotspots () {
      this.hotspots = this.hotspots.reduce((hotspots, hotspot) => {
        hotspot.selected = true
        return [...hotspots, hotspot]
      }, [])
    },
    unselectHotspots () {
      this.hotspots = this.hotspots.reduce((hotspots, hotspot) => {
        hotspot.selected = false
        return [...hotspots, hotspot]
      }, [])
    },

    bindKeyEvents () {
      window.addEventListener('keydown', this.keyDeleteHotspots, false)
      window.addEventListener('keydown', this.keyEnterSelectMode, false)
      window.addEventListener('keyup', this.keyLeaveSelectMode, false)
      window.addEventListener('keydown', this.keySelectAllHotspots, false)
      window.addEventListener('keydown', this.keyUnselectHotspots, false)
      window.addEventListener('keydown', this.keyCopyHotspots, false)
      window.addEventListener('keydown', this.keyPasteHotspots, false)
    },
    unbindKeyEvents () {
      window.removeEventListener('keydown', this.keyDeleteHotspots)
      window.removeEventListener('keydown', this.keyEnterSelectMode)
      window.removeEventListener('keyup', this.keyLeaveSelectMode)
      window.removeEventListener('keydown', this.keySelectAllHotspots)
      window.removeEventListener('keydown', this.keyUnselectHotspots)
      window.removeEventListener('keydown', this.keyCopyHotspots)
      window.removeEventListener('keydown', this.keyPasteHotspots)
    },
    keyDeleteHotspots (event) {
      if (!isKeyHit(event, 'Delete')) {
        return
      }
      this.deleteSelectedHotspots(event)
    },
    keyEnterSelectMode (event) {
      if (!this.selectMode && isModifierHit(event, 'Control')) {
        this.selectMode = true
      }
    },
    keyLeaveSelectMode (event) {
      if (!isModifierHit(event, 'Control')) {
        this.selectMode = false
      }
    },
    keySelectAllHotspots (event) {
      if (!isShortcutHit(event, { mod: 'Control', key: 'A' })) {
        return
      }
      event.preventDefault()
      this.selectAllHotspots()
    },
    keyUnselectHotspots (event) {
      if (!isKeyHit(event, 'Escape')) {
        return
      }
      this.unselectHotspots()
    },
    keyCopyHotspots (event) {
      if (!isShortcutHit(event, { mod: 'Control', key: 'C' })) {
        return
      }
      this.$emit('copy', this.hotspots.filter(hotspot => hotspot.selected))
    },
    keyPasteHotspots (event) {
      if (!isShortcutHit(event, { mod: 'Control', key: 'V' })) {
        return
      }

      // return if there is nothing in the clipboard
      if (!this.clipboard) {
        return
      }

      // don't allow pasting into the same editor
      if (this.clipboard?.editor === this.id) {
        return
      }

      // don't allow pasting already pasted hotspots
      const unsharedHotspots = this.clipboard.hotspots
        // prevent duplication if someone put already shared hotspots to the clipboard
        .filter(hotspot => !hotspot.sharedId)
        // prevent duplication if someone tries to paste a hotspot more than once
        .filter(clipboardHotspot => !this.hotspots.find(hotspot => hotspot.creatorId && hotspot.creatorId === clipboardHotspot.id))
        // create new hotspots
        .map((hotspot, i) => {
          const sharedProps = omit(hotspot, ['id', 'node'])
          const sharedId = String(Number(this.getFreeId()) + i)
          const creatorId = hotspot.id

          return new HotspotModel({ ...sharedProps, sharedId, creatorId })
        })

      this.$emit('paste', unsharedHotspots)
      this.hotspots = [...this.hotspots, ...unsharedHotspots]
    },

    getClosestHotspotId (event) {
      const groupWithId = event.target.closest('g')
      return groupWithId && groupWithId.dataset.id
    },
    toValidHotspotPosition ({ x, y }) {
      const insetHorizontal = (this.hotspotInnerRadius + this.hotspotInnerStrokeWidth) / this.imageWidth
      const insetVertical = (this.hotspotInnerRadius + this.hotspotInnerStrokeWidth) / this.imageHeight

      x = x < 0 + insetHorizontal ? 0 + insetHorizontal : x
      x = x > 1 - insetHorizontal ? 1 - insetHorizontal : x

      y = y < 0 + insetVertical ? 0 + insetVertical : y
      y = y > 1 - insetVertical ? 1 - insetVertical : y

      return { x, y }
    },

    mouseSelectHotspot (event) {
      const id = this.getClosestHotspotId(event)
      this.selectHotspot(id, event)
    },
    mouseSelectAndMoveHotspot (event) {
      const id = this.getClosestHotspotId(event)
      this.selectHotspot(id, event)
      if (this.selectMode) return

      this.mouseStartMovingHotspot(event)
    },
    async mouseAddHotspot (event) {
      if (this.selectMode) return

      const position = this.toValidHotspotPosition(getMousePosition(event))
      const hotspot = new HotspotModel({ position })

      this.hotspots = [...this.hotspots, hotspot]

      // add node reference
      await this.$nextTick()
      hotspot.node = Array.from(this.$refs.hotspotContainer.querySelectorAll('g g'))
        .find(node => node.dataset.id === hotspot.id)

      await this.selectHotspot(hotspot.id, event)
      this.mouseStartMovingHotspot(event, hotspot.id)
    },
    mouseStartMovingHotspot (event) {
      window.addEventListener('mouseup', this.mouseEndMovingHotspot, false)
      this.prevMousePos = getMousePosition(event, this.$refs.image)

      cancelAnimationFrame(this.prevMoveStartId)
      this.prevMoveStartId = requestAnimationFrame(() => {
        this.moveEvent = true
        document.body.appendChild(MOVE_EVENT_STYLESHEET)
      })

      window.addEventListener('mousemove', this.mouseMoveHotspot, false)
    },
    mouseMoveHotspot: throttle(INPUT_THROTTLE_MS, function (event) {
      if (this.prevMousePos === null || this.selectedHotspot === null) {
        // TODO: conditional mouse event binding could be better
        return
      }

      const mousePos = getMousePosition(event, this.$refs.image)
      const mouseDistance = {
        x: mousePos.x - this.prevMousePos.x,
        y: mousePos.y - this.prevMousePos.y,
      }

      if (mouseDistance.x === 0 && mouseDistance.y === 0) {
        // edge case
        return
      }

      const position = this.toValidHotspotPosition({
        x: this.selectedHotspot.position.x + mouseDistance.x,
        y: this.selectedHotspot.position.y + mouseDistance.y,
      })

      cancelAnimationFrame(this.prevMoveAnimationId)
      this.prevMoveAnimationId = requestAnimationFrame(() => {
        this.prevMousePos = getMousePosition(event, this.$refs.image)
        this.selectedHotspot.position = position
      })
    }),
    mouseEndMovingHotspot () {
      window.removeEventListener('mouseup', this.mouseEndMovingHotspot)
      window.removeEventListener('mousemove', this.mouseMoveHotspot)
      this.prevMousePos = null

      cancelAnimationFrame(this.prevMoveEndId)
      this.prevMoveEndId = requestAnimationFrame(() => {
        this.moveEvent = false
        document.getElementById('MOVE_EVENT_STYLESHEET').remove()
      })
    },
  },
}
</script>

<style lang="scss" scoped>
// TODO: Refactor CSS
.stretched-input {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;

  label {
    margin-right: 0.5rem;
  }
}

$image-margin-top: 1.5rem;
$image-margin-bottom: 1rem;

.editor {
  height: 570px;
  overflow: hidden;
  display: grid;
  grid-template-rows: auto 1fr auto;

  &__header {
    display: grid;
    justify-content: center;

    &__topbar {
      display: grid;
      grid-template-columns: 200px 240px 450px auto;
      gap: 1.3rem;
      white-space: nowrap;
    }
  }

  &__instructions {
    display: grid;
    justify-content: center;
    margin: $image-margin-top 0 $image-margin-bottom 0;
    color: #545B6F;

    &__box {
      display: grid;
      justify-content: center;
      align-content: center;
      width: 400px;
      height: 400px;
      border: 3px solid #DFE3E8;
      background: #F7F8F9;

      p {
        padding: 2rem;
      }
    }
  }

  &__body {
    display: grid;
    justify-content: center;
    margin: $image-margin-top 0 $image-margin-bottom 0;
    user-select: none;

    &__content {
      position: relative;
      cursor: crosshair;
    }

    &__image {
      display: block;
    }

    &__hotspots {
      pointer-events: none;
      position: absolute;
      top: 0;

      &__hotspot {
        pointer-events: all;
        cursor: pointer;
        /* TODO: integrate CSS properly https://blok.ink/?path=/story/design-system-base-colors--all-colors */
        fill: #8D919F;
        stroke: white;

        &__outer-circle {
          fill: rgba(255, 255, 255, 0.4)
        }

        &__line {
          stroke: white;
        }

        &--hover:hover {
          fill: #C6C8CF;
        }

        &--selected {
          cursor: grab;
          fill: #40C6C4;
        }
      }
    }
  }
}
</style>
