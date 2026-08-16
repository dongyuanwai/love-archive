<script setup lang="ts">
withDefaults(defineProps<{
  text?: string
  compact?: boolean
}>(), {
  text: '正在加载…',
  compact: false,
})
</script>

<template>
  <view class="loading-indicator" :class="{ 'loading-indicator--compact': compact }" role="status">
    <view class="loading-indicator__spinner" />
    <text>{{ text }}</text>
  </view>
</template>

<style scoped lang="scss">
.loading-indicator {
  display: flex;
  min-height: 142rpx;
  gap: 16rpx;
  align-items: center;
  justify-content: center;
  color: #8b7c78;
  font-size: 22rpx;
}

.loading-indicator--compact {
  min-height: 48rpx;
  gap: 10rpx;
  justify-content: flex-start;
  font-size: 20rpx;
}

.loading-indicator__spinner {
  width: 30rpx;
  height: 30rpx;
  flex: none;
  border: 4rpx solid #f0ddd4;
  border-top-color: #d87263;
  border-radius: 50%;
  animation: loading-rotate .75s linear infinite;
}

.loading-indicator--compact .loading-indicator__spinner {
  width: 24rpx;
  height: 24rpx;
  border-width: 3rpx;
}

@keyframes loading-rotate {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .loading-indicator__spinner { animation-duration: 1.5s; }
}
</style>
