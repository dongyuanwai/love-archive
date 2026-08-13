<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import MoodMark from '@/components/MoodMark.vue'
import { useArchiveStore } from '@/stores/archive'
import type { MoodKind, Visibility } from '@/types/domain'
import { todayString } from '@/utils/date'

const store = useArchiveStore()
const mood = ref<MoodKind>('happy')
const emotion = ref('愉快')
const content = ref('')
const recordDate = ref(todayString())
const visibility = ref<Visibility>('partner')
const allowComments = ref(true)
const redirectingToLogin = ref(false)
const loginPrompted = ref(false)

const emotionOptions: Record<MoodKind, string[]> = {
  happy: ['愉快', '安心', '期待', '感动', '兴奋', '被爱'],
  sad: ['失落', '委屈', '焦虑', '生气', '孤独', '疲惫'],
}

const characterCount = computed(() => content.value.length)
const canPublish = computed(() => content.value.trim().length > 0 && characterCount.value <= 1000)

onShow(() => {
  if (!store.user.isLoggedIn) {
    if (loginPrompted.value) {
      loginPrompted.value = false
      uni.switchTab({ url: '/pages/archive/index' })
      return
    }
    if (redirectingToLogin.value) return
    redirectingToLogin.value = true
    loginPrompted.value = true
    uni.navigateTo({
      url: '/pages/login/index?target=create',
      complete: () => { redirectingToLogin.value = false },
    })
    return
  }
  loginPrompted.value = false
  if (!store.activeRelationship) visibility.value = 'private'
})

const chooseMood = (value: MoodKind) => {
  mood.value = value
  emotion.value = emotionOptions[value][0] ?? ''
}

const chooseDate = (event: { detail: { value: string } }) => { recordDate.value = event.detail.value }
const toggleComments = (event: unknown) => {
  allowComments.value = (event as { detail: { value: boolean } }).detail.value
}

const publish = () => {
  if (!store.user.isLoggedIn) {
    uni.navigateTo({ url: '/pages/login/index?target=create' })
    return
  }
  if (!canPublish.value) {
    uni.showToast({ title: '写下一点此刻的心情吧', icon: 'none' })
    return
  }
  store.addRecord({
    mood: mood.value,
    emotion: emotion.value,
    content: content.value.trim(),
    recordDate: recordDate.value,
    visibility: visibility.value,
    allowComments: visibility.value === 'partner' && allowComments.value,
  })
  content.value = ''
  recordDate.value = todayString()
  uni.showToast({ title: '这一刻已被收藏', icon: 'success' })
  setTimeout(() => uni.switchTab({ url: '/pages/archive/index' }), 650)
}
</script>

<template>
  <view class="page-shell create-page">
    <view class="create-head">
      <text class="eyebrow">A MOMENT FOR YOU</text>
      <text class="create-head__title">此刻，你感觉怎么样？</text>
      <text class="create-head__desc">没有标准答案，诚实地陪陪自己就好。</text>
    </view>

    <view class="mood-switch">
      <button class="mood-choice mood-choice--happy" :class="{ 'mood-choice--active': mood === 'happy' }" @tap="chooseMood('happy')">
        <MoodMark mood="happy" size="large" />
        <text class="mood-choice__title">开心</text>
        <text class="mood-choice__desc">收藏今天的光</text>
      </button>
      <button class="mood-choice mood-choice--sad" :class="{ 'mood-choice--active': mood === 'sad' }" @tap="chooseMood('sad')">
        <MoodMark mood="sad" size="large" />
        <text class="mood-choice__title">难过</text>
        <text class="mood-choice__desc">让情绪有处安放</text>
      </button>
    </view>

    <view class="form-section">
      <text class="form-label">更像哪一种感受？</text>
      <view class="emotion-list">
        <button v-for="item in emotionOptions[mood]" :key="item" class="emotion-option" :class="[`emotion-option--${mood}`, { 'emotion-option--active': emotion === item }]" @tap="emotion = item">{{ item }}</button>
      </view>
    </view>

    <view class="writing-card card">
      <textarea v-model="content" class="writing-card__input" maxlength="1000" placeholder="写下发生了什么，或只是描述现在的感觉……" placeholder-class="writing-placeholder" />
      <view class="writing-card__meta"><text>慢慢写，不着急</text><text>{{ characterCount }}/1000</text></view>
    </view>

    <view class="settings card">
      <picker mode="date" :value="recordDate" :end="todayString()" @change="chooseDate">
        <view class="setting-row">
          <view class="setting-row__left"><view class="setting-icon"><AppIcon name="calendar" :size="18" /></view><view><text class="setting-title">记录日期</text><text class="setting-desc">{{ recordDate === todayString() ? '今天' : `${recordDate} · 补记` }}</text></view></view>
          <AppIcon name="chevron" :size="16" color="#aa9994" />
        </view>
      </picker>

      <view class="setting-row setting-row--top">
        <view class="setting-row__left"><view class="setting-icon"><AppIcon :name="visibility === 'private' ? 'lock' : 'heart'" :size="18" /></view><view><text class="setting-title">谁可以看</text><text class="setting-desc">{{ visibility === 'partner' ? `我和 ${store.activeRelationship?.partnerName}` : '仅自己可见' }}</text></view></view>
        <view class="mini-segments">
          <button v-if="store.activeRelationship" :class="{ active: visibility === 'partner' }" @tap="visibility = 'partner'">双方</button>
          <button :class="{ active: visibility === 'private' }" @tap="visibility = 'private'">仅自己</button>
        </view>
      </view>

      <view v-if="visibility === 'partner'" class="setting-row setting-row--top">
        <view class="setting-row__left"><view class="setting-icon"><AppIcon name="comment" :size="18" /></view><view><text class="setting-title">允许评论</text><text class="setting-desc">TA 可以温柔回应你</text></view></view>
        <switch :checked="allowComments" color="#d87263" @change="toggleComments" />
      </view>
    </view>

    <button class="primary-button publish" :class="{ 'publish--disabled': !canPublish }" @tap="publish">收藏这一刻</button>
    <text class="privacy-note"><AppIcon name="lock" :size="13" />你的私密记录不会出现在 TA 的报告里</text>
  </view>
