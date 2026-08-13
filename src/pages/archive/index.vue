<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import RecordCard from '@/components/RecordCard.vue'
import SegmentControl from '@/components/SegmentControl.vue'
import { useArchiveStore } from '@/stores/archive'
import { todayString } from '@/utils/date'
import type { AuthorId, MoodRecord } from '@/types/domain'

const store = useArchiveStore()
const filter = ref('all')
const refreshKey = ref(0)
onShow(() => refreshKey.value++)

const filters = [
  { label: '全部', value: 'all' }, { label: '我的', value: 'me' }, { label: 'TA 的', value: 'partner' },
]
const records = computed(() => {
  refreshKey.value
  return store.visibleFeed.filter((record) => filter.value === 'all' || record.authorId === filter.value)
})
const latestTodayMood = (authorId: AuthorId) => computed(() => {
  refreshKey.value
  return store.visibleFeed.find((record) => record.authorId === authorId && record.recordDate === todayString())
})
const myTodayMood = latestTodayMood('me')
const partnerTodayMood = latestTodayMood('partner')

const openRecord = (id: string) => uni.navigateTo({ url: `/pages/record/detail?id=${id}` })
const goLogin = (target: 'create' | 'binding' | 'profile') => uni.navigateTo({ url: `/pages/login/index?target=${target}` })
const goCreate = () => store.user.isLoggedIn ? uni.switchTab({ url: '/pages/create/index' }) : goLogin('create')
const goBinding = () => store.user.isLoggedIn ? uni.navigateTo({ url: '/pages/binding/index' }) : goLogin('binding')
const openTodayMood = (record: MoodRecord | undefined, authorId: AuthorId) => {
  if (record) return openRecord(record.id)
  if (authorId === 'me') return goCreate()
  if (!store.activeRelationship) goBinding()
}
</script>

<template>
  <view class="page-shell archive-page">
    <view class="hero">
      <view>
        <text class="eyebrow">LOVE ARCHIVE</text>
        <text class="hero__title">今天，也值得被好好收藏</text>
        <text class="hero__sub">你和 {{ store.activeRelationship?.partnerName || '未来的 TA' }} 的心情，都有安放的地方。</text>
      </view>
      <view class="paired-avatars" @tap="goBinding">
        <view class="paired-avatar paired-avatar--me">
          <image v-if="store.user.avatarUrl" class="user-avatar-image" :src="store.user.avatarUrl" mode="aspectFill" />
          <text v-else>{{ store.user.initial }}</text>
        </view>
        <view class="paired-avatar paired-avatar--partner">{{ store.activeRelationship?.partnerInitial || '?' }}</view>
      </view>
    </view>

    <view v-if="store.activeRelationship" class="bond-card card" @tap="goBinding">
      <view class="bond-card__icon"><text class="bond-heart">♥</text></view>
      <view class="bond-card__copy">
        <text class="bond-card__title">正在和 {{ store.activeRelationship.partnerName }} 共同存档</text>
        <text class="bond-card__desc">已彼此陪伴 56 天</text>
      </view>
      <AppIcon name="chevron" :size="17" color="#a89691" />
    </view>
    <view v-else class="bond-card card" @tap="goBinding">
      <view class="bond-card__icon"><text class="bond-heart">♥</text></view>
      <view class="bond-card__copy"><text class="bond-card__title">邀请你的对象共同存档</text><text class="bond-card__desc">未绑定时也可以安心独自记录</text></view>
      <AppIcon name="chevron" :size="17" color="#a89691" />
    </view>

    <view class="inbox-heading">
      <view>
        <text class="section-title">今日心情信箱</text>
        <text class="inbox-heading__sub">不比较情绪，只认真听见彼此</text>
      </view>
      <text class="inbox-heading__date">今天</text>
    </view>
    <view class="mood-inbox card">
      <view class="inbox-row" @tap="openTodayMood(myTodayMood, 'me')">
        <view class="inbox-avatar">
          <image v-if="store.user.avatarUrl" class="user-avatar-image" :src="store.user.avatarUrl" mode="aspectFill" />
          <text v-else>{{ store.user.initial }}</text>
        </view>
        <view class="inbox-copy">
          <text class="inbox-title">{{ myTodayMood ? '今天的心情已好好存档' : '今天还没有留下心情' }}</text>
          <text class="inbox-desc">{{ myTodayMood ? '这一刻已经被你温柔保存' : '不需要写得完美，诚实记录就好' }}</text>
        </view>
        <view class="inbox-action">
          <text>{{ myTodayMood ? '查看' : '去记录' }}</text>
          <AppIcon name="chevron" :size="15" color="#a36b61" />
        </view>
      </view>

      <view
        class="inbox-row inbox-row--partner"
        @tap="openTodayMood(partnerTodayMood, 'partner')"
      >
        <view class="inbox-avatar inbox-avatar--partner">{{ store.activeRelationship?.partnerInitial || '?' }}</view>
        <view class="inbox-copy">
          <text class="inbox-title">
            {{ partnerTodayMood ? `${store.activeRelationship?.partnerName || 'TA'} 留下了一封心情` : store.activeRelationship ? '今天的信箱还很安静' : '邀请 TA 一起写下心情' }}
          </text>
          <text class="inbox-desc">
            {{ partnerTodayMood ? '慢一点读，也许 TA 正在等你理解' : store.activeRelationship ? '给彼此一点时间，也是一种温柔' : '绑定后，彼此可见的心情会来到这里' }}
          </text>
        </view>
        <view v-if="partnerTodayMood || !store.activeRelationship" class="inbox-action inbox-action--partner">
          <text>{{ partnerTodayMood ? '去看看' : '去邀请' }}</text>
          <AppIcon name="chevron" :size="15" color="#607f98" />
        </view>
      </view>
    </view>

    <view class="feed-heading">
      <text class="section-title">心情存档</text>
      <button class="quick-add" @tap="goCreate"><AppIcon name="plus" :size="17" />记录</button>
    </view>
    <SegmentControl v-model="filter" :options="filters" />

    <view v-if="records.length" class="feed">
      <RecordCard v-for="record in records" :key="record.id" :record="record" @respond="store.toggleMoodResponse" @open="openRecord" />
    </view>
    <view v-else class="empty-state card">
      <text class="empty-state__title">这里还没有心情</text>
      <text class="empty-state__desc">不需要写得完美，留下此刻就很好。</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.archive-page { padding-top: 42rpx; padding-bottom: calc(104rpx + env(safe-area-inset-bottom)); }
