<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onReachBottom, onShow } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import RecordCard from '@/components/RecordCard.vue'
import SegmentControl from '@/components/SegmentControl.vue'
import { useArchiveStore } from '@/stores/archive'
import type { AuthorId } from '@/types/domain'
import { getTodayMoodStatus, listMoods, type MoodListScope, type TodayMoodStatus } from '@/api/moods'
import { acceptRelationshipInvite, createRelationshipInvite, getCurrentRelationship } from '@/api/relationships'
import { addReaction, removeReaction } from '@/api/reactions'
import { getMoodDetail } from '@/api/moods'
import { syncTabBarSelection } from '@/utils/tab-bar'

const store = useArchiveStore()
type ArchiveFilter = 'all' | 'me' | 'partner'
const filter = ref<ArchiveFilter>('all')
const refreshKey = ref(0)
const recordsLoading = ref(false)
const loadingMore = ref(false)
const recordsError = ref('')
const loadMoreError = ref('')
const currentPage = ref(1)
const recordsTotal = ref(0)
const pageSize = 10
const todayStatus = ref<TodayMoodStatus | null>(null)
const inviteLoading = ref(false)
const inviteError = ref('')
const bindingMode = ref<'invite' | 'enter'>('invite')
const inviteInput = ref('')
const bindingLoading = ref(false)
let loadRequestId = 0

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

const listScope = computed<MoodListScope>(() => {
  if (filter.value === 'me') return 'mine'
  return filter.value
})
const hasMore = computed(() => store.records.length < recordsTotal.value)
const showListEnd = computed(() => !hasMore.value && recordsTotal.value >= pageSize)

const loadRecords = async () => {
  const requestId = ++loadRequestId
  if (!store.user.isLoggedIn) {
    store.replaceRecords([])
    store.setCurrentRelationship({ active: false, relationship: null })
    recordsTotal.value = 0
    currentPage.value = 1
    todayStatus.value = null
    recordsError.value = ''
    loadMoreError.value = ''
    return
  }
  recordsLoading.value = true
  recordsError.value = ''
  loadMoreError.value = ''
  try {
    const [moodPage, statusResult, relationshipResult] = await Promise.all([
      listMoods({ page: 1, pageSize, scope: listScope.value }, store.user.id),
      getTodayMoodStatus(),
      getCurrentRelationship(),
    ])
    if (requestId !== loadRequestId || !store.user.isLoggedIn) return
    store.replaceRecords(moodPage.items)
    currentPage.value = moodPage.pagination.page
    recordsTotal.value = moodPage.pagination.total
    todayStatus.value = statusResult
    store.setCurrentRelationship(relationshipResult)
    if (filter.value === 'partner' && !relationshipResult.active) void ensureInviteCode()
    refreshKey.value++
  } catch (error) {
    if (requestId !== loadRequestId || !store.user.isLoggedIn) return
    recordsError.value = error instanceof Error ? error.message : '心情列表加载失败'
  } finally {
    recordsLoading.value = false
  }
}