</template>

<style scoped lang="scss">
.create-page { padding-bottom: calc(112rpx + env(safe-area-inset-bottom)); }
.create-head { padding: 12rpx 2rpx 38rpx; }
.create-head__title { display: block; margin-top: 18rpx; font-size: 46rpx; font-weight: 750; }
.create-head__desc { display: block; margin-top: 14rpx; color: #746663; font-size: 25rpx; }
.mood-switch { display: grid; grid-template-columns: 1fr 1fr; gap: 20rpx; }
.mood-choice { display: flex; min-height: 284rpx; flex-direction: column; align-items: center; justify-content: center; border: 3rpx solid transparent; border-radius: 28rpx; color: #514441; }
.mood-choice--happy { background: rgba(255, 234, 217, .72); }
.mood-choice--sad { background: rgba(226, 236, 246, .75); }
.mood-choice--active { border-color: #d17b6a; box-shadow: 0 12rpx 30rpx rgba(112, 76, 64, .10); }
.mood-choice--sad.mood-choice--active { border-color: #7896b0; }
.mood-choice__title, .mood-choice__desc { display: block; }
.mood-choice__title { margin-top: 16rpx; font-size: 31rpx; font-weight: 750; }
.mood-choice__desc { margin-top: 7rpx; color: #817370; font-size: 21rpx; }
.form-section { margin-top: 42rpx; }
.form-label { font-size: 29rpx; font-weight: 700; }
.emotion-list { display: flex; flex-wrap: wrap; gap: 14rpx; margin-top: 18rpx; }
.emotion-option { display: flex; min-width: 104rpx; height: 64rpx; padding: 0 22rpx; align-items: center; justify-content: center; border: 1rpx solid #eaded6; border-radius: 999rpx; background: #fff; color: #746662; font-size: 24rpx; line-height: 1; text-align: center; }
.emotion-option--active.emotion-option--happy { border-color: #e4a177; background: #ffe7d4; color: #8e5336; font-weight: 700; }
.emotion-option--active.emotion-option--sad { border-color: #91aeca; background: #e5eef6; color: #536f89; font-weight: 700; }
.writing-card { margin-top: 30rpx; padding: 28rpx; }
.writing-card__input { width: 100%; min-height: 280rpx; color: #453a37; font-size: 29rpx; line-height: 1.75; }
.writing-card__meta { display: flex; justify-content: space-between; color: #a0928e; font-size: 21rpx; }
:deep(.writing-placeholder) { color: #b4a6a1; }
.settings { margin-top: 26rpx; padding: 4rpx 24rpx; }
.setting-row { display: flex; min-height: 124rpx; align-items: center; justify-content: space-between; }
.setting-row--top { border-top: 1rpx solid #f1e9e4; }
.setting-row__left { display: flex; align-items: center; gap: 17rpx; }
.setting-icon { display: flex; width: 64rpx; height: 64rpx; align-items: center; justify-content: center; border-radius: 19rpx; background: #ffeadf; color: #95584e; }
.setting-title, .setting-desc { display: block; }
.setting-title { font-weight: 650; }
.setting-desc { margin-top: 6rpx; color: #938582; font-size: 21rpx; }
.mini-segments { display: flex; padding: 5rpx; border-radius: 17rpx; background: #f2e9e3; }
.mini-segments button { display: flex; height: 53rpx; padding: 0 18rpx; align-items: center; justify-content: center; border-radius: 13rpx; background: transparent; color: #8e807c; font-size: 21rpx; line-height: 1; text-align: center; }
.mini-segments button.active { background: #fff; color: #9c564d; font-weight: 700; }
.publish { margin-top: 32rpx; }
.publish--disabled { opacity: .48; box-shadow: none; }
.privacy-note { display: flex; gap: 8rpx; margin-top: 18rpx; align-items: center; justify-content: center; color: #9a8b87; font-size: 21rpx; }
</style>
