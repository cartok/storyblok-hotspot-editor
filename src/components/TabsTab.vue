<template>
  <div
    :class="{
      [`tab tab--${size}`]: true,
      ['tab--active']: isActive,
    }"
    @click="activate"
    v-text="title"
  />
</template>

<script>
import { SIZE_PROP_OPTIONS } from '@/components/Tabs'

export default {
  name: 'TabsTab',
  props: {
    id: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    size: {
      type: String,
      validator: value => SIZE_PROP_OPTIONS.includes(value),
      default: 'md',
    },
  },
  methods: {
    activate () {
      this.$emit('activate', this.id)
    },
  },
}
</script>

<style lang="scss" scoped>
.tab {
  user-select: none;
  cursor: pointer;
  flex-grow: 1;
  display: inline-flex;
  justify-content: center;
  box-sizing: border-box;

  &--md {
    height: 54px;
    line-height: 54px;
    margin: 0px 10px;
    font-size: 14px;
  }

  &--lg {
    height: 68px;
    line-height: 68px;
    margin: 0px 20px;
    font-size: 16px;
    font-weight: bold;
  }

  &:hover,
  &--active {
    border-bottom: 5px solid #09b3af;
  }
}
</style>