.hero { display: flex; align-items: flex-start; justify-content: space-between; padding: 12rpx 2rpx 38rpx; }
.hero__title { display: block; max-width: 500rpx; margin-top: 18rpx; font-size: 48rpx; font-weight: 750; line-height: 1.32; letter-spacing: 1rpx; }
.hero__sub { display: block; max-width: 510rpx; margin-top: 18rpx; color: #736562; font-size: 25rpx; line-height: 1.65; }
.paired-avatars { display: flex; margin-top: 10rpx; }
.paired-avatar { display: flex; width: 72rpx; height: 72rpx; align-items: center; justify-content: center; border: 5rpx solid #fff9f2; border-radius: 50%; color: #70473e; font-weight: 700; }
.paired-avatar--me { background: #f7c29f; }
.paired-avatar--partner { margin-left: -22rpx; background: #c7dae9; color: #526a80; }
.user-avatar-image { display: block; width: 100%; height: 100%; border-radius: inherit; }
.bond-card { display: flex; min-height: 124rpx; padding: 25rpx 24rpx; align-items: center; border-color: #efdcd2; background: linear-gradient(135deg,#fff,#fff8f3); }
.bond-card__icon { display: flex; width: 70rpx; height: 70rpx; align-items: center; justify-content: center; border: 1rpx solid #f1d8ca; border-radius: 22rpx; background: #ffeadc; color: #96594e; }
.bond-heart { color: #a65147; font-size: 31rpx; line-height: 1; }
.bond-card__copy { flex: 1; margin-left: 18rpx; }
.bond-card__title, .bond-card__desc { display: block; }
.bond-card__title { color: #4a3c39; font-size: 27rpx; font-weight: 700; }
.bond-card__desc { margin-top: 7rpx; color: #837572; font-size: 22rpx; }
.inbox-heading { display: flex; margin-top: 42rpx; align-items: flex-end; justify-content: space-between; }
.inbox-heading .section-title { margin: 0; }
.inbox-heading__sub { display: block; margin-top: 6rpx; color: #887a76; font-size: 22rpx; }
.inbox-heading__date { padding: 8rpx 16rpx; border-radius: 999rpx; background: #f6e8df; color: #9c5d52; font-size: 21rpx; }
.mood-inbox { overflow: hidden; margin-top: 20rpx; padding: 0 24rpx; }
.inbox-row { display: flex; min-height: 148rpx; align-items: center; border-bottom: 1rpx solid #f0e6e0; }
.inbox-row:last-child { border-bottom: 0; }
.inbox-avatar { display: flex; width: 66rpx; height: 66rpx; flex: none; align-items: center; justify-content: center; border-radius: 21rpx; background: #f7c29f; color: #70473e; font-weight: 700; }
.inbox-avatar--partner { background: #c7dae9; color: #526a80; }
.inbox-copy { min-width: 0; flex: 1; margin-left: 18rpx; }
.inbox-title, .inbox-desc { display: block; }
.inbox-title { overflow: hidden; color: #4e403d; font-size: 25rpx; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.inbox-desc { overflow: hidden; margin-top: 8rpx; color: #82736f; font-size: 21rpx; text-overflow: ellipsis; white-space: nowrap; }
.inbox-action { display: flex; min-width: 112rpx; min-height: 66rpx; gap: 4rpx; margin-left: 12rpx; align-items: center; justify-content: center; border-radius: 19rpx; background: #fff1e8; color: #9f5f54; font-size: 21rpx; font-weight: 650; }
.inbox-action--partner { background: #edf4f9; color: #607f98; }
.feed-heading { display: flex; margin-top: 42rpx; align-items: center; justify-content: space-between; }
.feed-heading .section-title { margin: 0; }
.quick-add { display: flex; gap: 5rpx; min-height: 60rpx; padding: 0 8rpx; align-items: center; background: transparent; color: #a84f45; font-size: 25rpx; font-weight: 700; }
.feed-heading + :deep(.segments) { margin-top: 20rpx; }
.feed { display: grid; gap: 24rpx; margin-top: 24rpx; }
.empty-state { margin-top: 22rpx; }
</style>
