<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { onReachBottom, onShow } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import LoadingIndicator from '@/components/LoadingIndicator.vue'
import RecordCard from '@/components/RecordCard.vue'
import SegmentControl from '@/components/SegmentControl.vue'
import { useAnniversaryStore } from '@/stores/anniversary'
import { useArchiveStore } from '@/stores/archive'
import type { AuthorId, MoodRecord } from '@/types/domain'
import { listMoods, type MoodListScope } from '@/api/moods'
import { acceptRelationshipInvite, createRelationshipInvite, getCurrentRelationship } from '@/api/relationships'
import { addReaction, removeReaction } from '@/api/reactions'
import { getMoodDetail } from '@/api/moods'
import { ApiError } from '@/api/request'
import { syncTabBarSelection } from '@/utils/tab-bar'
import { anniversaryKindLabels, formatAnniversaryDate, getAnniversaryStatus } from '@/utils/anniversary'

const store = useArchiveStore()
const anniversaryStore = useAnniversaryStore()
type ArchiveFilter = 'all' | 'me' | 'partner'
interface FeedState {
  items: MoodRecord[]
  page: number
  total: number
  loaded: boolean
  loading: boolean
  showLoading: boolean
  loadingMore: boolean
  error: string
  loadMoreError: string
}

const filterKeys: ArchiveFilter[] = ['all', 'me', 'partner']
const createFeedState = (): FeedState => ({
  items: [],
  page: 1,
  total: 0,
  loaded: false,
  loading: false,
  showLoading: false,
  loadingMore: false,
  error: '',
  loadMoreError: '',
})
const filter = ref<ArchiveFilter>('all')
const feeds = reactive<Record<ArchiveFilter, FeedState>>({
  all: { ...createFeedState(), loading: store.user.isLoggedIn },
  me: createFeedState(),
  partner: createFeedState(),
})
const pageSize = 10
const respondingId = ref('')
const inviteLoading = ref(false)
const inviteError = ref('')
const bindingMode = ref<'invite' | 'enter'>('invite')
const inviteInput = ref('')
const bindingLoading = ref(false)
const feedRequestIds: Record<ArchiveFilter, number> = { all: 0, me: 0, partner: 0 }
let contextRequestId = 0

const ensureInviteCode = async () => {
  if (!store.user.isLoggedIn || store.activeRelationship || store.inviteCode || inviteLoading.value) return
  inviteLoading.value = true
  inviteError.value = ''
  try {
    store.setInvite(await createRelationshipInvite())
  } catch (error) {
    inviteError.value = error instanceof Error ? error.message : '邀请码生成失败'
  } finally {
    inviteLoading.value = false
  }
}

const toListScope = (value: ArchiveFilter): MoodListScope => value === 'me' ? 'mine' : value
const activeFeed = computed(() => feeds[filter.value])
const records = computed(() => activeFeed.value.items)
const recordsLoading = computed(() => activeFeed.value.showLoading)
const loadingMore = computed(() => activeFeed.value.loadingMore)
const recordsError = computed(() => activeFeed.value.error)
const loadMoreError = computed(() => activeFeed.value.loadMoreError)
const hasMore = computed(() => records.value.length < activeFeed.value.total)
const showListEnd = computed(() => activeFeed.value.loaded && !hasMore.value && activeFeed.value.total >= pageSize)

const resetFeeds = () => {
  filterKeys.forEach((key) => Object.assign(feeds[key], createFeedState()))
}

const handleExpiredSession = (error: unknown) => {
  if (!(error instanceof ApiError) || error.statusCode !== 401) return false
  store.logout()
  anniversaryStore.reset()
  resetFeeds()
  return true
}

const updateCachedRecord = (record: MoodRecord) => {
  filterKeys.forEach((key) => {
    const index = feeds[key].items.findIndex((item) => item.id === record.id)
    if (index >= 0) feeds[key].items[index] = record
  })
}

