<template>
  <div>
    <div :class="`tabs tabs--${size}`">
      <TabsTab
        v-for="tab in tabs"
        :id="tab.id"
        :key="tab.id"
        :title="tab.title"
        :is-active="activeTabId === tab.id"
        :size="size"
        @activate="onTabActivate(tab.id)"
      />
    </div>
    <slot :activeTabId="activeTabId" />
  </div>
</template>

<script>
import TabsTab from '@/components/TabsTab'

export const SIZE_PROP_OPTIONS = ['md', 'lg']

export default {
  name: 'Tabs',
  components: {
    TabsTab,
  },
  props: {
    tabs: {
      type: Array,
      required: true,
      default: () => [{ id: null }],
    },
    size: {
      type: String,
      validator: value => SIZE_PROP_OPTIONS.includes(value),
      default: 'md',
    },
    initialId: {
      type: String,
      default: null,
    },
  },
  data () {
    return {
      activeTabId: this.initialId !== null && this.initialId !== undefined
        ? this.tabs.find(tab => tab.id === this.initialId).id
        : this.tabs[0].id,
    }
  },
  watch: {
    activeTabId (value) {
      this.$emit('select', {
        prev: this.prevActiveTab,
        next: value,
      })
    },
  },
  methods: {
    onTabActivate (tabId) {
      this.prevActiveTab = this.activeTabId
      this.activeTabId = tabId
    },
  },
}
</script>

<style lang="scss" scoped>
.tabs {
  display: flex;
  justify-content: space-evenly;

  &--md {
    margin-bottom: 1rem;
  }

  &--lg {
    margin-bottom: 2rem;
  }
}
</style>
