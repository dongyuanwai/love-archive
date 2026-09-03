<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import { clearTogetherDay, updateTogetherDay } from '@/api/relationships'
import { useArchiveStore } from '@/stores/archive'
import { todayString } from '@/utils/date'
import {
  formatTogetherDayDate,
  getTogetherDayDuration,
} from '@/utils/together-day'

const store = useArchiveStore()
const date = ref(todayString())
const hasSavedDate = ref(false)
const saving = ref(false)
const duration = computed(() => getTogetherDayDuration(date.value))

onLoad(() => {
  if (!store.user.isLoggedIn || !store.activeRelationship) {
    uni.showToast({ title: '请先绑定对象', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 350)
    return
  }
  if (store.activeRelationship.togetherSince) {
    date.value = store.activeRelationship.togetherSince
    hasSavedDate.value = true
  }
})

const onDateChange = (event: { detail: { value: string } }) => {
  date.value = event.detail.value
}

const save = async () => {
  if (saving.value || !store.activeRelationship) return
  saving.value = true
  try {
    const result = await updateTogetherDay(date.value)
    store.setTogetherSince(result.date)
    hasSavedDate.value = true
    uni.showToast({ title: '在一起的日子已保存', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 400)
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '保存失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}

const clear = () => {
  if (!store.activeRelationship) return
  uni.showModal({
    title: '清除这个日期？',
    content: '清除后首页将不再显示在一起的时长，之后仍可以重新设置。',
    confirmText: '确认清除',
    confirmColor: '#bd5a50',
    success: async (result) => {
      if (!result.confirm || !store.activeRelationship) return
      saving.value = true
      try {
        await clearTogetherDay()
        store.setTogetherSince()
        uni.showToast({ title: '已清除', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 350)
      } catch (error) {
        uni.showToast({ title: error instanceof Error ? error.message : '清除失败', icon: 'none' })
      } finally {
        saving.value = false
      }
    },
  })
}
</script>

<template>
  <view class="page-shell together-edit-page">
    <view class="edit-head">
      <text class="eyebrow">OUR STORY BEGINS</text>
      <text class="edit-head__title">我们从哪一天开始相爱？</text>
      <text class="edit-head__desc">记下这一天，以后每一次打开爱恋存档，都能看见你们一起走过的时间。</text>
    </view>

    <view class="duration-card card" aria-label="在一起时长预览">
      <view class="duration-card__heart"><AppIcon name="heart" :size="28" filled /></view>
      <text class="duration-card__label">我们已经在一起</text>
      <view v-if="duration" class="duration-card__value">
        <text>{{ duration.years }}</text><text class="duration-card__unit">年</text>
        <text>{{ duration.months }}</text><text class="duration-card__unit">月</text>
        <text>{{ duration.days }}</text><text class="duration-card__unit">天</text>
      </view>
      <text v-if="duration" class="duration-card__total">今天是彼此相伴的第 {{ duration.totalDays }} 天</text>
    </view>

    <view class="date-setting card">
      <view class="date-setting__copy">
        <text class="date-setting__label">在一起的日子</text>
        <text class="date-setting__hint">仅支持公历，日期不能晚于今天</text>
      </view>
      <picker mode="date" :value="date" :end="todayString()" @change="onDateChange">
        <view class="date-picker" role="button" aria-label="选择在一起的日期">
          <AppIcon name="calendar" :size="18" />
          <text>{{ formatTogetherDayDate(date) }}</text>
          <AppIcon name="chevron" :size="15" color="#9b8781" />
        </view>
      </picker>
      <view class="shared-tip">
        <AppIcon name="heart" :size="15" />
        <text>这个日期会由你和 TA 共同看到。</text>
      </view>
    </view>

    <button class="save-button" :loading="saving" :disabled="saving" @tap="save">
      {{ hasSavedDate ? '保存修改' : '保存这一天' }}
    </button>
    <button v-if="hasSavedDate" class="clear-button" @tap="clear">清除这个日期</button>
  </view>
</template>

<style scoped lang="scss">
.together-edit-page { padding-top: 27rpx; padding-bottom: calc(48rpx + env(safe-area-inset-bottom)); }
.edit-head { padding: 12rpx 3rpx 34rpx; }
.edit-head__title,.edit-head__desc { display: block; }
.edit-head__title { max-width: 620rpx; margin-top: 16rpx; color: #403432; font-size: 43rpx; font-weight: 760; line-height: 1.35; }
.edit-head__desc { max-width: 620rpx; margin-top: 13rpx; color: #7f706c; font-size: 23rpx; line-height: 1.7; }
.duration-card { position: relative; overflow: hidden; padding: 34rpx 28rpx 32rpx; border-color: #edcec7; background: linear-gradient(145deg,#fffdfa,#ffede8); text-align: center; }
.duration-card::after { position: absolute; width: 210rpx; height: 210rpx; right: -92rpx; bottom: -120rpx; border-radius: 50%; background: rgba(238,157,137,.13); content: ''; }
.duration-card__heart { position: relative; z-index: 1; display: flex; width: 72rpx; height: 72rpx; margin: 0 auto; align-items: center; justify-content: center; border-radius: 25rpx; background: #ffe0d7; color: #ae554b; }
.duration-card__label,.duration-card__total { position: relative; z-index: 1; display: block; }
.duration-card__label { margin-top: 18rpx; color: #826c67; font-size: 22rpx; }
.duration-card__value { position: relative; z-index: 1; display: flex; min-height: 76rpx; gap: 6rpx; margin-top: 5rpx; align-items: baseline; justify-content: center; color: #a84f45; font-size: 47rpx; font-weight: 800; line-height: 1.35; white-space: nowrap; }
.duration-card__unit { margin-right: 4rpx; color: #725f5a; font-size: 22rpx; font-weight: 650; }
.duration-card__total { margin-top: 4rpx; color: #766661; font-size: 22rpx; }
.date-setting { margin-top: 24rpx; padding: 28rpx; }
.date-setting__label,.date-setting__hint { display: block; }
.date-setting__label { color: #4d3f3c; font-size: 27rpx; font-weight: 750; }
.date-setting__hint { margin-top: 6rpx; color: #968580; font-size: 20rpx; }
.date-picker { display: flex; min-height: 82rpx; gap: 10rpx; margin-top: 21rpx; padding: 0 20rpx; align-items: center; justify-content: space-between; border: 1rpx solid #ead8d1; border-radius: 22rpx; background: #fff8f5; color: #6d504a; font-size: 24rpx; font-weight: 700; }
.shared-tip { display: flex; min-height: 66rpx; gap: 9rpx; margin-top: 20rpx; padding: 13rpx 16rpx; align-items: center; border-radius: 19rpx; background: #fff0eb; color: #91675f; font-size: 20rpx; line-height: 1.45; }
.save-button { display: flex; width: 100%; min-height: 92rpx; margin-top: 28rpx; align-items: center; justify-content: center; border-radius: 28rpx; background: linear-gradient(135deg,#d87868,#c9695b); color: #fff; font-size: 28rpx; font-weight: 700; line-height: 1; box-shadow: 0 14rpx 28rpx rgba(197,95,83,.2); }
.save-button[disabled] { background: #e6d7d2; color: #a79893; box-shadow: none; }
.clear-button { min-height: 72rpx; margin: 14rpx auto 0; background: transparent; color: #ae655b; font-size: 22rpx; line-height: 72rpx; }
</style>