const loadRecords = async (scope: ArchiveFilter = filter.value, showLoading = true) => {
  if (!store.user.isLoggedIn) {
    resetFeeds()
    store.replaceRecords([])
    store.setCurrentRelationship({ active: false, relationship: null })
    return
  }
  const feed = feeds[scope]
  const requestId = ++feedRequestIds[scope]
  feed.loading = true
  feed.showLoading = showLoading
  feed.error = ''
  feed.loadMoreError = ''
  try {
    const moodPage = await listMoods({ page: 1, pageSize, scope: toListScope(scope) }, store.user.id)
    if (requestId !== feedRequestIds[scope] || !store.user.isLoggedIn) return
    feed.items = moodPage.items
    feed.page = moodPage.pagination.page
    feed.total = moodPage.pagination.total
    feed.loaded = true
    moodPage.items.forEach((record) => store.upsertRecord(record))
  } catch (error) {
    if (requestId !== feedRequestIds[scope] || !store.user.isLoggedIn) return
    if (handleExpiredSession(error)) return
    feed.error = error instanceof Error ? error.message : '心情列表加载失败'
  } finally {
    if (requestId === feedRequestIds[scope]) {
      feed.loading = false
      feed.showLoading = false
    }
  }
}

const loadPageContext = async () => {
  const requestId = ++contextRequestId
  if (!store.user.isLoggedIn) {
    store.setCurrentRelationship({ active: false, relationship: null })
    return
  }
  try {
    const relationshipResult = await getCurrentRelationship()
    if (requestId !== contextRequestId || !store.user.isLoggedIn) return
    store.setCurrentRelationship(relationshipResult)
    if (filter.value === 'partner' && !relationshipResult.active) void ensureInviteCode()
  } catch (error) {
    if (handleExpiredSession(error)) return
    console.warn('首页状态加载失败', error)
  }
}

const loadMoreRecords = async () => {
  const scope = filter.value
  const feed = feeds[scope]
  if (!store.user.isLoggedIn || feed.loading || feed.loadingMore || feed.items.length >= feed.total) return
  feed.loadingMore = true
  feed.loadMoreError = ''
  try {
    const moodPage = await listMoods(
      { page: feed.page + 1, pageSize, scope: toListScope(scope) },
      store.user.id,
    )
    const existingIds = new Set(feed.items.map((record) => record.id))
    feed.items.push(...moodPage.items.filter((record) => !existingIds.has(record.id)))
    feed.page = moodPage.pagination.page
    feed.total = moodPage.pagination.total
    moodPage.items.forEach((record) => store.upsertRecord(record))
  } catch (error) {
    feed.loadMoreError = error instanceof Error ? error.message : '加载更多心情失败'
  } finally {
    feed.loadingMore = false
  }
}

onShow(() => {
  syncTabBarSelection()
  if (store.user.isLoggedIn) void anniversaryStore.loadNearest(store.user.id, true)
  else anniversaryStore.reset()
  filterKeys.forEach((key) => {
    if (key !== filter.value) feeds[key].loaded = false
  })
  void loadRecords(filter.value, !activeFeed.value.loaded)
  void loadPageContext()
})
onReachBottom(loadMoreRecords)

const filters = [
  { label: '全部', value: 'all' }, { label: '我的', value: 'me' }, { label: 'TA 的', value: 'partner' },
]
const isUnboundPartnerView = computed(() => store.user.isLoggedIn && filter.value === 'partner' && !store.activeRelationship)
const nearestAnniversary = computed(() => store.user.isLoggedIn ? anniversaryStore.nearestItem : null)
const retryNearestAnniversary = () => {
  if (store.user.isLoggedIn) void anniversaryStore.loadNearest(store.user.id, true)
}

