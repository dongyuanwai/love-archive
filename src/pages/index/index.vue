<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { onReachBottom, onShow } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import LoadingIndicator from '@/components/LoadingIndicator.vue'
import RecordCard from '@/components/RecordCard.vue'
import SegmentControl from '@/components/SegmentControl.vue'
import { useArchiveStore } from '@/stores/archive'
import type { AuthorId, MoodRecord } from '@/types/domain'
import { getTodayMoodStatus, listMoods, type MoodListScope, type TodayMoodStatus } from '@/api/moods'
import { acceptRelationshipInvite, createRelationshipInvite, getCurrentRelationship } from '@/api/relationships'
import { addReaction, removeReaction } from '@/api/reactions'
import { getMoodDetail } from '@/api/moods'
import { syncTabBarSelection } from '@/utils/tab-bar'

const store = useArchiveStore()
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
const todayStatus = ref<TodayMoodStatus | null>(null)
const contextLoading = ref(store.user.isLoggedIn)
const contextShowLoading = ref(store.user.isLoggedIn)
const contextReady = ref(false)
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
    todayStatus.value = null
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
    feed.error = error instanceof Error ? error.message : '心情列表加载失败'
  } finally {
    if (requestId === feedRequestIds[scope]) {
      feed.loading = false
      feed.showLoading = false
    }
  }
}

const loadPageContext = async (showLoading = true) => {
  const requestId = ++contextRequestId
  if (!store.user.isLoggedIn) {
    contextLoading.value = false
    contextShowLoading.value = false
    contextReady.value = true
    todayStatus.value = null
    store.setCurrentRelationship({ active: false, relationship: null })
    return
  }
  contextLoading.value = true
  contextShowLoading.value = showLoading
  try {
    const [statusResult, relationshipResult] = await Promise.all([
      getTodayMoodStatus(),
      getCurrentRelationship(),
    ])
    if (requestId !== contextRequestId || !store.user.isLoggedIn) return
    todayStatus.value = statusResult
    store.setCurrentRelationship(relationshipResult)
    if (filter.value === 'partner' && !relationshipResult.active) void ensureInviteCode()
  } catch (error) {
    console.warn('首页状态加载失败', error)
  } finally {
    if (requestId === contextRequestId) {
      contextLoading.value = false
      contextShowLoading.value = false
      contextReady.value = true
    }
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
  filterKeys.forEach((key) => {
    if (key !== filter.value) feeds[key].loaded = false
  })
  void loadRecords(filter.value, !activeFeed.value.loaded)
  void loadPageContext(!contextReady.value)
})
onReachBottom(loadMoreRecords)

