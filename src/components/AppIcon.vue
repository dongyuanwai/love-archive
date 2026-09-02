<script setup lang="ts">
import { computed } from 'vue'

export type AppIconName = 'heart' | 'hug' | 'comment' | 'lock' | 'chevron' | 'calendar' | 'trend' | 'link' | 'plus' | 'more' | 'shield' | 'feedback' | 'document' | 'notification'

defineOptions({
  options: {
    virtualHost: true,
  },
})

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
  trend: 'arrow-up',
  link: 'link',
  plus: 'plusempty',
  more: 'more-filled',
  shield: 'auth',
  feedback: 'paperplane',
  document: 'list',
  notification: 'notification',
}

const type = computed(() => props.name === 'heart' && props.filled ? 'heart-filled' : types[props.name])
const iconStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
}))
</script>

<template>
  <view class="app-icon" :style="iconStyle" aria-hidden="true">
    <uni-icons class="app-icon__glyph" :type="type" :size="size" :color="color" />
  </view>
</template>

<style scoped>
.app-icon {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  vertical-align: middle;
  font-size: 0;
  line-height: 0;
}

.app-icon__glyph {
  display: flex !important;
  width: 100% !important;
  height: 100% !important;
  align-items: center;
  justify-content: center;
  line-height: 1 !important;
}
</style>
