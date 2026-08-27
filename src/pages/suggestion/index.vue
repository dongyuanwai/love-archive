<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import SegmentControl from '@/components/SegmentControl.vue'
import { submitSuggestion } from '@/api/suggestions'
import type { SuggestionType } from '@/api/suggestions'

const MAX_LENGTH = 1000
const type = ref<SuggestionType>('ISSUE')
const content = ref('')
const submitting = ref(false)
const typeOptions: { label: string; value: SuggestionType }[] = [
  { label: '问题反馈', value: 'ISSUE' },
  { label: '建议', value: 'SUGGESTION' },
]
const trimmedContent = computed(() => content.value.trim())
const canSubmit = computed(() => trimmedContent.value.length > 0 && !submitting.value)
const isIssue = computed(() => type.value === 'ISSUE')
const inputPlaceholder = computed(() => isIssue.value
  ? '请描述你遇到的问题，以及当时进行了什么操作……'
  : '有什么希望我们改进的？')

const submit = async () => {
  if (submitting.value) return
  if (!trimmedContent.value) {
    uni.showToast({ title: '请写下反馈或建议内容', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    await submitSuggestion(type.value, trimmedContent.value)
    content.value = ''
    uni.showToast({
      title: isIssue.value ? '问题反馈已收到，谢谢你告诉我们' : '谢谢你的建议，我们已经好好收到了',
      icon: 'none',
      duration: 1600,
    })
    setTimeout(() => uni.navigateBack(), 1600)
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '内容提交失败，请稍后再试',
      icon: 'none',
    })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="page-shell suggestion-page">
    <view class="suggestion-head">
      <view class="suggestion-head__icon"><AppIcon name="feedback" :size="27" /></view>
      <text class="eyebrow">A NOTE FOR US</text>
      <text class="suggestion-head__title">告诉我们你的想法</text>
      <text class="suggestion-head__desc">无论是遇到的问题，还是期待的改变，我们都会认真收下。</text>
    </view>

    <view class="type-section">
      <text class="type-section__label">你想告诉我们什么？</text>
      <SegmentControl v-model="type" :options="typeOptions" />
    </view>

    <view class="suggestion-card card">
      <textarea
        v-model="content"
        class="suggestion-input"
        :maxlength="MAX_LENGTH"
        :aria-label="isIssue ? '问题反馈内容' : '建议内容'"
        :placeholder="inputPlaceholder"
        placeholder-class="suggestion-placeholder"
        confirm-type="done"
      />
      <view class="suggestion-meta">
        <text>{{ isIssue ? '尽量描述具体的操作和现象' : '只需要写下你的真实想法' }}</text>
        <text>{{ content.length }}/{{ MAX_LENGTH }}</text>
      </view>
    </view>

    <view class="privacy-note">
      <AppIcon name="lock" :size="17" />
      <text>提交内容仅用于产品改进，你的对象无法看到</text>
    </view>

    <button
      class="submit-button"
      :class="{ 'submit-button--disabled': !canSubmit }"
      :disabled="!canSubmit"
      :loading="submitting"
      @tap="submit"
    >
      {{ submitting ? '正在送出…' : isIssue ? '提交问题反馈' : '送出建议' }}
    </button>
  </view>
</template>

<style scoped lang="scss">
.suggestion-page {
  padding-top: 28rpx;
}

.suggestion-head {
  display: flex;
  padding: 14rpx 4rpx 40rpx;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.suggestion-head__icon {
  display: flex;
  width: 92rpx;
  height: 92rpx;
  margin-bottom: 22rpx;
  align-items: center;
  justify-content: center;
  border-radius: 30rpx;
  background: linear-gradient(145deg, #ffe5dc, #f9d3c7);
  color: #a65d52;
  box-shadow: 0 12rpx 26rpx rgba(166, 93, 82, 0.1);
}

.suggestion-head__title,
.suggestion-head__desc {
  display: block;
}

.type-section {
  margin-bottom: 22rpx;
}

.type-section__label {
  display: block;
  margin: 0 2rpx 12rpx;
  color: #665956;
  font-size: 23rpx;
  font-weight: 700;
}

.suggestion-head__title {
  margin-top: 16rpx;
  font-size: 43rpx;
  font-weight: 750;
  letter-spacing: 1rpx;
}

.suggestion-head__desc {
  max-width: 570rpx;
  margin-top: 14rpx;
  color: #81736f;
  font-size: 24rpx;
  line-height: 1.7;
}

.suggestion-card {
  overflow: hidden;
  padding: 28rpx 28rpx 20rpx;
}

.suggestion-input {
  display: block;
  width: 100%;
  height: 350rpx;
  color: #463a38;
  font-size: 28rpx;
  line-height: 1.75;
}

:deep(.suggestion-placeholder) {
  color: #b2a39f;
}

.suggestion-meta {
  display: flex;
  min-height: 48rpx;
  padding-top: 16rpx;
  align-items: center;
  justify-content: space-between;
  border-top: 1rpx solid #f1e6e0;
  color: #9b8c88;
  font-size: 21rpx;
}

.privacy-note {
  display: flex;
  min-height: 72rpx;
  gap: 10rpx;
  padding: 0 8rpx;
  align-items: center;
  color: #877874;
  font-size: 22rpx;
}

.submit-button {
  display: flex;
  width: 100%;
  min-height: 92rpx;
  margin-top: 14rpx;
  align-items: center;
  justify-content: center;
  border-radius: 28rpx;
  background: linear-gradient(135deg, #d87868, #c9695b);
  color: #fff;
  font-size: 29rpx;
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 14rpx 28rpx rgba(197, 95, 83, 0.2);
}

.submit-button--disabled {
  background: #e8d9d4;
  color: #aa9b97;
  box-shadow: none;
}
</style>
