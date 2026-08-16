<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import MoodMark from '@/components/MoodMark.vue'
import SegmentControl from '@/components/SegmentControl.vue'
import { useArchiveStore } from '@/stores/archive'
import { getInsightSummary, type InsightPeriod, type InsightSubject, type InsightSummary } from '@/api/insights'
import { getCurrentRelationship } from '@/api/relationships'
import { syncTabBarSelection } from '@/utils/tab-bar'

const store = useArchiveStore()
const owner = ref<InsightSubject>('mine')
const range = ref<InsightPeriod>('week')
const summary = ref<InsightSummary | null>(null)
const calendarSummary = ref<InsightSummary | null>(null)
const reportLoading = ref(store.user.isLoggedIn)
const reportReady = ref(false)
const reportError = ref('')
const ownerOptions = computed(() => [
  { label: '我的情绪', value: 'mine' },
  ...(store.activeRelationship ? [{ label: `${store.activeRelationship.partnerName} 的情绪`, value: 'partner' }] : []),
])
const ranges: Array<{ label: string; value: InsightPeriod }> = [
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
  { label: '三个月', value: 'three_months' },
]
const hasRecords = computed(() => (summary.value?.total || 0) > 0)

const rangeStart = computed(() => {
  const date = new Date()
  const daysBack = range.value === 'week' ? 6 : range.value === 'month' ? 29 : 89
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - daysBack)
  return date
})

const report = computed(() => {
  const data = summary.value
  return {
    happy: data?.happyRate || 0,
    sad: data?.sadRate || 0,
    total: data?.total || 0,
    common: data?.emotions[0]?.emotion || '暂无',
    response: data?.responseCount || 0,
  }
})

const periodLabel = computed(() => {
  const start = rangeStart.value
  const end = new Date()
  return `${start.getMonth() + 1}月${start.getDate()}日—${end.getMonth() + 1}月${end.getDate()}日`
})

const currentMonthLabel = computed(() => {
  const now = new Date()
  return `${now.getFullYear()}年${now.getMonth() + 1}月`
})

const days = computed(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const mondayOffset = (new Date(year, month, 1).getDay() + 6) % 7
  const cells = Array.from({ length: mondayOffset }, () => ({ day: '', mood: '' }))
  for (let day = 1; day <= daysInMonth; day++) {
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const item = calendarSummary.value?.calendar.find((entry) => entry.date === dateString)
    cells.push({ day: String(day), mood: item && item.happy + item.sad ? (item.happy >= item.sad ? 'happy' : 'sad') : '' })
  }
  return cells
})

const loadReport = async () => {
  if (!store.user.isLoggedIn) {
    summary.value = null
    return
  }
  reportLoading.value = true
  reportError.value = ''
  try {
    const current = await getCurrentRelationship()
    store.setCurrentRelationship(current)
    if (owner.value === 'partner' && !current.active) owner.value = 'mine'
    const [reportResult, calendarResult] = await Promise.all([
      getInsightSummary(range.value, owner.value),
      getInsightSummary('month', owner.value),
    ])
    summary.value = reportResult
    calendarSummary.value = calendarResult
  } catch (error) {
    reportError.value = error instanceof Error ? error.message : '情绪报告加载失败'
  } finally {
    reportLoading.value = false
    reportReady.value = true
  }
}

onShow(() => {
  syncTabBarSelection()
  void loadReport()
})
watch([owner, range], loadReport)
</script>

