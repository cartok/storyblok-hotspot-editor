<template>
  <div v-if="!editorOpen" class="lw-hotspot-image">
    <button class="uk-button uk-width-1-1 g-no-select" @click.prevent="open">
      Open Hotspot Editor
    </button>
  </div>

  <div v-else class="lw-hotspot-image" @click.right.prevent>
    <i class="lw-hotspot-image__close-button g-no-select uk-icon-close" @click.prevent="close" />
    <Tabs
      :tabs="[
        { id: 'desktop', title: 'Desktop' },
        { id: 'mobile', title: 'Mobile' },
      ]"
      size="lg"
      :initial-id="draftModel.activeTab"
      @select="onTabChange"
    >
      <!-- TODO: simplify @copy, @paste, @delete signatures, only use 'tab' word, don't mix 'editor' and 'tab' -->
      <template #default="{ activeTabId }">
        <Editor
          v-if="activeTabId === 'desktop'"
          id="desktop"
          key="desktop"
          v-model="draftModel.desktop.hotspots"
          :src="model.desktop_src"
          :clipboard="clipboard"
          :shared-hotspot-ids="draftModel.sharedHotspotIds"
          :get-free-id="getFreeId"
          @copy="hotspots => setClipboard({ editor: 'desktop', hotspots })"
          @paste="hotspots => addSharedHotspotIds({ editor: 'desktop', hotspots })"
          @delete="ids => deleteSharedHotspotIds({ editor: 'desktop', ids })"
        >
          <AssetSelectorMockup v-if="isDev" v-model="model.desktop_src" />
          <sb-asset-selector v-else :uid="uid" field="desktop_src" />
        </Editor>
        <Editor
          v-if="activeTabId === 'mobile'"
          id="mobile"
          key="mobile"
          v-model="draftModel.mobile.hotspots"
          :src="model.mobile_src"
          :clipboard="clipboard"
          :shared-hotspot-ids="draftModel.sharedHotspotIds"
          :get-free-id="getFreeId"
          @copy="hotspots => setClipboard({ editor: 'mobile', hotspots })"
          @paste="hotspots => addSharedHotspotIds({ editor: 'mobile', hotspots })"
          @delete="ids => deleteSharedHotspotIds({ editor: 'mobile', ids })"
        >
          <AssetSelectorMockup v-if="isDev" v-model="model.mobile_src" />
          <sb-asset-selector v-else :uid="uid" field="mobile_src" />
        </Editor>
      </template>
    </Tabs>

    <div id="status-bar" class="lw-hotspot-image__status-bar g-no-select uk-text-small">
      <div class="lw-hotspot-image__commands">
        <span><span class="uk-text-bold uk-margin-small-right">Select Mode:</span>CTRL</span>
        <span><span class="uk-text-bold uk-margin-small-right">Select All:</span>CTRL + A</span>
        <span><span class="uk-text-bold uk-margin-small-right">Delete:</span>DEL</span>
        <span><span class="uk-text-bold uk-margin-small-right">Clear Selection:</span>ESC</span>
        <span><span class="uk-text-bold uk-margin-small-right">Copy:</span>CTRL + C</span>
        <span><span class="uk-text-bold uk-margin-small-right">Paste:</span>CTRL + V</span>
      </div>
      <button class="lw-hotspot-image__ok-button uk-button" @click="save">
        Save
      </button>
    </div>
  </div>
</template>

<script>
import '@/css/index.scss'
import BuildMode from '@/mixins/BuildMode'
import Tabs from '@/components/Tabs'

import AssetSelectorMockup from '@/fieldtype/AssetSelectorMockup'
import Editor from '@/fieldtype/Editor'

function getUpdatedHotspots ({ updates, target }) {
  return target.reduce((acc, cur) => {
    const update = updates.find(hotspot => hotspot.sharedId === cur.sharedId)

    if (update) {
      cur.sku = update.sku
      cur.fallbackURL = update.fallbackURL
    }

    return [...acc, cur]
  }, [])
}

function getDifferingHotspots ({ source, target }) {
  return source
    .filter(hotspot => hotspot.sharedId)
    .filter(a => target.find(b => a.sku !== b.sku || a.fallbackURL !== b.fallbackURL))
}

