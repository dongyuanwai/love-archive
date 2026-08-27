<script setup lang="ts">
import { ref, watch } from 'vue'
import { onLoad, onReachBottom } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import SegmentControl from '@/components/SegmentControl.vue'
import { ApiError } from '@/api/request'
import { getSuggestionList } from '@/api/suggestions'
import type { SuggestionListItem, SuggestionType } from '@/api/suggestions'
import { formatDateTime } from '@/utils/date'

const filter = ref<SuggestionType>('ISSUE')
const items = ref<SuggestionListItem[]>([])
const nextCursor = ref<string | null>(null)
const loading = ref(false)
const loadingMore = ref(false)
const filterOptions: { label: string; value: SuggestionType }[] = [
  { label: '问题反馈', value: 'ISSUE' },
  { label: '建议', value: 'SUGGESTION' },
]

const handleLoadError = (error: unknown) => {
  if (error instanceof ApiError && error.statusCode === 403) {
    uni.showToast({ title: '你没有查看权限', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 800)
    return
  }
  uni.showToast({
    title: error instanceof Error ? error.message : '反馈列表加载失败',
    icon: 'none',
  })
}

const load = async (reset = false) => {
  if (loading.value || loadingMore.value) return
  if (!reset && !nextCursor.value) return

  if (reset) loading.value = true
  else loadingMore.value = true
  try {
    const result = await getSuggestionList({
      type: filter.value,
      cursor: reset ? undefined : nextCursor.value || undefined,
      limit: 20,
    })
    items.value = reset ? result.items : [...items.value, ...result.items]
    nextCursor.value = result.nextCursor
  } catch (error) {
    handleLoadError(error)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

watch(filter, () => load(true))
onLoad(() => load(true))
onReachBottom(() => load(false))
</script>

<template>
  <view class="page-shell feedback-list-page">
    <view class="feedback-head">
      <view class="feedback-head__icon"><AppIcon name="document" :size="27" /></view>
      <text class="eyebrow">USER NOTES</text>
      <text class="feedback-head__title">反馈与建议</text>
      <text class="feedback-head__desc">只有管理账号可以查看，用户和其对象不会看到这些内容。</text>
    </view>

    <SegmentControl v-model="filter" :options="filterOptions" />

    <view v-if="loading && !items.length" class="feedback-list" aria-label="正在加载反馈列表">
      <view v-for="index in 3" :key="index" class="feedback-card card feedback-skeleton">
        <view class="skeleton-row"><view class="skeleton-block skeleton-avatar" /><view class="skeleton-copy"><view class="skeleton-block skeleton-line skeleton-line--name" /><view class="skeleton-block skeleton-line skeleton-line--time" /></view><view class="skeleton-block skeleton-tag" /></view>
        <view class="skeleton-block skeleton-line skeleton-line--content" />
        <view class="skeleton-block skeleton-line skeleton-line--content-short" />
      </view>
    </view>

    <view v-else-if="items.length" class="feedback-list">
      <view v-for="item in items" :key="item.id" class="feedback-card card">
        <view class="feedback-author">
          <image v-if="item.user.avatarUrl" class="feedback-avatar feedback-avatar--image" :src="item.user.avatarUrl" mode="aspectFill" />
          <view v-else class="feedback-avatar">{{ item.user.nickname.slice(0, 1) || '用' }}</view>
          <view class="feedback-author__copy">
            <text class="feedback-author__name">{{ item.user.nickname }}</text>
            <text class="feedback-time">{{ formatDateTime(item.createdAt) }}</text>
          </view>
          <text class="feedback-type" :class="`feedback-type--${item.type.toLowerCase()}`">{{ item.type === 'ISSUE' ? '问题反馈' : '建议' }}</text>
        </view>
        <text class="feedback-content">{{ item.content }}</text>
      </view>
      <view class="list-footer">
        <text v-if="loadingMore">正在加载更多…</text>
        <text v-else-if="!nextCursor">已经看完全部内容</text>
      </view>
    </view>

    <view v-else class="empty-card card">
      <view class="empty-card__icon"><AppIcon name="feedback" :size="27" /></view>
      <text class="empty-card__title">还没有这类内容</text>
      <text class="empty-card__desc">用户提交后，会按时间从新到旧显示在这里。</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.feedback-list-page { padding-top: 24rpx; padding-bottom: calc(48rpx + env(safe-area-inset-bottom)); }
.feedback-head { display: flex; padding: 12rpx 4rpx 34rpx; flex-direction: column; align-items: center; text-align: center; }
.feedback-head__icon { display: flex; width: 86rpx; height: 86rpx; margin-bottom: 20rpx; align-items: center; justify-content: center; border-radius: 28rpx; background: #eaf1f6; color: #617b90; }
.feedback-head__title,.feedback-head__desc { display: block; }
.feedback-head__title { margin-top: 14rpx; color: #473b38; font-size: 42rpx; font-weight: 750; }
.feedback-head__desc { max-width: 600rpx; margin-top: 12rpx; color: #81736f; font-size: 22rpx; line-height: 1.65; }
.feedback-list { display: flex; gap: 20rpx; margin-top: 22rpx; flex-direction: column; }
.feedback-card { padding: 26rpx; }
.feedback-author { display: flex; min-height: 66rpx; align-items: center; }
.feedback-avatar { display: flex; width: 66rpx; height: 66rpx; flex: none; overflow: hidden; align-items: center; justify-content: center; border-radius: 22rpx; background: linear-gradient(145deg,#f9c9a7,#efa989); color: #784a3e; font-size: 23rpx; font-weight: 750; }
.feedback-avatar--image { display: block; background: #f5ebe5; }
.feedback-author__copy { min-width: 0; flex: 1; margin-left: 16rpx; }
.feedback-author__name,.feedback-time { display: block; }
.feedback-author__name { overflow: hidden; color: #493d3a; font-size: 25rpx; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.feedback-time { margin-top: 6rpx; color: #9a8b87; font-size: 19rpx; }
.feedback-type { display: flex; min-height: 46rpx; padding: 0 16rpx; flex: none; align-items: center; justify-content: center; border-radius: 999rpx; font-size: 19rpx; font-weight: 700; line-height: 1; }
.feedback-type--issue { background: #eaf1f6; color: #607b91; }
.feedback-type--suggestion { background: #ffeadf; color: #9a594e; }
.feedback-content { display: block; margin-top: 22rpx; color: #504441; font-size: 25rpx; line-height: 1.75; white-space: pre-wrap; word-break: break-word; }
.list-footer { display: flex; min-height: 72rpx; align-items: center; justify-content: center; color: #9a8b87; font-size: 20rpx; }
.empty-card { display: flex; min-height: 330rpx; margin-top: 22rpx; padding: 40rpx; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.empty-card__icon { display: flex; width: 82rpx; height: 82rpx; align-items: center; justify-content: center; border-radius: 28rpx; background: #ffeadf; color: #9a594e; }
.empty-card__title,.empty-card__desc { display: block; }
.empty-card__title { margin-top: 22rpx; color: #504441; font-size: 28rpx; font-weight: 700; }
.empty-card__desc { max-width: 460rpx; margin-top: 10rpx; color: #948580; font-size: 21rpx; line-height: 1.65; }
.feedback-skeleton { pointer-events: none; }
.skeleton-row { display: flex; align-items: center; }
.skeleton-block { overflow: hidden; background: linear-gradient(100deg,#f3e6e4 20%,#fbeeed 42%,#f3e6e4 64%); background-size: 220% 100%; animation: skeleton-shimmer 1.35s ease-in-out infinite; }
.skeleton-avatar { width: 66rpx; height: 66rpx; flex: none; border-radius: 22rpx; }
.skeleton-copy { flex: 1; margin-left: 16rpx; }
.skeleton-line { border-radius: 999rpx; }
.skeleton-line--name { width: 160rpx; height: 24rpx; }
.skeleton-line--time { width: 120rpx; height: 18rpx; margin-top: 8rpx; }
.skeleton-tag { width: 90rpx; height: 46rpx; border-radius: 999rpx; }
.skeleton-line--content { width: 100%; height: 22rpx; margin-top: 28rpx; }
.skeleton-line--content-short { width: 72%; height: 22rpx; margin-top: 14rpx; }
@keyframes skeleton-shimmer { to { background-position: -220% 0; } }
@media (prefers-reduced-motion: reduce) { .skeleton-block { animation: none; } }
</style>
