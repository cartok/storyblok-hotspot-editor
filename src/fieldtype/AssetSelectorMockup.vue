<template>
  <button class="uk-button uk-width-1-1" @click="setImage">
    Select asset
  </button>
</template>

<script>
const MOCKUP_IMAGES = [
  'https://via.placeholder.com/500x500',
  'https://via.placeholder.com/1000x1000',
  'https://via.placeholder.com/2000x2000',
  'https://via.placeholder.com/1000x2000',
  'https://via.placeholder.com/2000x1000',
  'https://via.placeholder.com/3000x2000',
]

export default {
  props: {
    value: String,
  },
  created () {
    this.index = 0
  },
  methods: {
    setImage () {
      const image = MOCKUP_IMAGES[this.index]
      this.$emit('input', image)
      this.index = (this.index + 1) % MOCKUP_IMAGES.length
    },
  },
}
</script>
