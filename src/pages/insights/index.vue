<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { onReady } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import MoodMark from '@/components/MoodMark.vue'
import SegmentControl from '@/components/SegmentControl.vue'
import { useArchiveStore } from '@/stores/archive'

const store = useArchiveStore()
const owner = ref('me')
const range = ref('week')
const ownerOptions = computed(() => [
  { label: '我的情绪', value: 'me' },
  ...(store.activeRelationship ? [{ label: `${store.activeRelationship.partnerName} 的情绪`, value: 'partner' }] : []),
])
const ranges = [{ label: '本周', value: 'week' }, { label: '本月', value: 'month' }, { label: '三个月', value: 'quarter' }]

const ownerRecords = computed(() => store.visibleFeed.filter((record) => record.authorId === owner.value))
const hasRecords = computed(() => store.visibleFeed.length > 0)

const rangeStart = computed(() => {
  const date = new Date()
  const daysBack = range.value === 'week' ? 6 : range.value === 'month' ? 29 : 89
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - daysBack)
  return date
})

const selectedRecords = computed(() => ownerRecords.value.filter((record) => {
  const date = new Date(record.recordDate.replace(/-/g, '/'))
  return date >= rangeStart.value
}))

const report = computed(() => {
  const records = selectedRecords.value
  const happyCount = records.filter((record) => record.mood === 'happy').length
  const sadCount = records.length - happyCount
  const emotionCounts = records.reduce<Record<string, number>>((counts, record) => {
    counts[record.emotion] = (counts[record.emotion] || 0) + 1
    return counts
  }, {})
  const common = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '暂无'
  const response = records.reduce((total, record) => total + record.comments.length + Number(record.likedByPartner || record.huggedByPartner), 0)
  const line = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const dailyRecords = records.filter((record) => record.recordDate === dateString)
    if (!dailyRecords.length) return 50
    return Math.round(dailyRecords.reduce((sum, record) => sum + (record.mood === 'happy' ? 75 : 25), 0) / dailyRecords.length)
  })
  return {
    happy: records.length ? Math.round(happyCount / records.length * 100) : 0,
    sad: records.length ? Math.round(sadCount / records.length * 100) : 0,
    total: records.length,
    common,
    response,
    line,
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
    const dailyRecords = ownerRecords.value.filter((record) => record.recordDate === dateString)
    const happyCount = dailyRecords.filter((record) => record.mood === 'happy').length
    cells.push({ day: String(day), mood: dailyRecords.length ? (happyCount >= dailyRecords.length / 2 ? 'happy' : 'sad') : '' })
  }
  return cells
})

const chartWidth = ref(320)
const chartDisplayWidth = ref(320)
const chartHeight = 150

const drawTrend = () => {
  if (!selectedRecords.value.length) return
  const values = report.value.line
  const context = uni.createCanvasContext('moodTrend')
  const horizontalPadding = 12
  const verticalPadding = 14
  const usableWidth = chartWidth.value - horizontalPadding * 2
  const usableHeight = chartHeight - verticalPadding * 2
  const points = values.map((value, index) => ({
    x: horizontalPadding + (usableWidth / (values.length - 1)) * index,
    y: verticalPadding + usableHeight * (1 - value / 100),
  }))

  context.beginPath()
  context.moveTo(points[0]?.x ?? 0, chartHeight - verticalPadding)
  points.forEach((point) => context.lineTo(point.x, point.y))
  context.lineTo(points[points.length - 1]?.x ?? chartWidth.value, chartHeight - verticalPadding)
  context.closePath()
  context.setFillStyle('rgba(231, 154, 126, 0.18)')
  context.fill()

  context.beginPath()
  points.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y))
  context.setStrokeStyle('#d97967')
  context.setLineWidth(2.5)
  context.setLineCap('round')
  context.setLineJoin('round')
  context.stroke()

  points.forEach((point) => {
    context.beginPath()
    context.arc(point.x, point.y, 4, 0, Math.PI * 2)
    context.setFillStyle('#fff9f2')
    context.fill()
    context.setStrokeStyle('#d97967')
    context.setLineWidth(2)
    context.stroke()
  })
  context.draw()
}

onReady(() => {
  const windowWidth = uni.getSystemInfoSync().windowWidth
  chartWidth.value = Math.max(260, windowWidth - 72)
  chartDisplayWidth.value = chartWidth.value
  nextTick(drawTrend)
})

watch([owner, range, selectedRecords], () => nextTick(drawTrend))
</script>

