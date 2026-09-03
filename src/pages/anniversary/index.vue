<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import { useAnniversaryStore } from '@/stores/anniversary'
import { useArchiveStore } from '@/stores/archive'
import type { Anniversary } from '@/types/domain'
import { anniversaryKindLabels, formatAnniversaryDate, getAnniversaryStatus } from '@/utils/anniversary'
import { syncTabBarSelection } from '@/utils/tab-bar'
import {
  formatTogetherDayDate,
  getTogetherDayDuration,
} from '@/utils/together-day'

const archiveStore = useArchiveStore()
const anniversaryStore = useAnniversaryStore()

const upcomingItems = computed(() => anniversaryStore.sortedItems.filter((item) => item.archived !== true))
const archivedItems = computed(() => anniversaryStore.sortedItems.filter((item) => item.archived === true))
const togetherDay = computed(() => archiveStore.activeRelationship?.togetherSince || '')
const togetherDuration = computed(() =>
  togetherDay.value ? getTogetherDayDuration(togetherDay.value) : null)
const initialLoading = computed(() => anniversaryStore.loading && !anniversaryStore.loaded)
const initialError = computed(() => anniversaryStore.error && !anniversaryStore.loaded)

onShow(() => {
  syncTabBarSelection()
  void anniversaryStore.loadForUser(archiveStore.user.id, true)
})

const goCreate = () => uni.navigateTo({ url: '/pages/anniversary/edit' })
const goEdit = (id: string) => uni.navigateTo({ url: `/pages/anniversary/edit?id=${id}` })
const goTogetherDay = () => uni.navigateTo({ url: '/pages/together-day/edit' })
const retry = () => { void anniversaryStore.loadForUser(archiveStore.user.id, true) }
const kindClass = (item: Anniversary) => `date-card__icon--${item.kind.replace('_', '-')}`
</script>