<template>
  <view class="page-shell insights-page">
    <view class="insights-head">
      <text class="eyebrow">LOOKING BACK</text>
      <text class="insights-head__title">看见情绪，也看见自己</text>
      <text class="insights-head__desc">统计只是一面小镜子，不为情绪打分。</text>
    </view>

    <view v-if="reportLoading && !reportReady" class="insights-skeleton" aria-label="正在整理情绪报告">
      <view class="skeleton-block skeleton-owner" />

      <view class="section-heading calendar-heading">
        <view><view class="skeleton-block skeleton-line skeleton-heading-title" /><view class="skeleton-block skeleton-line skeleton-heading-desc" /></view>
        <view class="skeleton-block skeleton-line skeleton-legend" />
      </view>
      <view class="calendar-card card skeleton-card">
        <view class="week-row"><text v-for="item in ['一','二','三','四','五','六','日']" :key="item">{{ item }}</text></view>
        <view class="days-grid"><view v-for="item in 42" :key="item" class="day skeleton-block skeleton-day" /></view>
      </view>

      <view class="range-tabs skeleton-tabs">
        <view v-for="item in 3" :key="item" class="skeleton-block skeleton-pill" />
      </view>

      <view class="overview card skeleton-card skeleton-overview">
        <view class="overview__head"><view><view class="skeleton-block skeleton-line skeleton-kicker" /><view class="skeleton-block skeleton-line skeleton-overview-title" /></view><view class="skeleton-block skeleton-line skeleton-period" /></view>
        <view class="skeleton-balance"><view class="skeleton-block skeleton-mood" /><view class="skeleton-block skeleton-mood" /></view>
        <view class="skeleton-block skeleton-bar" />
        <view class="skeleton-block skeleton-line skeleton-note" />
      </view>

      <view class="stats-grid">
        <view v-for="item in 4" :key="item" class="stat-card card skeleton-card skeleton-stat"><view class="skeleton-block skeleton-stat-icon" /><view class="skeleton-block skeleton-line skeleton-stat-value" /><view class="skeleton-block skeleton-line skeleton-stat-label" /></view>
      </view>
    </view>
    <view v-else-if="reportError && !summary" class="empty-state card insights-empty">
      <text class="empty-state__title">情绪报告暂时无法打开</text>
      <text class="empty-state__desc">{{ reportError }}</text>
      <button class="report-retry" @tap="loadReport">重新加载</button>
    </view>
    <template v-else-if="hasRecords">
    <view class="report-content" :class="{ 'report-content--refreshing': reportLoading }">
    <SegmentControl v-model="owner" :options="ownerOptions" class="owner-switch" />

    <view class="section-heading calendar-heading"><view><text class="section-title">情绪日历</text><text class="section-desc">{{ currentMonthLabel }}</text></view><view class="calendar-legend"><span><i class="happy"/>开心</span><span><i class="sad"/>难过</span></view></view>
    <view class="calendar-card card">
      <view class="week-row"><text v-for="item in ['一','二','三','四','五','六','日']" :key="item">{{ item }}</text></view>
      <view class="days-grid">
        <view v-for="(item, index) in days" :key="index" class="day" :class="item.mood ? `day--${item.mood}` : ''"><text>{{ item.day }}</text><i v-if="item.mood" /></view>
      </view>
    </view>

    <view class="range-tabs">
      <button v-for="item in ranges" :key="item.value" :class="{ active: range === item.value }" @tap="range = item.value">{{ item.label }}</button>
    </view>

    <view class="overview card">
      <view class="overview__head">
        <view><text class="card-kicker">情绪天气</text><text class="overview__title">{{ report.total ? '这一段心情的样子' : '还没有记录' }}</text></view>
        <text class="overview__period">{{ periodLabel }}</text>
      </view>
      <view class="mood-balance">
        <view class="mood-stat"><MoodMark mood="happy" size="medium" /><view><text class="mood-stat__value">{{ report.happy }}%</text><text class="mood-stat__label">开心时刻</text></view></view>
        <view class="mood-stat"><MoodMark mood="sad" size="medium" /><view><text class="mood-stat__value">{{ report.sad }}%</text><text class="mood-stat__label">难过时刻</text></view></view>
      </view>
      <view class="balance-bar"><view class="balance-bar__happy" :style="{ width: `${report.happy}%` }" /><view class="balance-bar__sad" /></view>
      <text class="gentle-note">{{ report.total ? '每一种感受，都在认真地告诉你什么。' : '写下第一条心情后，这里会慢慢形成属于你的回顾。' }}</text>
    </view>

    <view class="stats-grid">
      <view class="stat-card card"><view class="stat-icon stat-icon--warm"><AppIcon name="calendar" :size="20" /></view><text class="stat-value">{{ report.total }}</text><text class="stat-label">记录次数</text></view>
      <view class="stat-card card"><view class="stat-icon stat-icon--blue"><AppIcon name="trend" :size="20" /></view><text class="stat-value">{{ report.total ? '已开始' : '0 天' }}</text><text class="stat-label">记录状态</text></view>
      <view class="stat-card card"><view class="stat-icon stat-icon--warm"><MoodMark mood="happy" size="small" /></view><text class="stat-value">{{ report.common }}</text><text class="stat-label">常见感受</text></view>
      <view class="stat-card card"><view class="stat-icon stat-icon--blue"><AppIcon name="hug" :size="20" /></view><text class="stat-value">{{ report.response }}</text><text class="stat-label">收到回应</text></view>
    </view>

    <view class="privacy-tip"><AppIcon name="lock" :size="14" /><text>{{ owner === 'mine' ? '这里包含你的全部记录；仅自己可见的内容不会进入 TA 看到的统计。' : '你只能看到 TA 在本段关系中对你公开的记录统计。' }}</text></view>
    </view>
    </template>
    <view v-else class="empty-state card insights-empty">
      <text class="empty-state__title">还没有可回顾的心情</text>
      <text class="empty-state__desc">{{ store.user.isLoggedIn ? '写下第一条记录后，情绪日历会从真实数据中慢慢出现。' : '登录后可以查看你的情绪报告。' }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.insights-page { padding-bottom: calc(112rpx + env(safe-area-inset-bottom)); }
.insights-head { padding: 12rpx 2rpx 34rpx; }
.insights-head__title { display: block; margin-top: 18rpx; font-size: 46rpx; font-weight: 750; }
.insights-head__desc { display: block; margin-top: 14rpx; color: #746663; font-size: 24rpx; }
.report-retry { display:flex;min-height:72rpx;margin:22rpx auto 0;padding:0 28rpx;align-items:center;justify-content:center;border-radius:20rpx;background:#d87263;color:#fff;font-size:23rpx;font-weight:700;line-height:1; }
.range-tabs { display: flex; gap: 14rpx; margin: 28rpx 0; }
.range-tabs button { display: flex; height: 62rpx; padding: 0 28rpx; align-items: center; justify-content: center; border-radius: 999rpx; background: #fff; color: #897a76; font-size: 23rpx; line-height: 1; text-align: center; }
.range-tabs button.active { background: #d87263; color: #fff; font-weight: 700; }
.overview { margin-top: 24rpx; padding: 30rpx; }
.overview__head, .mood-balance, .section-heading, .legend, .calendar-legend, .calendar-legend span, .privacy-tip { display: flex; align-items: center; }
.overview__head, .section-heading { justify-content: space-between; }
.card-kicker { display: block; color: #a26a60; font-size: 21rpx; font-weight: 700; }
.overview__title { display: block; margin-top: 6rpx; font-size: 31rpx; font-weight: 750; }
.overview__period { color: #817471; font-size: 20rpx; }
.mood-balance { justify-content: space-between; margin-top: 30rpx; }
.mood-stat { display: flex; gap: 13rpx; align-items: center; }
.mood-stat__value, .mood-stat__label { display: block; }
.mood-stat__value { font-size: 32rpx; font-weight: 750; }
.mood-stat__label { margin-top: 3rpx; color: #8f817d; font-size: 20rpx; }
.balance-bar { display: flex; height: 16rpx; margin-top: 24rpx; overflow: hidden; border-radius: 99rpx; background: #d8e4ef; }
.balance-bar__happy { height: 100%; border-radius: 99rpx; background: #f3ae83; transition: width .25s ease; }
.balance-bar__sad { flex: 1; }
.gentle-note { display: block; margin-top: 21rpx; color: #706360; font-size: 22rpx; line-height: 1.7; }
.section-heading { margin-top: 44rpx; }
.section-heading .section-title { display: block; margin: 0; }
.section-desc { display: block; margin-top: 7rpx; color: #9b8c88; font-size: 21rpx; }
.week-row { display: grid; grid-template-columns: repeat(7, 1fr); color: #9e8f8a; font-size: 19rpx; text-align: center; }
.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18rpx; margin-top: 24rpx; }
.stat-card { padding: 24rpx; }.stat-icon { display: flex; width: 57rpx; height: 57rpx; align-items: center; justify-content: center; border-radius: 19rpx; }.stat-icon--warm{background:#fff0e6;color:#a96858}.stat-icon--blue{background:#eaf1f7;color:#67829b}
.stat-value,.stat-label{display:block}.stat-value{margin-top:16rpx;font-size:31rpx;font-weight:750}.stat-label{margin-top:5rpx;color:#938480;font-size:21rpx}
.calendar-heading { margin-top: 28rpx; }
.owner-switch { margin-top: 0; }
.calendar-legend { gap: 14rpx; color: #8f807c; font-size: 19rpx; }.calendar-legend span{gap:5rpx}.calendar-legend i{width:12rpx;height:12rpx;border-radius:50%}.calendar-legend .happy{background:#f0a477}.calendar-legend .sad{background:#91aeca}
.calendar-card { margin-top: 18rpx; padding: 25rpx 20rpx; }.week-row{margin-bottom:14rpx}.days-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:8rpx}.day{display:flex;height:68rpx;flex-direction:column;align-items:center;justify-content:center;border-radius:18rpx;color:#736461;font-size:22rpx}.day i{width:8rpx;height:8rpx;margin-top:5rpx;border-radius:50%;background:currentColor}.day--happy{background:#fff0e3;color:#a76848}.day--sad{background:#e9f0f6;color:#5e7890}
.privacy-tip { gap: 10rpx; margin: 22rpx 8rpx 0; align-items: flex-start; color: #958682; font-size: 20rpx; line-height: 1.6; }
.insights-skeleton,.report-content{display:block}.skeleton-block{overflow:hidden;background:linear-gradient(100deg,#f3e6e4 20%,#fbeeed 42%,#f3e6e4 64%);background-size:220% 100%;animation:skeleton-shimmer 1.35s ease-in-out infinite}.skeleton-line{border-radius:999rpx}.skeleton-owner{height:80rpx;border-radius:22rpx}.skeleton-heading-title{width:142rpx;height:36rpx}.skeleton-heading-desc{width:122rpx;height:21rpx;margin-top:7rpx}.skeleton-legend{width:136rpx;height:24rpx}.skeleton-card{pointer-events:none}.skeleton-day{border-radius:18rpx}.skeleton-tabs{align-items:center}.skeleton-pill{width:112rpx;height:62rpx;border-radius:999rpx}.skeleton-overview{min-height:330rpx}.skeleton-kicker{width:94rpx;height:21rpx}.skeleton-overview-title{width:238rpx;height:31rpx;margin-top:6rpx}.skeleton-period{width:170rpx;height:20rpx}.skeleton-balance{display:flex;margin-top:30rpx;align-items:center;justify-content:space-between}.skeleton-mood{width:205rpx;height:72rpx;border-radius:22rpx}.skeleton-bar{height:16rpx;margin-top:24rpx;border-radius:99rpx}.skeleton-note{width:78%;height:22rpx;margin-top:21rpx}.skeleton-stat{min-height:190rpx}.skeleton-stat-icon{width:57rpx;height:57rpx;border-radius:19rpx}.skeleton-stat-value{width:92rpx;height:31rpx;margin-top:16rpx}.skeleton-stat-label{width:106rpx;height:21rpx;margin-top:5rpx}.report-content--refreshing .calendar-card,.report-content--refreshing .overview,.report-content--refreshing .stat-card{position:relative;overflow:hidden;pointer-events:none}.report-content--refreshing .calendar-card::after,.report-content--refreshing .overview::after,.report-content--refreshing .stat-card::after{position:absolute;z-index:2;inset:0;content:'';background:linear-gradient(100deg,rgba(255,250,248,.34) 20%,rgba(245,226,225,.72) 42%,rgba(255,250,248,.34) 64%);background-size:220% 100%;animation:skeleton-shimmer 1.35s ease-in-out infinite}@keyframes skeleton-shimmer{to{background-position:-220% 0}}
@media (prefers-reduced-motion: reduce) { .balance-bar__happy { transition: none; }.skeleton-block,.report-content--refreshing .calendar-card::after,.report-content--refreshing .overview::after,.report-content--refreshing .stat-card::after{animation:none} }
</style>
