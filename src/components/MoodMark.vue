<script setup lang="ts">
import type { MoodKind } from '@/types/domain'

withDefaults(defineProps<{ mood: MoodKind; size?: 'small' | 'medium' | 'large' }>(), { size: 'medium' })
</script>

<template>
  <view class="mark" :class="[`mark--${mood}`, `mark--${size}`]" :aria-label="mood === 'happy' ? '开心' : '难过'">
    <view class="mark__eyes"><view class="mark__eye" /><view class="mark__eye" /></view>
    <view class="mark__mouth" />
  </view>
</template>

<style scoped lang="scss">
.mark {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  &--small { width: 44rpx; height: 44rpx; }
  &--medium { width: 64rpx; height: 64rpx; }
  &--large { width: 112rpx; height: 112rpx; }
  &--happy { background: #ffe0c8; color: #9d5f3d; }
  &--sad { background: #dbe6f2; color: #5f7894; }
}
.mark__eyes { display: flex; width: 46%; justify-content: space-between; }
.mark__eye { width: 6rpx; height: 7rpx; border-radius: 50%; background: currentColor; }
.mark__mouth { width: 35%; height: 16%; margin-top: 10%; border: 3rpx solid currentColor; border-top: 0; border-radius: 0 0 30rpx 30rpx; }
.mark--sad .mark__mouth { border-top: 3rpx solid currentColor; border-bottom: 0; border-radius: 30rpx 30rpx 0 0; }
.mark--small .mark__mouth { border-width: 2rpx; }
</style>
