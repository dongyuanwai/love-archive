<script setup lang="ts">
defineProps<{ options: { label: string; value: string }[]; modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <view class="segments">
    <button v-for="option in options" :key="option.value" class="segment" :class="{ 'segment--active': option.value === modelValue }" @tap="emit('update:modelValue', option.value)">{{ option.label }}</button>
  </view>
</template>

<style scoped lang="scss">
.segments { display: flex; gap: 6rpx; padding: 6rpx; border: 1rpx solid #eee1da; border-radius: 22rpx; background: #f5ebe6; }
.segment { display: flex; height: 68rpx; flex: 1; align-items: center; justify-content: center; border-radius: 17rpx; background: transparent; color: #7f716d; font-size: 25rpx; line-height: 1; text-align: center; }
.segment--active { background: #fff; color: #955249; font-weight: 700; box-shadow: 0 4rpx 14rpx rgba(90, 65, 55, .10); }
</style>