<template>
  <view class="page-shell anniversary-page">
    <view class="anniversary-head">
      <view>
        <text class="eyebrow">OUR SPECIAL DAYS</text>
        <text class="anniversary-head__title">把重要的日子，认真记住</text>
        <text class="anniversary-head__desc">纪念相遇与相爱，也收藏生日和只属于你们的小日子。</text>
      </view>
      <view class="head-add" role="button" aria-label="添加重要日子" hover-class="tap-hover" @tap="goCreate">
        <AppIcon name="plus" :size="23" />
      </view>
    </view>

    <view v-if="archiveStore.activeRelationship" class="together-section">
      <view class="list-heading together-heading">
        <text class="section-title">我们的日子</text>
        <text>双方共同珍藏</text>
      </view>
      <view
        class="together-date-card card"
        role="button"
        :aria-label="togetherDay ? '查看在一起的日子' : '添加在一起的日子'"
        hover-class="tap-hover"
        @tap="goTogetherDay"
      >
        <view class="together-date-card__icon"><AppIcon name="heart" :size="24" filled /></view>
        <view v-if="togetherDay && togetherDuration" class="together-date-card__copy">
          <view class="together-date-card__title-row">
            <text class="together-date-card__title">在一起的日子</text>
            <text class="together-date-card__duration">{{ togetherDuration.years }} 年 {{ togetherDuration.months }} 月 {{ togetherDuration.days }} 天</text>
          </view>
          <text class="together-date-card__meta">从 {{ formatTogetherDayDate(togetherDay) }} 开始</text>
          <text class="together-date-card__note">今天是彼此相伴的第 {{ togetherDuration.totalDays }} 天</text>
        </view>
        <view v-else class="together-date-card__copy">
          <text class="together-date-card__title">添加在一起的日子</text>
          <text class="together-date-card__meta">设置后，就能看到你们一起走过了多久</text>
        </view>
        <AppIcon name="chevron" :size="17" color="#aa766d" />
      </view>
    </view>

    <view v-if="initialLoading" class="date-list date-list--skeleton" aria-label="正在加载重要日子">
      <view v-for="index in 3" :key="index" class="date-card card date-skeleton">
        <view class="date-skeleton__icon skeleton-shimmer" />
        <view class="date-skeleton__copy">
          <view class="date-skeleton__line date-skeleton__line--title skeleton-shimmer" />
          <view class="date-skeleton__line skeleton-shimmer" />
          <view class="date-skeleton__line date-skeleton__line--short skeleton-shimmer" />
        </view>
      </view>
    </view>

    <view v-else-if="initialError" class="empty-state card anniversary-empty">
      <view class="anniversary-empty__icon"><AppIcon name="calendar" :size="31" /></view>
      <text class="empty-state__title">重要日子暂时没有加载出来</text>
      <text class="empty-state__desc">{{ anniversaryStore.error }}</text>
      <view class="empty-add" role="button" hover-class="tap-hover" @tap="retry">
        <text>重新加载</text>
      </view>
    </view>

    <template v-else-if="upcomingItems.length">
      <view class="list-heading">
        <text class="section-title">即将到来</text>
        <text>{{ upcomingItems.length }} 个重要日子</text>
      </view>
      <view class="date-list">
        <view v-for="item in upcomingItems" :key="item.id" class="date-card card" @tap="goEdit(item.id)">
          <view class="date-card__icon" :class="kindClass(item)">
            <AppIcon :name="item.kind === 'relationship' ? 'heart' : 'calendar'" :size="23" :filled="item.kind === 'relationship'" />
          </view>
          <view class="date-card__copy">
            <view class="date-card__title-row">
              <text class="date-card__title">{{ item.title }}</text>
              <text class="date-card__countdown">{{ getAnniversaryStatus(item) }}</text>
            </view>
            <text class="date-card__meta">{{ anniversaryKindLabels[item.kind] }} · {{ formatAnniversaryDate(item) }}</text>
            <text v-if="item.note" class="date-card__note">{{ item.note }}</text>
            <view class="date-card__visibility">
              <AppIcon :name="item.visibility === 'private' ? 'lock' : 'heart'" :size="14" />
              <text>{{ item.visibility === 'private' ? '仅自己可见' : '双方可见' }}</text>
            </view>
          </view>
          <AppIcon name="chevron" :size="17" color="#aa9690" />
        </view>
      </view>
    </template>

    <view v-else class="empty-state card anniversary-empty">
      <view class="anniversary-empty__icon"><AppIcon name="calendar" :size="31" /></view>
      <text class="empty-state__title">还没有收藏重要日子</text>
      <text class="empty-state__desc">可以从纪念日、生日或第一次见面的日子开始。</text>
      <view class="empty-add" role="button" hover-class="tap-hover" @tap="goCreate">
        <AppIcon name="plus" :size="18" />
        <text>添加第一个日子</text>
      </view>
    </view>

    <template v-if="archivedItems.length">
      <view class="list-heading list-heading--archived">
        <text class="section-title">往日收藏</text>
        <text>仅一次的过去日期</text>
      </view>
      <view class="date-list date-list--archived">
        <view v-for="item in archivedItems" :key="item.id" class="date-card card" @tap="goEdit(item.id)">
          <view class="date-card__icon" :class="kindClass(item)"><AppIcon name="calendar" :size="22" /></view>
          <view class="date-card__copy">
            <view class="date-card__title-row"><text class="date-card__title">{{ item.title }}</text><text class="date-card__countdown">{{ getAnniversaryStatus(item) }}</text></view>
            <text class="date-card__meta">{{ anniversaryKindLabels[item.kind] }} · {{ formatAnniversaryDate(item) }}</text>
          </view>
          <AppIcon name="chevron" :size="17" color="#aa9690" />
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.anniversary-page { padding-top: 26rpx; padding-bottom: calc(116rpx + env(safe-area-inset-bottom)); }
.anniversary-head { display: flex; gap: 24rpx; padding: 12rpx 2rpx 38rpx; align-items: flex-start; justify-content: space-between; }
.anniversary-head__title,.anniversary-head__desc { display: block; }
.anniversary-head__title { max-width: 570rpx; margin-top: 16rpx; color: #403533; font-size: 44rpx; font-weight: 750; line-height: 1.35; }
.anniversary-head__desc { max-width: 560rpx; margin-top: 14rpx; color: #7e706c; font-size: 24rpx; line-height: 1.7; }
.head-add { display: flex; width: 76rpx; height: 76rpx; flex: none; margin-top: 2rpx; align-items: center; justify-content: center; border: 1rpx solid #edcfc8; border-radius: 25rpx; background: #fff6f2; color: #a9554b; box-shadow: 0 9rpx 24rpx rgba(154,85,72,.08); }
.together-section { margin-bottom: 36rpx; }
.together-heading { min-height: 56rpx; }
.together-date-card { position: relative; display: flex; overflow: hidden; min-height: 150rpx; margin-top: 15rpx; padding: 24rpx 22rpx; align-items: center; border-color: #edcec7; background: linear-gradient(135deg,#fffdfa,#ffefea); }
.together-date-card::after { position: absolute; width: 140rpx; height: 140rpx; right: -58rpx; bottom: -78rpx; border-radius: 50%; background: rgba(238,154,134,.12); content: ''; pointer-events: none; }
.together-date-card__icon { position: relative; z-index: 1; display: flex; width: 76rpx; height: 76rpx; flex: none; align-items: center; justify-content: center; border-radius: 25rpx; background: #ffded5; color: #a85248; }
.together-date-card__copy { position: relative; z-index: 1; min-width: 0; flex: 1; margin: 0 17rpx; }
.together-date-card__title-row { display: flex; gap: 12rpx; align-items: center; justify-content: space-between; }
.together-date-card__title,.together-date-card__meta,.together-date-card__note { display: block; }
.together-date-card__title { color: #4a3a37; font-size: 27rpx; font-weight: 760; }
.together-date-card__duration { flex: none; color: #ae574d; font-size: 20rpx; font-weight: 750; white-space: nowrap; }
.together-date-card__meta { overflow: hidden; margin-top: 7rpx; color: #887773; font-size: 20rpx; text-overflow: ellipsis; white-space: nowrap; }
.together-date-card__note { margin-top: 5rpx; color: #a06a61; font-size: 19rpx; }
.list-heading { display: flex; min-height: 70rpx; align-items: center; justify-content: space-between; }
.list-heading .section-title { margin: 0; font-size: 32rpx; }
.list-heading > text:last-child { color: #92827d; font-size: 21rpx; }
.list-heading--archived { margin-top: 42rpx; }
.date-list { display: grid; gap: 20rpx; margin-top: 18rpx; }
.date-card { display: flex; min-height: 164rpx; padding: 25rpx 23rpx; align-items: center; }
.date-card__icon { display: flex; width: 78rpx; height: 78rpx; flex: none; align-items: center; justify-content: center; border-radius: 25rpx; background: #ffe5da; color: #a95a4f; }
.date-card__icon--birthday { background: #fff0cd; color: #a87336; }
.date-card__icon--first-met { background: #e8f1f7; color: #607f98; }
.date-card__icon--custom { background: #f2e9f5; color: #8a668f; }
.date-card__copy { min-width: 0; flex: 1; margin: 0 17rpx; }
.date-card__title-row { display: flex; gap: 12rpx; align-items: center; justify-content: space-between; }
.date-card__title { overflow: hidden; min-width: 0; color: #493c39; font-size: 28rpx; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
.date-card__countdown { flex: none; color: #b45d51; font-size: 22rpx; font-weight: 700; }
.date-card__meta,.date-card__note { display: block; overflow: hidden; margin-top: 8rpx; color: #887975; font-size: 21rpx; text-overflow: ellipsis; white-space: nowrap; }
.date-card__note { color: #6f625f; }
.date-card__visibility { display: flex; gap: 6rpx; margin-top: 10rpx; align-items: center; color: #9a8b86; font-size: 19rpx; }
.date-list--archived { opacity: .78; }
.anniversary-empty { margin-top: 18rpx; }
.anniversary-empty__icon { display: flex; width: 94rpx; height: 94rpx; margin: 0 auto 24rpx; align-items: center; justify-content: center; border-radius: 31rpx; background: #ffe8df; color: #a85b50; }
.empty-add { display: flex; min-height: 78rpx; gap: 8rpx; margin: 26rpx auto 0; padding: 0 30rpx; align-items: center; justify-content: center; border-radius: 23rpx; background: #d87263; color: #fff; font-size: 24rpx; font-weight: 700; line-height: 1; }
.tap-hover { opacity: .72; }
.date-list--skeleton { margin-top: 18rpx; }
.date-skeleton { pointer-events: none; }
.date-skeleton__icon { width: 78rpx; height: 78rpx; flex: none; border-radius: 25rpx; }
.date-skeleton__copy { display: grid; flex: 1; gap: 13rpx; margin-left: 18rpx; }
.date-skeleton__line { width: 72%; height: 20rpx; border-radius: 12rpx; }
.date-skeleton__line--title { width: 48%; height: 27rpx; }
.date-skeleton__line--short { width: 35%; }
.skeleton-shimmer { background: linear-gradient(100deg, #f5e9e4 25%, #fff7f3 45%, #f5e9e4 65%); background-size: 220% 100%; animation: skeleton-shimmer 1.35s ease-in-out infinite; }
@keyframes skeleton-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
</style>