export default {
  name: 'HotspotEditor',
  components: {
    Tabs,
    Editor,
    AssetSelectorMockup,
  },
  mixins: [
    window.Storyblok.plugin,
    BuildMode,
  ],
  data () {
    return {
      editorOpen: false,
      clipboard: null,
      draftModel: {}, // needs to be initialized when model is available
    }
  },
  watch: {
    'model.desktop_src' (value) {
      this.draftModel.desktop_src = value
      this.draftModel.desktop.src = value
    },
    'model.mobile_src' (value) {
      this.draftModel.mobile_src = value
      this.draftModel.mobile.src = value
    },
  },
  methods: {
    setClipboard ({ editor, hotspots }) {
      this.clipboard = { editor, hotspots }
    },
    addSharedHotspotIds ({ editor, hotspots }) {
      const inactiveTab = this.getInactiveTab(editor)

      // update the shared ids
      this.draftModel.sharedHotspotIds = hotspots.reduce((ids, hotspot) => {
        const { id, creatorId, sharedId } = hotspot
        const clipboardHotspot = this.clipboard.hotspots.find(hotspot => hotspot.id === creatorId)

        ids[sharedId] = {
          [inactiveTab]: clipboardHotspot.id,
          [editor]: id,
        }

        return ids
      }, Object.assign({}, this.draftModel.sharedHotspotIds))

      // update the data of the unmounted editor
      // add shared ids to existing hotspots
      this.draftModel[inactiveTab].hotspots = this.draftModel[inactiveTab].hotspots.map(hotspot => {
        const sharedId = Object.keys(this.draftModel.sharedHotspotIds).find(sharedId => this.draftModel.sharedHotspotIds[sharedId][inactiveTab] === hotspot.id)
        if (sharedId) {
          hotspot.sharedId = sharedId
        }
        return hotspot
      })
    },
    deleteSharedHotspotIds ({ editor, ids }) {
      const inactiveTab = this.getInactiveTab(editor)

      // delete ids
      this.draftModel.sharedHotspotIds = Object.keys(this.draftModel.sharedHotspotIds).reduce((updatedIds, id) => (
        ids.includes(id) ? updatedIds : { ...updatedIds, id }
      ), {})

      // update the data of the unmounted editor
      // remove hotspots that are no longer shared
      this.draftModel[inactiveTab].hotspots = this.draftModel[inactiveTab].hotspots.reduce((hotspots, hotspot) => (
        ids.includes(hotspot.sharedId) ? hotspots : [...hotspots, hotspot]
      ), [])
    },
    getInactiveTab (activeEditor) {
      // TODO: won't need to make this scale to more than 2 tabs I thinks, so simplify it.
      const tabs = ['desktop', 'mobile']
      const inactiveTab = tabs.find(item => item !== activeEditor)
      return inactiveTab
    },
    getFreeId () {
      const sharedIds = Object.keys(this.draftModel.sharedHotspotIds)
      let i = 1
      while (true) {
        const testId = String(i)
        i++
        if (sharedIds.includes(testId)) continue
        return testId
      }
    },
    initWith () {
      return {
        plugin: 'hotspot-editor',
        // Could not go with a object structure for the images,
        // because the sb-asset-selector could not access nested keys.
        // Problem is only reproducable on production builds with the real asset manager!
        desktop_src: '',
        mobile_src: '',
        desktop: {
          src: '',
          hotspots: [],
        },
        mobile: {
          src: '',
          hotspots: [],
        },
        activeTab: 'desktop',
        sharedHotspotIds: {},
      }
    },
    pluginCreated () {
      this.initDraftModel()
    },
    initDraftModel () {
      // Somehow 'model' got bound to 'draftModel', JSON trick is a workaround.
      // Object.assing to create a new reference did not help.
      const modelCopy = JSON.parse(JSON.stringify(this.model))
      this.draftModel = Object.assign({
        desktop_src: '',
        mobile_src: '',
        desktop: {
          src: '',
          hotspots: [],
        },
        mobile: {
          src: '',
          hotspots: [],
        },
        activeTab: 'desktop',
        sharedHotspotIds: {},
      }, modelCopy)
    },
    open () {
      this.editorOpen = true
      this.initDraftModel()
      this.$emit('toggle-modal', true)
    },
    close () {
      this.editorOpen = false
      this.$emit('toggle-modal', false)
    },
    save () {
      this.$emit('changed-model', this.draftModel)
    },
    onTabChange ({ prev, next }) {
      this.draftModel.activeTab = next

      const updates = getDifferingHotspots({
        source: this.draftModel[prev].hotspots,
        target: this.draftModel[next].hotspots,
      })

      if (!updates.length) {
        return
      }

      this.draftModel[next].hotspots = getUpdatedHotspots({
        updates,
        target: this.draftModel[next].hotspots,
      })
    },
  },
}
</script>

<style lang="scss">
.lw-hotspot-image {
  &__close-button {
    position: absolute;
    right: 0;
    font-size: 1.5rem;
    cursor: pointer;
  }

  &__status-bar {
    display: flex;
    justify-content: space-between;
    white-space: nowrap;
    overflow: hidden;
  }

  &__commands {
    color: #545B6F;
    display: inline-grid;
    grid-auto-flow: column;
    align-content: flex-end;
    gap: 1rem;
  }

  &__ok-button {
    padding-left: 3rem;
    padding-right: 3rem;
    margin-left: 2rem;
  }
}
</style>