const openRecord = (id: string) => uni.navigateTo({ url: `/pages/record/detail?id=${id}` })
const respondToMood = async (id: string) => {
  const record = records.value.find((item) => item.id === id)
  if (!record) return
  if (record.authorId === 'me') {
    uni.showToast({ title: '这是你自己的心情', icon: 'none' })
    return
  }
  if (respondingId.value) return
  respondingId.value = id
  try {
    const hasReacted = record.mood === 'happy' ? record.likedByPartner : record.huggedByPartner
    if (hasReacted) await removeReaction(id)
    else await addReaction(id)
    const updatedRecord = await getMoodDetail(id, store.user.id)
    updateCachedRecord(updatedRecord)
    store.upsertRecord(updatedRecord)
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '回应失败，请稍后重试', icon: 'none' })
  } finally {
    respondingId.value = ''
  }
}
const goLogin = (target: 'create' | 'binding' | 'profile') => uni.navigateTo({ url: `/pages/login/index?target=${target}` })
const goCreate = () => uni.navigateTo({ url: '/pages/create/index' })
const goAnniversary = () => uni.switchTab({ url: '/pages/anniversary/index' })
const goAddAnniversary = () => uni.navigateTo({ url: '/pages/anniversary/edit' })
const goBinding = () => store.user.isLoggedIn ? uni.navigateTo({ url: '/pages/binding/index' }) : goLogin('binding')
const copyInviteCode = () => {
  if (!store.inviteCode) return
  uni.setClipboardData({
    data: store.inviteCode,
    success: () => uni.showToast({ title: '邀请码已复制', icon: 'success' }),
  })
}
const regenerateInvite = async () => {
  store.clearInvite()
  await ensureInviteCode()
}
const acceptInvite = () => {
  const normalizedCode = inviteInput.value.trim()
  if (!/^\d{6}$/.test(normalizedCode)) {
    uni.showToast({ title: '请输入 6 位数字邀请码', icon: 'none' })
    return
  }
  uni.showModal({
    title: '确认共同存档？',
    content: '绑定后，双方可以查看绑定期间对彼此公开的记录和情绪统计。',
    confirmText: '确认绑定',
    confirmColor: '#d87263',
    success: async (result) => {
      if (!result.confirm) return
      bindingLoading.value = true
      try {
        await acceptRelationshipInvite(normalizedCode)
        store.setCurrentRelationship(await getCurrentRelationship())
        inviteInput.value = ''
        feeds.partner.loaded = false
        await Promise.all([loadPageContext(), loadRecords(filter.value)])
        uni.showToast({ title: '绑定成功', icon: 'success' })
      } catch (error) {
        uni.showToast({ title: error instanceof Error ? error.message : '绑定失败，请稍后重试', icon: 'none' })
      } finally {
        bindingLoading.value = false
      }
    },
  })
}
watch(filter, (value) => {
  if (value === 'partner' && !store.activeRelationship) void ensureInviteCode()
  if (!feeds[value].loaded && value !== 'all' && feeds.all.loaded) {
    const authorId: AuthorId = value === 'me' ? 'me' : 'partner'
    feeds[value].items = feeds.all.items.filter((record) => record.authorId === authorId)
  }
  if (!feeds[value].loaded) void loadRecords(value)
})
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
        <view class="paired-avatar paired-avatar--partner">
          <image v-if="store.activeRelationship?.partnerAvatarUrl" class="user-avatar-image" :src="store.activeRelationship.partnerAvatarUrl" mode="aspectFill" />
          <text v-else>{{ store.activeRelationship?.partnerInitial || '?' }}</text>
        </view>
      </view>
    </view>

    <view v-if="!store.user.isLoggedIn" class="guest-guide card">
      <view class="guest-guide__icon"><AppIcon name="heart" :size="23" filled /></view>
      <view class="guest-guide__copy">
        <text class="guest-guide__title">不用登录，先随便看看</text>
        <text class="guest-guide__desc">你可以先浏览功能，也可以先填写心情和重要日子；需要保存时，再自主选择微信登录。</text>
      </view>
      <view class="guest-guide__action" role="button" hover-class="heading-action--pressed" @tap="goLogin('profile')">去登录</view>
    </view>

    <view class="special-days-heading">
      <view class="special-days-heading__main">
        <text class="section-title">重要日子</text>
        <view
          class="special-days-heading__add"
          role="button"
          aria-label="添加重要日子"
          hover-class="heading-action--pressed"
          :hover-start-time="20"
          @tap="goAddAnniversary"
        >
          <view class="special-days-heading__add-icon"><AppIcon name="plus" :size="13" /></view>
          <text class="special-days-heading__add-text">添加</text>
        </view>
      </view>
      <view class="special-days-heading__meta">
        <text class="special-days-heading__sub">纪念日、生日，还有值得记录的相遇</text>
        <view
          class="special-days-heading__more"
          role="button"
          aria-label="查看全部重要日子"
          hover-class="heading-action--pressed"
          :hover-start-time="20"
          @tap="goAnniversary"
        >
          <text>查看全部</text>
          <AppIcon name="chevron" :size="14" />
        </view>
      </view>
    </view>

    <view v-if="nearestAnniversary" class="special-day-card card" @tap="goAnniversary">
      <view class="special-day-card__top">
        <view class="special-day-card__kind">
          <AppIcon :name="nearestAnniversary.kind === 'relationship' ? 'heart' : 'calendar'" :size="15" :filled="nearestAnniversary.kind === 'relationship'" />
          <text>{{ anniversaryKindLabels[nearestAnniversary.kind] }}</text>
        </view>
        <view class="special-day-card__visibility">
          <AppIcon :name="nearestAnniversary.visibility === 'private' ? 'lock' : 'heart'" :size="13" />
          <text>{{ nearestAnniversary.visibility === 'private' ? '仅自己可见' : '双方可见' }}</text>
        </view>
      </view>
      <text class="special-day-card__title">{{ nearestAnniversary.title }}</text>
      <text v-if="nearestAnniversary.note" class="special-day-card__note">{{ nearestAnniversary.note }}</text>
      <view class="special-day-card__bottom">
        <view class="special-day-card__date">
          <text class="special-day-card__label">日期</text>
          <view class="special-day-card__date-value">
            <view class="special-day-card__date-icon"><AppIcon name="calendar" :size="15" /></view>
            <text class="special-day-card__date-text">{{ formatAnniversaryDate(nearestAnniversary) }}</text>
          </view>
        </view>
        <view class="special-day-card__countdown">
          <text class="special-day-card__label">距离下一次</text>
          <text class="special-day-card__countdown-value">{{ getAnniversaryStatus(nearestAnniversary) }}</text>
        </view>
      </view>
    </view>
    <view v-else-if="store.user.isLoggedIn && anniversaryStore.nearestLoading && !anniversaryStore.nearestLoaded" class="special-day-card special-day-skeleton card" aria-label="正在加载最近的重要日子">
      <view class="special-day-skeleton__top skeleton-shimmer" />
      <view class="special-day-skeleton__title skeleton-shimmer" />
      <view class="special-day-skeleton__bottom">
        <view class="special-day-skeleton__line skeleton-shimmer" />
        <view class="special-day-skeleton__line special-day-skeleton__line--short skeleton-shimmer" />
      </view>
    </view>
    <view v-else-if="store.user.isLoggedIn && anniversaryStore.nearestError" class="special-day-empty card">
      <view class="special-day-empty__icon"><AppIcon name="calendar" :size="27" /></view>
      <view class="special-day-empty__copy">
        <text class="special-day-empty__title">重要日子暂时没有加载出来</text>
        <text class="special-day-empty__desc">{{ anniversaryStore.nearestError }}</text>
      </view>
      <view class="special-day-retry" role="button" hover-class="heading-action--pressed" @tap="retryNearestAnniversary">重试</view>
    </view>
    <view v-else class="special-day-empty card">
      <view class="special-day-empty__icon"><AppIcon name="calendar" :size="27" /></view>
      <view class="special-day-empty__copy">
        <text class="special-day-empty__title">收藏第一个重要日子</text>
        <text class="special-day-empty__desc">{{ store.user.isLoggedIn ? '点击右上角“添加”，从纪念日或生日开始' : '可以先填写纪念日或生日，需要保存时再登录' }}</text>
      </view>
    </view>

    <view class="feed-heading">
      <text class="section-title">心情存档</text>
      <view
        class="quick-add"
        role="button"
        aria-label="记录心情"
        hover-class="heading-action--pressed"
        :hover-start-time="20"
        @tap="goCreate"
      >
        <view class="quick-add__content">
          <view class="quick-add__icon"><AppIcon name="plus" :size="17" /></view>
          <text class="quick-add__text">记录</text>
        </view>
      </view>
    </view>
    <SegmentControl v-model="filter" :options="filters" />

    <view v-if="isUnboundPartnerView" class="partner-invite-empty card">
      <view class="partner-invite-empty__icon"><AppIcon name="link" :size="27" /></view>
      <text class="partner-invite-empty__title">邀请 TA 一起收藏心情</text>
      <text class="partner-invite-empty__desc">绑定后，这里会出现 TA 在绑定期间与你分享的心情。以前的记录不会自动公开。</text>
      <view class="binding-mode">
        <button :class="{ active: bindingMode === 'invite' }" @tap="bindingMode = 'invite'">邀请 TA</button>
        <button :class="{ active: bindingMode === 'enter' }" @tap="bindingMode = 'enter'">输入邀请码</button>
      </view>
      <template v-if="bindingMode === 'invite'">
        <view class="invite-code-box">
          <text class="invite-code-box__label">你的专属邀请码</text>
          <text v-if="store.inviteCode" class="invite-code-box__value">{{ store.inviteCode }}</text>
          <text v-else-if="inviteLoading" class="invite-code-box__status">正在生成邀请码…</text>
          <text v-else class="invite-code-box__status">{{ inviteError || '暂时没有可用邀请码' }}</text>
          <text class="invite-code-box__tip">邀请码 24 小时内有效，仅能使用一次</text>
        </view>
        <button v-if="store.inviteCode" class="invite-copy" @tap="copyInviteCode">复制邀请码</button>
        <button v-else class="invite-copy" :loading="inviteLoading" :disabled="inviteLoading" @tap="ensureInviteCode">生成邀请码</button>
        <button class="invite-secondary" :loading="inviteLoading" :disabled="inviteLoading" @tap="regenerateInvite">重新生成</button>
      </template>
      <template v-else>
        <view class="invite-enter-box">
          <text class="invite-code-box__label">输入 TA 发来的邀请码</text>
          <input v-model="inviteInput" class="invite-code-input" type="number" maxlength="6" placeholder="例如 083726" confirm-type="done" @confirm="acceptInvite" />
          <text class="invite-code-box__tip">绑定前的记录不会自动向对方公开</text>
        </view>
        <button class="invite-copy" :loading="bindingLoading" :disabled="bindingLoading" @tap="acceptInvite">确认并绑定</button>
      </template>
    </view>
    <view v-else-if="records.length" class="feed" :class="{ 'feed--refreshing': recordsLoading }">
      <RecordCard v-for="record in records" :key="record.id" :record="record" :responding="respondingId === record.id" @respond="respondToMood" @open="openRecord" />
      <view class="feed-footer">
        <LoadingIndicator v-if="loadingMore" text="正在打开更早的心情…" compact />
        <button v-else-if="loadMoreError" @tap="loadMoreRecords">加载失败，点击重试</button>
        <text v-else-if="showListEnd">已经看完所有心情了</text>
      </view>
    </view>
    <view v-else-if="recordsLoading" class="feed feed-skeleton" aria-label="正在加载心情存档">
      <view v-for="item in 2" :key="item" class="record-skeleton card home-skeleton">
        <view class="record-skeleton__head">
          <view class="skeleton-record-author"><view class="skeleton-block skeleton-record-avatar" /><view><view class="skeleton-block skeleton-line skeleton-record-name" /><view class="skeleton-block skeleton-line skeleton-record-time" /></view></view>
          <view class="skeleton-block skeleton-record-chip" />
        </view>
        <view class="skeleton-block skeleton-line skeleton-record-content skeleton-record-content--long" />
        <view class="skeleton-block skeleton-line skeleton-record-content" />
        <view class="record-skeleton__footer"><view class="skeleton-block skeleton-record-action" /><view class="skeleton-block skeleton-record-action skeleton-record-action--wide" /></view>
      </view>
    </view>
    <view v-else-if="recordsError" class="empty-state card">
      <text class="empty-state__title">心情存档暂时没有打开</text>
      <text class="empty-state__desc">{{ recordsError }}</text>
      <button class="retry-button" @tap="loadRecords()">重新加载</button>
    </view>
    <view v-else class="empty-state card">
      <text class="empty-state__title">这里还没有心情</text>
      <text class="empty-state__desc">不需要写得完美，留下此刻就很好。</text>
      <button class="empty-create" @tap="goCreate">{{ store.user.isLoggedIn ? '记录第一条心情' : '先试着记录此刻' }}</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.archive-page { padding-top: 24rpx; padding-bottom: calc(104rpx + env(safe-area-inset-bottom)); }