<template>
  <view class="page-shell insights-page">
    <view class="insights-head">
      <text class="eyebrow">LOOKING BACK</text>
      <text class="insights-head__title">看见情绪，也看见自己</text>
      <text class="insights-head__desc">统计只是一面小镜子，不为情绪打分。</text>
    </view>

    <template v-if="hasRecords">
    <SegmentControl v-model="owner" :options="ownerOptions" />
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

    <view class="section-heading"><view><text class="section-title">情绪趋势</text><text class="section-desc">一天一天，慢慢看见变化</text></view><view class="legend"><i /><text>心情能量</text></view></view>
    <view class="chart-card card">
      <view class="chart-area">
        <view v-for="line in 4" :key="line" class="grid-line" :style="{ top: `${line * 21}%` }" />
        <canvas canvas-id="moodTrend" id="moodTrend" class="trend-canvas" :style="{ width: `${chartDisplayWidth}px`, height: `${chartHeight}px` }" />
      </view>
      <view class="chart-labels"><text v-for="day in ['一','二','三','四','五','六','日']" :key="day">周{{ day }}</text></view>
    </view>

    <view class="stats-grid">
      <view class="stat-card card"><view class="stat-icon stat-icon--warm"><AppIcon name="calendar" :size="20" /></view><text class="stat-value">{{ report.total }}</text><text class="stat-label">记录次数</text></view>
      <view class="stat-card card"><view class="stat-icon stat-icon--blue"><AppIcon name="trend" :size="20" /></view><text class="stat-value">{{ report.total ? '已开始' : '0 天' }}</text><text class="stat-label">记录状态</text></view>
      <view class="stat-card card"><view class="stat-icon stat-icon--warm"><MoodMark mood="happy" size="small" /></view><text class="stat-value">{{ report.common }}</text><text class="stat-label">常见感受</text></view>
      <view class="stat-card card"><view class="stat-icon stat-icon--blue"><AppIcon name="hug" :size="20" /></view><text class="stat-value">{{ report.response }}</text><text class="stat-label">收到回应</text></view>
    </view>

    <view class="section-heading calendar-heading"><view><text class="section-title">情绪日历</text><text class="section-desc">{{ currentMonthLabel }}</text></view><view class="calendar-legend"><span><i class="happy"/>开心</span><span><i class="sad"/>难过</span></view></view>
    <view class="calendar-card card">
      <view class="week-row"><text v-for="item in ['一','二','三','四','五','六','日']" :key="item">{{ item }}</text></view>
      <view class="days-grid">
        <view v-for="(item, index) in days" :key="index" class="day" :class="item.mood ? `day--${item.mood}` : ''"><text>{{ item.day }}</text><i v-if="item.mood" /></view>
      </view>
    </view>
    <view class="privacy-tip"><AppIcon name="lock" :size="14" /><text>{{ owner === 'me' ? '这里包含你的全部记录；仅自己可见的内容不会进入 TA 看到的统计。' : '你只能看到 TA 在本段关系中对你公开的记录统计。' }}</text></view>
    </template>
    <view v-else class="empty-state card insights-empty">
      <text class="empty-state__title">还没有可回顾的心情</text>
      <text class="empty-state__desc">写下第一条记录后，趋势和情绪日历会从真实数据中慢慢出现。</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.insights-page { padding-bottom: calc(112rpx + env(safe-area-inset-bottom)); }
.insights-head { padding: 12rpx 2rpx 34rpx; }
.insights-head__title { display: block; margin-top: 18rpx; font-size: 46rpx; font-weight: 750; }
.insights-head__desc { display: block; margin-top: 14rpx; color: #746663; font-size: 24rpx; }
.range-tabs { display: flex; gap: 14rpx; margin: 28rpx 0; }
.range-tabs button { display: flex; height: 62rpx; padding: 0 28rpx; align-items: center; justify-content: center; border-radius: 999rpx; background: #fff; color: #897a76; font-size: 23rpx; line-height: 1; text-align: center; }
.range-tabs button.active { background: #d87263; color: #fff; font-weight: 700; }
.overview { padding: 30rpx; }
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
.legend { gap: 7rpx; color: #978782; font-size: 20rpx; }.legend i { width: 20rpx; height: 6rpx; border-radius: 5rpx; background: #d97967; }
.chart-card { margin-top: 20rpx; padding: 28rpx 22rpx 20rpx; }
.chart-area { position: relative; height: 270rpx; overflow: hidden; }
.grid-line { position: absolute; right: 0; left: 0; border-top: 1rpx dashed #ebdfd8; }
.trend-canvas { position: absolute; top: 0; left: 0; }
.chart-labels, .week-row { display: grid; grid-template-columns: repeat(7, 1fr); color: #9e8f8a; font-size: 19rpx; text-align: center; }
.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18rpx; margin-top: 24rpx; }
.stat-card { padding: 24rpx; }.stat-icon { display: flex; width: 57rpx; height: 57rpx; align-items: center; justify-content: center; border-radius: 19rpx; }.stat-icon--warm{background:#fff0e6;color:#a96858}.stat-icon--blue{background:#eaf1f7;color:#67829b}
.stat-value,.stat-label{display:block}.stat-value{margin-top:16rpx;font-size:31rpx;font-weight:750}.stat-label{margin-top:5rpx;color:#938480;font-size:21rpx}
.calendar-heading { margin-top: 40rpx; }
.calendar-legend { gap: 14rpx; color: #8f807c; font-size: 19rpx; }.calendar-legend span{gap:5rpx}.calendar-legend i{width:12rpx;height:12rpx;border-radius:50%}.calendar-legend .happy{background:#f0a477}.calendar-legend .sad{background:#91aeca}
.calendar-card { margin-top: 18rpx; padding: 25rpx 20rpx; }.week-row{margin-bottom:14rpx}.days-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:8rpx}.day{display:flex;height:68rpx;flex-direction:column;align-items:center;justify-content:center;border-radius:18rpx;color:#736461;font-size:22rpx}.day i{width:8rpx;height:8rpx;margin-top:5rpx;border-radius:50%;background:currentColor}.day--happy{background:#fff0e3;color:#a76848}.day--sad{background:#e9f0f6;color:#5e7890}
.privacy-tip { gap: 10rpx; margin: 22rpx 8rpx 0; align-items: flex-start; color: #958682; font-size: 20rpx; line-height: 1.6; }
@media (prefers-reduced-motion: reduce) { .balance-bar__happy { transition: none; } }
</style>