const filters = [
  { label: '全部', value: 'all' }, { label: '我的', value: 'me' }, { label: 'TA 的', value: 'partner' },
]
const isUnboundPartnerView = computed(() => store.user.isLoggedIn && filter.value === 'partner' && !store.activeRelationship)
const myTodayMoodId = computed(() => todayStatus.value?.mine?.id || null)
const partnerTodayMoodId = computed(() => todayStatus.value?.partner.id || null)

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
const goCreate = () => store.user.isLoggedIn ? uni.navigateTo({ url: '/pages/create/index' }) : goLogin('create')
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
const openTodayMood = (recordId: string | null, authorId: AuthorId) => {
  if (recordId) return openRecord(recordId)
  if (authorId === 'me') return goCreate()
  if (!store.activeRelationship) filter.value = 'partner'
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

    <view v-if="contextLoading && !contextReady" class="bond-card card home-skeleton" aria-label="正在加载关系状态">
      <view class="bond-card__icon skeleton-block" />
      <view class="bond-card__copy">
        <view class="skeleton-block skeleton-line skeleton-bond-title" />
        <view class="skeleton-block skeleton-line skeleton-bond-desc" />
      </view>
      <view class="skeleton-block skeleton-chevron" />
    </view>
    <view v-else-if="store.activeRelationship" class="bond-card card" :class="{ 'data-card--refreshing': contextShowLoading }" @tap="goBinding">
      <view class="bond-card__icon"><text class="bond-heart">♥</text></view>
      <view class="bond-card__copy">
        <text class="bond-card__title">正在和 {{ store.activeRelationship.partnerName }} 共同存档</text>
        <text class="bond-card__desc">已彼此陪伴 {{ store.activeRelationship.daysTogether || 1 }} 天</text>
      </view>
      <AppIcon name="chevron" :size="17" color="#a89691" />
    </view>
    <view v-else class="bond-card card" :class="{ 'data-card--refreshing': contextShowLoading }" @tap="goBinding">
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
    <view v-if="contextLoading && !contextReady" class="mood-inbox card home-skeleton" aria-label="正在加载今日心情">
      <view v-for="item in 2" :key="item" class="inbox-row">
        <view class="inbox-avatar skeleton-block" />
        <view class="inbox-copy">
          <view class="skeleton-block skeleton-line skeleton-inbox-title" />
          <view class="skeleton-block skeleton-line skeleton-inbox-desc" />
        </view>
        <view class="skeleton-block skeleton-inbox-action" />
      </view>
    </view>
    <view v-else class="mood-inbox card" :class="{ 'data-card--refreshing': contextShowLoading }">
      <view class="inbox-row" @tap="openTodayMood(myTodayMoodId, 'me')">
        <view class="inbox-avatar">
          <image v-if="store.user.avatarUrl" class="user-avatar-image" :src="store.user.avatarUrl" mode="aspectFill" />
          <text v-else>{{ store.user.initial }}</text>
        </view>
        <view class="inbox-copy">
          <text class="inbox-title">{{ myTodayMoodId ? '今天的心情已好好存档' : '今天还没有留下心情' }}</text>
          <text class="inbox-desc">{{ myTodayMoodId ? '这一刻已经被你温柔保存' : '不需要写得完美，诚实记录就好' }}</text>
        </view>
        <view class="inbox-action">
          <text>{{ myTodayMoodId ? '查看' : '去记录' }}</text>
          <view class="inbox-action__icon"><AppIcon name="chevron" :size="15" color="#a36b61" /></view>
        </view>
      </view>

      <view
        class="inbox-row inbox-row--partner"
        @tap="openTodayMood(partnerTodayMoodId, 'partner')"
      >
        <view class="inbox-avatar inbox-avatar--partner">
          <image v-if="store.activeRelationship?.partnerAvatarUrl" class="user-avatar-image" :src="store.activeRelationship.partnerAvatarUrl" mode="aspectFill" />
          <text v-else>{{ store.activeRelationship?.partnerInitial || '?' }}</text>
        </view>
        <view class="inbox-copy">
          <text class="inbox-title">
            {{ partnerTodayMoodId ? `${store.activeRelationship?.partnerName || 'TA'} 留下了一封心情` : store.activeRelationship ? '今天的信箱还很安静' : '邀请 TA 一起写下心情' }}
          </text>
          <text class="inbox-desc">
            {{ partnerTodayMoodId ? '慢一点读，也许 TA 正在等你理解' : store.activeRelationship ? '给彼此一点时间，也是一种温柔' : '绑定后，彼此可见的心情会来到这里' }}
          </text>
        </view>
        <view v-if="partnerTodayMoodId || !store.activeRelationship" class="inbox-action inbox-action--partner">
          <text>{{ partnerTodayMoodId ? '去看看' : '去邀请' }}</text>
          <view class="inbox-action__icon"><AppIcon name="chevron" :size="15" color="#607f98" /></view>
        </view>
      </view>
    </view>

    <view class="feed-heading">
      <text class="section-title">心情存档</text>
      <button class="quick-add" @tap="goCreate">
        <view class="quick-add__icon"><AppIcon name="plus" :size="17" /></view>
        <text class="quick-add__text">记录</text>
      </button>
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
      <button v-if="store.user.isLoggedIn" class="empty-create" @tap="goCreate">记录第一条心情</button>
      <button v-else class="empty-create" @tap="goLogin('create')">登录后开始记录</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.archive-page { padding-top: 24rpx; padding-bottom: calc(104rpx + env(safe-area-inset-bottom)); }
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
.inbox-action { display: flex; width: 124rpx; height: 66rpx; gap: 4rpx; flex: none; margin-left: 12rpx; padding: 0 8rpx; box-sizing: border-box; align-items: center; justify-content: center; border-radius: 19rpx; background: #fff1e8; color: #9f5f54; font-size: 21rpx; font-weight: 650; text-align: center; }
.inbox-action>text { display: flex; height: 100%; flex: none; align-items: center; justify-content: center; line-height: 1; text-align: center; }
.inbox-action__icon { display: flex; width: 30rpx; height: 30rpx; flex: none; align-items: center; justify-content: center; line-height: 1; }
.inbox-action--partner { background: #edf4f9; color: #607f98; }
.feed-heading { display: flex; margin-top: 42rpx; align-items: center; justify-content: space-between; }
.feed-heading .section-title { margin: 0; }
.quick-add { display: flex; height: 60rpx; gap: 6rpx; margin: 0; padding: 0 8rpx; box-sizing: border-box; align-items: center; justify-content: center; border: 0; background: transparent; color: #a84f45; font-size: 25rpx; font-weight: 700; line-height: 1; }
.quick-add::after { border: 0; }
.quick-add__icon { display: flex; width: 34rpx; height: 34rpx; flex: none; align-items: center; justify-content: center; line-height: 1; }
.quick-add__text { display: flex; height: 34rpx; align-items: center; justify-content: center; line-height: 1; }
.feed-heading + :deep(.segments) { margin-top: 20rpx; }
.feed { display: grid; gap: 24rpx; margin-top: 24rpx; }
.feed-footer { display: flex; min-height: 72rpx; align-items: center; justify-content: center; color: #948681; font-size: 21rpx; text-align: center; }
.feed-footer button { min-height: 64rpx; padding: 0 24rpx; background: transparent; color: #a45e53; font-size: 21rpx; line-height: 64rpx; }
.empty-state { margin-top: 22rpx; }
.retry-button, .empty-create { display: flex; min-height: 72rpx; margin: 22rpx auto 0; padding: 0 28rpx; align-items: center; justify-content: center; border-radius: 20rpx; background: #d87263; color: #fff; font-size: 23rpx; font-weight: 700; line-height: 1; }
.home-skeleton{pointer-events:none}.skeleton-block{overflow:hidden;border:0;background:linear-gradient(100deg,#f3e6e4 20%,#fbeeed 42%,#f3e6e4 64%);background-size:220% 100%;animation:skeleton-shimmer 1.35s ease-in-out infinite}.skeleton-line{border-radius:999rpx}.home-skeleton .bond-card__icon{background:linear-gradient(100deg,#f3e6e4 20%,#fbeeed 42%,#f3e6e4 64%);background-size:220% 100%}.skeleton-bond-title{width:260rpx;height:27rpx}.skeleton-bond-desc{width:182rpx;height:22rpx;margin-top:7rpx}.skeleton-chevron{width:17rpx;height:29rpx;flex:none;border-radius:999rpx}.home-skeleton .inbox-avatar{background:linear-gradient(100deg,#f3e6e4 20%,#fbeeed 42%,#f3e6e4 64%);background-size:220% 100%}.skeleton-inbox-title{width:250rpx;height:25rpx}.skeleton-inbox-desc{width:310rpx;height:21rpx;margin-top:8rpx}.skeleton-inbox-action{width:124rpx;height:66rpx;flex:none;margin-left:12rpx;border-radius:19rpx}.record-skeleton{min-height:300rpx;padding:28rpx 26rpx 24rpx}.record-skeleton__head,.skeleton-record-author,.record-skeleton__footer{display:flex;align-items:center}.record-skeleton__head{justify-content:space-between}.skeleton-record-author{gap:18rpx}.skeleton-record-avatar{width:68rpx;height:68rpx;flex:none;border-radius:21rpx}.skeleton-record-name{width:116rpx;height:26rpx}.skeleton-record-time{width:142rpx;height:22rpx;margin-top:7rpx}.skeleton-record-chip{width:112rpx;height:48rpx;border-radius:999rpx}.skeleton-record-content{width:82%;height:26rpx;margin-top:14rpx}.skeleton-record-content--long{width:100%;margin-top:28rpx}.record-skeleton__footer{gap:16rpx;margin-top:25rpx;padding-top:19rpx;border-top:1rpx solid #f1e8e3}.skeleton-record-action{width:128rpx;height:50rpx;border-radius:16rpx}.skeleton-record-action--wide{flex:1}.data-card--refreshing,.feed--refreshing{position:relative;overflow:hidden;pointer-events:none}.data-card--refreshing::after,.feed--refreshing::after{position:absolute;z-index:5;inset:0;content:'';background:linear-gradient(100deg,rgba(255,250,248,.28) 20%,rgba(245,226,225,.68) 42%,rgba(255,250,248,.28) 64%);background-size:220% 100%;animation:skeleton-shimmer 1.35s ease-in-out infinite}.feed--refreshing::after{border-radius:26rpx}@keyframes skeleton-shimmer{to{background-position:-220% 0}}@media(prefers-reduced-motion:reduce){.skeleton-block,.data-card--refreshing::after,.feed--refreshing::after{animation:none}}
.partner-invite-empty { margin-top: 24rpx; padding: 38rpx 30rpx 30rpx; text-align: center; background: linear-gradient(145deg,#fff,#fff5ed); }.partner-invite-empty__icon{display:flex;width:82rpx;height:82rpx;margin:0 auto;align-items:center;justify-content:center;border-radius:28rpx;background:#eaf2f8;color:#607f98}.partner-invite-empty__title,.partner-invite-empty__desc{display:block}.partner-invite-empty__title{margin-top:22rpx;font-size:30rpx;font-weight:750}.partner-invite-empty__desc{margin:12rpx auto 0;color:#81736f;font-size:22rpx;line-height:1.65}.binding-mode{display:flex;margin-top:26rpx;padding:6rpx;border-radius:20rpx;background:#efe5df}.binding-mode button{display:flex;height:64rpx;flex:1;align-items:center;justify-content:center;border-radius:16rpx;background:transparent;color:#897a76;font-size:23rpx;line-height:1}.binding-mode button.active{background:#fff;color:#9c564d;font-weight:700;box-shadow:0 5rpx 15rpx rgba(90,65,55,.08)}.invite-code-box,.invite-enter-box{margin-top:20rpx;padding:23rpx;border:1rpx dashed #dfc8bb;border-radius:24rpx;background:#fffaf6}.invite-code-box__label,.invite-code-box__value,.invite-code-box__status,.invite-code-box__tip{display:block}.invite-code-box__label{color:#8b7c77;font-size:20rpx}.invite-code-box__value{margin-top:10rpx;color:#77483f;font-size:38rpx;font-weight:800;letter-spacing:5rpx}.invite-code-box__status{margin-top:12rpx;color:#897a76;font-size:23rpx}.invite-code-box__tip{margin-top:10rpx;color:#9d8e8a;font-size:19rpx}.invite-code-input{height:88rpx;margin-top:16rpx;border:1rpx solid #e8d9d1;border-radius:21rpx;background:#fff;color:#674842;font-size:29rpx;font-weight:750;letter-spacing:3rpx;text-align:center}.invite-copy{display:flex;min-height:80rpx;margin-top:22rpx;align-items:center;justify-content:center;border-radius:22rpx;background:#d87263;color:#fff;font-size:25rpx;font-weight:700;line-height:1}.invite-secondary{min-height:62rpx;margin:10rpx auto 0;background:transparent;color:#8f6058;font-size:22rpx;line-height:62rpx}.invite-copy[disabled],.invite-secondary[disabled]{opacity:.58}
</style>