.hero { display: flex; align-items: flex-start; justify-content: space-between; padding: 12rpx 2rpx 38rpx; }
.guest-guide{display:flex;margin-bottom:28rpx;padding:24rpx;align-items:center;border-color:#efd8d0;background:rgba(255,250,246,.88)}
.guest-guide__icon{display:flex;width:62rpx;height:62rpx;flex:none;align-items:center;justify-content:center;border-radius:21rpx;background:#ffe8df;color:#b45f53}
.guest-guide__copy{min-width:0;flex:1;margin-left:18rpx}.guest-guide__title,.guest-guide__desc{display:block}.guest-guide__title{color:#493c39;font-size:25rpx;font-weight:750}.guest-guide__desc{margin-top:7rpx;color:#847672;font-size:20rpx;line-height:1.55}
.guest-guide__action{display:flex;min-width:98rpx;height:58rpx;margin-left:16rpx;padding:0 16rpx;align-items:center;justify-content:center;border-radius:19rpx;background:#fff0e8;color:#a45d52;font-size:21rpx;font-weight:700;line-height:1}
.hero__title { display: block; max-width: 500rpx; margin-top: 18rpx; font-size: 48rpx; font-weight: 750; line-height: 1.32; letter-spacing: 1rpx; }
.hero__sub { display: block; max-width: 510rpx; margin-top: 18rpx; color: #736562; font-size: 25rpx; line-height: 1.65; }
.paired-avatars { display: flex; margin-top: 10rpx; }
.paired-avatar { display: flex; width: 72rpx; height: 72rpx; align-items: center; justify-content: center; border: 5rpx solid #fff9f2; border-radius: 50%; color: #70473e; font-weight: 700; }
.paired-avatar--me { background: #f7c29f; }
.paired-avatar--partner { margin-left: -22rpx; background: #c7dae9; color: #526a80; }
.user-avatar-image { display: block; width: 100%; height: 100%; border-radius: inherit; }
.special-days-heading { margin-top: 4rpx; }
.special-days-heading__main,.special-days-heading__meta { display: flex; align-items: center; }
.special-days-heading__main { gap: 14rpx; justify-content: flex-start; }
.special-days-heading__meta { justify-content: space-between; }
.special-days-heading .section-title { display: block; margin: 0; }
.special-days-heading__meta { min-height: 48rpx; margin-top: 3rpx; }
.special-days-heading__sub { color: #887a76; font-size: 22rpx; }
.special-days-heading__add { display: flex; min-width: 108rpx; height: 60rpx; gap: 4rpx; padding: 0 16rpx; align-items: center; justify-content: center; border: 1rpx solid #eacbc4; border-radius: 20rpx; background: #fff7f3; color: #a65349; font-size: 21rpx; font-weight: 700; line-height: 1; }
.special-days-heading__add-icon { display: flex; width: 28rpx; height: 28rpx; flex: none; align-items: center; justify-content: center; font-size: 0; line-height: 0; }
.special-days-heading__add-text { display: block; height: 28rpx; line-height: 28rpx; }
.special-days-heading__more { display: flex; height: 48rpx; gap: 1rpx; padding: 0 0 0 12rpx; align-items: center; justify-content: center; background: transparent; color: #9c6a62; font-size: 20rpx; font-weight: 650; line-height: 1; }
.heading-action--pressed { opacity: .62; }
.special-day-card { position: relative; overflow: hidden; margin-top: 17rpx; padding: 27rpx 27rpx 25rpx; border-color: #edd3cc; background: linear-gradient(145deg,#fffdfa 0%,#fff2ed 100%); box-shadow: 0 12rpx 34rpx rgba(132,79,67,.09); }
.special-day-card::after { position: absolute; width: 178rpx; height: 178rpx; right: -66rpx; bottom: -92rpx; border-radius: 50%; background: rgba(244,178,158,.12); content: ''; pointer-events: none; }
.special-day-card__top { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; }
.special-day-card__kind { display: flex; min-height: 48rpx; gap: 7rpx; padding: 0 15rpx; align-items: center; justify-content: center; border-radius: 999rpx; background: #ffe6de; color: #9f5148; font-size: 20rpx; font-weight: 700; }
.special-day-card__visibility { display: flex; gap: 6rpx; align-items: center; color: #8f7d78; font-size: 19rpx; }
.special-day-card__title,.special-day-card__note,.special-day-card__label,.special-day-card__countdown-value { display: block; }
.special-day-card__title { position: relative; z-index: 1; margin-top: 24rpx; color: #453734; font-size: 36rpx; font-weight: 760; line-height: 1.4; }
.special-day-card__note { position: relative; z-index: 1; overflow: hidden; margin-top: 8rpx; color: #7b6b67; font-size: 22rpx; text-overflow: ellipsis; white-space: nowrap; }
.special-day-card__bottom { position: relative; z-index: 1; display: flex; margin-top: 25rpx; padding-top: 21rpx; align-items: flex-end; justify-content: space-between; border-top: 1rpx solid #eedbd5; }
.special-day-card__label { margin-bottom: 7rpx; color: #a3928d; font-size: 18rpx; }
.special-day-card__date { min-width: 0; flex: 1; }
.special-day-card__date-value { display: flex; height: 32rpx; gap: 7rpx; align-items: center; color: #735a54; font-size: 22rpx; font-weight: 650; line-height: 1; }
.special-day-card__date-icon { display: flex; width: 30rpx; height: 30rpx; flex: none; align-items: center; justify-content: center; font-size: 0; line-height: 1; }
.special-day-card__date-text { display: flex; height: 30rpx; align-items: center; line-height: 30rpx; white-space: nowrap; }
.special-day-card__countdown { flex: none; margin-left: 20rpx; text-align: right; }
.special-day-card__countdown-value { color: #ad5148; font-size: 29rpx; font-weight: 780; line-height: 1.15; }
.special-day-empty { display: flex; min-height: 136rpx; margin-top: 20rpx; padding: 24rpx; align-items: center; border-color: #efd8d1; background: linear-gradient(145deg,#fff,#fff6f2); }
.special-day-empty__icon { display: flex; width: 74rpx; height: 74rpx; flex: none; align-items: center; justify-content: center; border-radius: 24rpx; background: #ffe5dc; color: #a85b50; }
.special-day-empty__copy { min-width: 0; flex: 1; margin-left: 17rpx; }
.special-day-empty__title,.special-day-empty__desc { display: block; }
.special-day-empty__title { color: #4d3e3b; font-size: 26rpx; font-weight: 750; }
.special-day-empty__desc { margin-top: 7rpx; color: #897975; font-size: 20rpx; line-height: 1.5; }
.special-day-retry { display: flex; width: 92rpx; height: 58rpx; flex: none; align-items: center; justify-content: center; border-radius: 19rpx; background: #fff0ea; color: #a65349; font-size: 21rpx; font-weight: 700; }
.special-day-skeleton { min-height: 258rpx; pointer-events: none; }
.special-day-skeleton__top { width: 138rpx; height: 48rpx; border-radius: 999rpx; }
.special-day-skeleton__title { width: 58%; height: 39rpx; margin-top: 25rpx; border-radius: 14rpx; }
.special-day-skeleton__bottom { display: flex; margin-top: 31rpx; padding-top: 25rpx; align-items: center; justify-content: space-between; border-top: 1rpx solid #eedbd5; }
.special-day-skeleton__line { width: 38%; height: 26rpx; border-radius: 12rpx; }
.special-day-skeleton__line--short { width: 24%; }
.skeleton-shimmer { background: linear-gradient(100deg, #f3e4df 25%, #fff8f4 45%, #f3e4df 65%); background-size: 220% 100%; animation: skeleton-shimmer 1.35s ease-in-out infinite; }
@keyframes skeleton-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
.feed-heading { display: flex; margin-top: 42rpx; align-items: center; justify-content: space-between; }
.feed-heading .section-title { margin: 0; }
.quick-add { display: flex; height: 60rpx; margin: 0; padding: 0 8rpx; box-sizing: border-box; align-items: center; justify-content: center; border: 0; background: transparent; color: #a84f45; font-size: 25rpx; font-weight: 700; line-height: normal; }
.quick-add__content { display: flex; height: 36rpx; gap: 6rpx; align-items: center; justify-content: center; }
.quick-add__icon { display: flex; width: 36rpx; height: 36rpx; flex: none; align-items: center; justify-content: center; font-size: 0; line-height: 0; }
.quick-add__text { display: block; height: 36rpx; line-height: 36rpx; }
.feed-heading + :deep(.segments) { margin-top: 20rpx; }
.feed { display: grid; gap: 24rpx; margin-top: 24rpx; }
.feed-footer { display: flex; min-height: 72rpx; align-items: center; justify-content: center; color: #948681; font-size: 21rpx; text-align: center; }
.feed-footer button { min-height: 64rpx; padding: 0 24rpx; background: transparent; color: #a45e53; font-size: 21rpx; line-height: 64rpx; }
.empty-state { margin-top: 22rpx; }
.retry-button, .empty-create { display: flex; min-height: 72rpx; margin: 22rpx auto 0; padding: 0 28rpx; align-items: center; justify-content: center; border-radius: 20rpx; background: #d87263; color: #fff; font-size: 23rpx; font-weight: 700; line-height: 1; }
.home-skeleton{pointer-events:none}.skeleton-block{overflow:hidden;border:0;background:linear-gradient(100deg,#f3e6e4 20%,#fbeeed 42%,#f3e6e4 64%);background-size:220% 100%;animation:skeleton-shimmer 1.35s ease-in-out infinite}.skeleton-line{border-radius:999rpx}.record-skeleton{min-height:300rpx;padding:28rpx 26rpx 24rpx}.record-skeleton__head,.skeleton-record-author,.record-skeleton__footer{display:flex;align-items:center}.record-skeleton__head{justify-content:space-between}.skeleton-record-author{gap:18rpx}.skeleton-record-avatar{width:68rpx;height:68rpx;flex:none;border-radius:21rpx}.skeleton-record-name{width:116rpx;height:26rpx}.skeleton-record-time{width:142rpx;height:22rpx;margin-top:7rpx}.skeleton-record-chip{width:112rpx;height:48rpx;border-radius:999rpx}.skeleton-record-content{width:82%;height:26rpx;margin-top:14rpx}.skeleton-record-content--long{width:100%;margin-top:28rpx}.record-skeleton__footer{gap:16rpx;margin-top:25rpx;padding-top:19rpx;border-top:1rpx solid #f1e8e3}.skeleton-record-action{width:128rpx;height:50rpx;border-radius:16rpx}.skeleton-record-action--wide{flex:1}.feed--refreshing{position:relative;overflow:hidden;pointer-events:none}.feed--refreshing::after{position:absolute;z-index:5;inset:0;content:'';border-radius:26rpx;background:linear-gradient(100deg,rgba(255,250,248,.28) 20%,rgba(245,226,225,.68) 42%,rgba(255,250,248,.28) 64%);background-size:220% 100%;animation:skeleton-shimmer 1.35s ease-in-out infinite}@keyframes skeleton-shimmer{to{background-position:-220% 0}}@media(prefers-reduced-motion:reduce){.skeleton-block,.feed--refreshing::after{animation:none}}
.partner-invite-empty { margin-top: 24rpx; padding: 38rpx 30rpx 30rpx; text-align: center; background: linear-gradient(145deg,#fff,#fff5ed); }.partner-invite-empty__icon{display:flex;width:82rpx;height:82rpx;margin:0 auto;align-items:center;justify-content:center;border-radius:28rpx;background:#eaf2f8;color:#607f98}.partner-invite-empty__title,.partner-invite-empty__desc{display:block}.partner-invite-empty__title{margin-top:22rpx;font-size:30rpx;font-weight:750}.partner-invite-empty__desc{margin:12rpx auto 0;color:#81736f;font-size:22rpx;line-height:1.65}.binding-mode{display:flex;margin-top:26rpx;padding:6rpx;border-radius:20rpx;background:#efe5df}.binding-mode button{display:flex;height:64rpx;flex:1;align-items:center;justify-content:center;border-radius:16rpx;background:transparent;color:#897a76;font-size:23rpx;line-height:1}.binding-mode button.active{background:#fff;color:#9c564d;font-weight:700;box-shadow:0 5rpx 15rpx rgba(90,65,55,.08)}.invite-code-box,.invite-enter-box{margin-top:20rpx;padding:23rpx;border:1rpx dashed #dfc8bb;border-radius:24rpx;background:#fffaf6}.invite-code-box__label,.invite-code-box__value,.invite-code-box__status,.invite-code-box__tip{display:block}.invite-code-box__label{color:#8b7c77;font-size:20rpx}.invite-code-box__value{margin-top:10rpx;color:#77483f;font-size:38rpx;font-weight:800;letter-spacing:5rpx}.invite-code-box__status{margin-top:12rpx;color:#897a76;font-size:23rpx}.invite-code-box__tip{margin-top:10rpx;color:#9d8e8a;font-size:19rpx}.invite-code-input{height:88rpx;margin-top:16rpx;border:1rpx solid #e8d9d1;border-radius:21rpx;background:#fff;color:#674842;font-size:29rpx;font-weight:750;letter-spacing:3rpx;text-align:center}.invite-copy{display:flex;min-height:80rpx;margin-top:22rpx;align-items:center;justify-content:center;border-radius:22rpx;background:#d87263;color:#fff;font-size:25rpx;font-weight:700;line-height:1}.invite-secondary{min-height:62rpx;margin:10rpx auto 0;background:transparent;color:#8f6058;font-size:22rpx;line-height:62rpx}.invite-copy[disabled],.invite-secondary[disabled]{opacity:.58}
</style>
