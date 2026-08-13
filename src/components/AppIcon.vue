<script setup lang="ts">
import { computed } from 'vue'

export type AppIconName = 'heart' | 'hug' | 'comment' | 'lock' | 'chevron' | 'calendar' | 'trend' | 'link' | 'plus' | 'more' | 'shield' | 'feedback' | 'document'

const props = withDefaults(defineProps<{
  name: AppIconName
  size?: number
  color?: string
  filled?: boolean
}>(), {
  size: 20,
  color: 'currentColor',
  filled: false,
})

const types: Record<AppIconName, string> = {
  heart: 'heart',
  hug: 'staff',
  comment: 'chatbubble',
  lock: 'locked',
  chevron: 'right',
  calendar: 'calendar',
  trend: 'arrowup',
  link: 'link',
  plus: 'plusempty',
  more: 'more-filled',
  shield: 'auth',
  feedback: 'paperplane',
  document: 'list',
}

const type = computed(() => props.name === 'heart' && props.filled ? 'heart-filled' : types[props.name])
</script>

<template>
  <uni-icons class="app-icon" :type="type" :size="size" :color="color" aria-hidden="true" />
</template>

<style scoped>
.app-icon { display: inline-flex; flex: none; line-height: 1; }
</style>