const loadMoreRecords = async () => {
  if (!store.user.isLoggedIn || recordsLoading.value || loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  loadMoreError.value = ''
  try {
    const moodPage = await listMoods(
      { page: currentPage.value + 1, pageSize, scope: listScope.value },
      store.user.id,
    )
    store.appendRecords(moodPage.items)
    currentPage.value = moodPage.pagination.page
    recordsTotal.value = moodPage.pagination.total
  } catch (error) {
    loadMoreError.value = error instanceof Error ? error.message : '加载更多心情失败'
  } finally {
    loadingMore.value = false
  }
}

onShow(() => {
  syncTabBarSelection()
  void loadRecords()
})
onReachBottom(loadMoreRecords)

const filters = [
  { label: '全部', value: 'all' }, { label: '我的', value: 'me' }, { label: 'TA 的', value: 'partner' },
]
const records = computed(() => {
  refreshKey.value
  return store.visibleFeed
})
const isUnboundPartnerView = computed(() => store.user.isLoggedIn && filter.value === 'partner' && !store.activeRelationship)
const myTodayMoodId = computed(() => todayStatus.value?.mine?.id || null)
const partnerTodayMoodId = computed(() => todayStatus.value?.partner.id || null)

const openRecord = (id: string) => uni.navigateTo({ url: `/pages/record/detail?id=${id}` })
const respondToMood = async (id: string) => {
  const record = store.recordById(id)
  if (!record) return
  if (record.authorId === 'me') {
    uni.showToast({ title: '这是你自己的心情', icon: 'none' })
    return
  }
  try {
    const hasReacted = record.mood === 'happy' ? record.likedByPartner : record.huggedByPartner
    if (hasReacted) await removeReaction(id)
    else await addReaction(id)
    store.upsertRecord(await getMoodDetail(id, store.user.id))
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '回应失败，请稍后重试', icon: 'none' })
  }
}
const goLogin = (target: 'create' | 'binding' | 'profile') => uni.navigateTo({ url: `/pages/login/index?target=${target}` })
const goCreate = () => store.user.isLoggedIn ? uni.switchTab({ url: '/pages/create/index' }) : goLogin('create')
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
  const normalizedCode = inviteInput.value.trim().toUpperCase()
  if (!/^LOVE-[A-Z2-9]{6}$/.test(normalizedCode)) {
    uni.showToast({ title: '请输入完整有效的邀请码', icon: 'none' })
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
        await loadRecords()
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
  store.replaceRecords([])
  recordsTotal.value = 0
  void loadRecords()
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
        <view class="paired-avatar paired-avatar--partner">{{ store.activeRelationship?.partnerInitial || '?' }}</view>
      </view>
    </view>

    <view v-if="store.activeRelationship" class="bond-card card" @tap="goBinding">
      <view class="bond-card__icon"><text class="bond-heart">♥</text></view>
      <view class="bond-card__copy">
        <text class="bond-card__title">正在和 {{ store.activeRelationship.partnerName }} 共同存档</text>
        <text class="bond-card__desc">已彼此陪伴 {{ store.activeRelationship.daysTogether || 1 }} 天</text>
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
        <view class="inbox-avatar inbox-avatar--partner">{{ store.activeRelationship?.partnerInitial || '?' }}</view>
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
      <button class="quick-add" @tap="goCreate"><AppIcon name="plus" :size="17" />记录</button>
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
          <input v-model="inviteInput" class="invite-code-input" maxlength="11" placeholder="例如 LOVE-A7K9Q2" confirm-type="done" @confirm="acceptInvite" />
          <text class="invite-code-box__tip">绑定前的记录不会自动向对方公开</text>
        </view>
        <button class="invite-copy" :loading="bindingLoading" :disabled="bindingLoading" @tap="acceptInvite">确认并绑定</button>
      </template>
    </view>
    <view v-else-if="records.length" class="feed">
      <RecordCard v-for="record in records" :key="record.id" :record="record" @respond="respondToMood" @open="openRecord" />
      <view class="feed-footer">
        <text v-if="loadingMore">正在打开更早的心情…</text>
        <button v-else-if="loadMoreError" @tap="loadMoreRecords">加载失败，点击重试</button>
        <text v-else-if="showListEnd">已经看完所有心情了</text>
      </view>
    </view>
    <view v-else-if="recordsLoading" class="empty-state card">
      <text class="empty-state__title">正在打开你的心情存档</text>
      <text class="empty-state__desc">请稍等一下。</text>
    </view>
    <view v-else-if="recordsError" class="empty-state card">
      <text class="empty-state__title">心情存档暂时没有打开</text>
      <text class="empty-state__desc">{{ recordsError }}</text>
      <button class="retry-button" @tap="loadRecords">重新加载</button>
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
.inbox-action { display: flex; width: 124rpx; height: 66rpx; gap: 4rpx; flex: none; margin-left: 12rpx; padding: 0 8rpx; box-sizing: border-box; align-items: center; justify-content: center; border-radius: 19rpx; background: #fff1e8; color: #9f5f54; font-size: 21rpx; font-weight: 650; text-align: center; }
.inbox-action>text { display: flex; height: 100%; flex: none; align-items: center; justify-content: center; line-height: 1; text-align: center; }
.inbox-action__icon { display: flex; width: 30rpx; height: 30rpx; flex: none; align-items: center; justify-content: center; line-height: 1; }
.inbox-action--partner { background: #edf4f9; color: #607f98; }
.feed-heading { display: flex; margin-top: 42rpx; align-items: center; justify-content: space-between; }
.feed-heading .section-title { margin: 0; }
.quick-add { display: flex; gap: 5rpx; min-height: 60rpx; padding: 0 8rpx; align-items: center; background: transparent; color: #a84f45; font-size: 25rpx; font-weight: 700; }
.feed-heading + :deep(.segments) { margin-top: 20rpx; }
.feed { display: grid; gap: 24rpx; margin-top: 24rpx; }
.feed-footer { display: flex; min-height: 72rpx; align-items: center; justify-content: center; color: #948681; font-size: 21rpx; text-align: center; }
.feed-footer button { min-height: 64rpx; padding: 0 24rpx; background: transparent; color: #a45e53; font-size: 21rpx; line-height: 64rpx; }
.empty-state { margin-top: 22rpx; }
.retry-button, .empty-create { display: flex; min-height: 72rpx; margin: 22rpx auto 0; padding: 0 28rpx; align-items: center; justify-content: center; border-radius: 20rpx; background: #d87263; color: #fff; font-size: 23rpx; font-weight: 700; line-height: 1; }
.partner-invite-empty { margin-top: 24rpx; padding: 38rpx 30rpx 30rpx; text-align: center; background: linear-gradient(145deg,#fff,#fff5ed); }.partner-invite-empty__icon{display:flex;width:82rpx;height:82rpx;margin:0 auto;align-items:center;justify-content:center;border-radius:28rpx;background:#eaf2f8;color:#607f98}.partner-invite-empty__title,.partner-invite-empty__desc{display:block}.partner-invite-empty__title{margin-top:22rpx;font-size:30rpx;font-weight:750}.partner-invite-empty__desc{margin:12rpx auto 0;color:#81736f;font-size:22rpx;line-height:1.65}.binding-mode{display:flex;margin-top:26rpx;padding:6rpx;border-radius:20rpx;background:#efe5df}.binding-mode button{display:flex;height:64rpx;flex:1;align-items:center;justify-content:center;border-radius:16rpx;background:transparent;color:#897a76;font-size:23rpx;line-height:1}.binding-mode button.active{background:#fff;color:#9c564d;font-weight:700;box-shadow:0 5rpx 15rpx rgba(90,65,55,.08)}.invite-code-box,.invite-enter-box{margin-top:20rpx;padding:23rpx;border:1rpx dashed #dfc8bb;border-radius:24rpx;background:#fffaf6}.invite-code-box__label,.invite-code-box__value,.invite-code-box__status,.invite-code-box__tip{display:block}.invite-code-box__label{color:#8b7c77;font-size:20rpx}.invite-code-box__value{margin-top:10rpx;color:#77483f;font-size:38rpx;font-weight:800;letter-spacing:5rpx}.invite-code-box__status{margin-top:12rpx;color:#897a76;font-size:23rpx}.invite-code-box__tip{margin-top:10rpx;color:#9d8e8a;font-size:19rpx}.invite-code-input{height:88rpx;margin-top:16rpx;border:1rpx solid #e8d9d1;border-radius:21rpx;background:#fff;color:#674842;font-size:29rpx;font-weight:750;letter-spacing:3rpx;text-align:center}.invite-copy{display:flex;min-height:80rpx;margin-top:22rpx;align-items:center;justify-content:center;border-radius:22rpx;background:#d87263;color:#fff;font-size:25rpx;font-weight:700;line-height:1}.invite-secondary{min-height:62rpx;margin:10rpx auto 0;background:transparent;color:#8f6058;font-size:22rpx;line-height:62rpx}.invite-copy[disabled],.invite-secondary[disabled]{opacity:.58}
</style>
