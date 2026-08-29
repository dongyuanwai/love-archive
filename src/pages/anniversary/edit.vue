<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { Lunar, LunarYear, Solar } from 'lunar-javascript'
import AppIcon from '@/components/AppIcon.vue'
import SegmentControl from '@/components/SegmentControl.vue'
import { useAnniversaryStore, type AnniversaryDraft } from '@/stores/anniversary'
import { useArchiveStore } from '@/stores/archive'
import type { Anniversary, AnniversaryKind, AnniversaryRepeat, CalendarType, Visibility } from '@/types/domain'
import { anniversaryKindLabels } from '@/utils/anniversary'
import { todayString } from '@/utils/date'

const archiveStore = useArchiveStore()
const anniversaryStore = useAnniversaryStore()
const id = ref('')
const title = ref('')
const date = ref(todayString())
const kind = ref<AnniversaryKind>('relationship')
const calendarType = ref<CalendarType>('solar')
const repeat = ref<AnniversaryRepeat>('yearly')
const visibility = ref<Visibility>('private')
const note = ref('')
const reminderDaysBefore = ref<number[]>([0])
const initialLoading = ref(false)
const loadError = ref('')
const saving = ref(false)
const deleting = ref(false)

const todayParts = todayString().split('-').map(Number)
const currentLunar = Solar.fromYmd(todayParts[0] || 1970, todayParts[1] || 1, todayParts[2] || 1).getLunar()
const lunarYear = ref(currentLunar.getYear())
const lunarMonth = ref(currentLunar.getMonth())
const lunarDay = ref(currentLunar.getDay())
const lunarYears = Array.from({ length: 201 }, (_, index) => 1900 + index)
const lunarMonthNames = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月']
const lunarDayNames = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十']

const kinds = (Object.keys(anniversaryKindLabels) as AnniversaryKind[]).map((value) => ({ value, label: anniversaryKindLabels[value] }))
const calendarOptions = [{ label: '公历', value: 'solar' }, { label: '农历', value: 'lunar' }]
const repeatOptions = [{ label: '每年重复', value: 'yearly' }, { label: '仅这一次', value: 'once' }]
const reminderOptions = [
  { label: '当天', value: 0 },
  { label: '提前 1 天', value: 1 },
  { label: '提前 3 天', value: 3 },
  { label: '提前 1 周', value: 7 },
]
const visibilityOptions = computed(() => [
  ...(archiveStore.activeRelationship ? [{ label: '双方可见', value: 'partner' }] : []),
  { label: '仅自己', value: 'private' },
])
const isEditing = computed(() => Boolean(id.value))
const canSave = computed(() => Boolean(title.value.trim() && date.value && !saving.value && !initialLoading.value))
const lunarMonths = computed(() => {
  const leapMonth = LunarYear.fromYear(lunarYear.value).getLeapMonth()
  return Array.from({ length: 12 }, (_, index) => index + 1).flatMap((month) => [
    { value: month, label: lunarMonthNames[month - 1] || `${month}月` },
    ...(leapMonth === month ? [{ value: -month, label: `闰${lunarMonthNames[month - 1] || `${month}月`}` }] : []),
  ])
})
const lunarDayCount = computed(() => LunarYear.fromYear(lunarYear.value).getMonth(lunarMonth.value)?.getDayCount() || 29)
const lunarPickerRange = computed(() => [
  lunarYears.map((year) => `${year}年`),
  lunarMonths.value.map((month) => month.label),
  lunarDayNames.slice(0, lunarDayCount.value),
])
const lunarPickerValue = computed(() => [
  Math.max(0, lunarYears.indexOf(lunarYear.value)),
  Math.max(0, lunarMonths.value.findIndex((month) => month.value === lunarMonth.value)),
  Math.max(0, lunarDay.value - 1),
])
const lunarDateLabel = computed(() => {
  const month = lunarMonths.value.find((item) => item.value === lunarMonth.value)?.label || ''
  return `${lunarYear.value}年 ${month}${lunarDayNames[lunarDay.value - 1] || ''}`
})

onLoad((query) => { id.value = String(query?.id || '') })
const applyItem = (item: Anniversary) => {
  title.value = item.title
  date.value = item.date
  kind.value = item.kind
  calendarType.value = item.calendarType || 'solar'
  if (item.lunarYear && item.lunarMonth && item.lunarDay) {
    lunarYear.value = item.lunarYear
    lunarMonth.value = item.isLeapMonth ? -item.lunarMonth : item.lunarMonth
    lunarDay.value = item.lunarDay
  }
  repeat.value = item.repeat
  visibility.value = archiveStore.activeRelationship ? item.visibility : 'private'
  note.value = item.note
  reminderDaysBefore.value = item.reminderDaysBefore?.length ? [...item.reminderDaysBefore] : [0]
}
const loadEditingItem = async () => {
  if (!id.value) return
  anniversaryStore.prepareUser(archiveStore.user.id)
  const cached = anniversaryStore.itemById(id.value)
  if (cached) applyItem(cached)
  initialLoading.value = !cached
  loadError.value = ''
  try {
    applyItem(await anniversaryStore.loadDetail(id.value))
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '重要日子加载失败'
  } finally {
    initialLoading.value = false
  }
}
onShow(() => {
  if (!archiveStore.activeRelationship) visibility.value = 'private'
  if (!id.value) {
    if (archiveStore.activeRelationship) visibility.value = 'partner'
    return
  }
  void loadEditingItem()
})

const chooseKind = (value: AnniversaryKind) => { kind.value = value }
const onDateChange = (event: { detail: { value: string } }) => { date.value = event.detail.value }
const syncSolarDateFromLunar = () => {
  const monthInfo = LunarYear.fromYear(lunarYear.value).getMonth(lunarMonth.value)
  lunarDay.value = Math.min(lunarDay.value, monthInfo?.getDayCount() || 29)
  const solar = Lunar.fromYmd(lunarYear.value, lunarMonth.value, lunarDay.value).getSolar()
  date.value = `${solar.getYear()}-${String(solar.getMonth()).padStart(2, '0')}-${String(solar.getDay()).padStart(2, '0')}`
}
const changeCalendarType = (value: string) => {
  const nextType = value as CalendarType
  if (nextType === calendarType.value) return
  if (nextType === 'lunar') {
    const [year = 1970, month = 1, day = 1] = date.value.split('-').map(Number)
    const lunar = Solar.fromYmd(year, month, day).getLunar()
    lunarYear.value = lunar.getYear()
    lunarMonth.value = lunar.getMonth()
    lunarDay.value = lunar.getDay()
  } else {
    syncSolarDateFromLunar()
  }
  calendarType.value = nextType
}
const onLunarColumnChange = (event: { detail: { column: number; value: number } }) => {
  const { column, value } = event.detail
  if (column === 0) {
    lunarYear.value = lunarYears[value] || lunarYear.value
    if (!lunarMonths.value.some((item) => item.value === lunarMonth.value)) lunarMonth.value = Math.abs(lunarMonth.value)
  } else if (column === 1) {
    lunarMonth.value = lunarMonths.value[value]?.value || 1
  } else {
    lunarDay.value = value + 1
  }
  syncSolarDateFromLunar()
}
const onLunarChange = (event: { detail: { value: number[] } }) => {
  const [yearIndex = 0, monthIndex = 0, dayIndex = 0] = event.detail.value
  lunarYear.value = lunarYears[yearIndex] || lunarYear.value
  lunarMonth.value = lunarMonths.value[monthIndex]?.value || lunarMonth.value
  lunarDay.value = Math.min(dayIndex + 1, lunarDayCount.value)
  syncSolarDateFromLunar()
}
const toggleReminder = (value: number) => {
  if (reminderDaysBefore.value.includes(value)) {
    if (reminderDaysBefore.value.length === 1) {
      uni.showToast({ title: '请至少保留一个提醒日期', icon: 'none' })
      return
    }
    reminderDaysBefore.value = reminderDaysBefore.value.filter((item) => item !== value)
    return
  }
  reminderDaysBefore.value = [...reminderDaysBefore.value, value].sort((a, b) => a - b)
}

const save = async () => {
  if (saving.value) return
  if (!archiveStore.user.isLoggedIn) {
    uni.navigateTo({ url: '/pages/login/index?target=anniversaryEdit&back=1' })
    return
  }
  const normalizedTitle = title.value.trim()
  if (!normalizedTitle) {
    uni.showToast({ title: '请填写日子名称', icon: 'none' })
    return
  }
  const draft: AnniversaryDraft = {
    title: normalizedTitle,
    date: date.value,
    kind: kind.value,
    calendarType: calendarType.value,
    repeat: repeat.value,
    visibility: archiveStore.activeRelationship ? visibility.value : 'private',
    note: note.value.trim(),
    lunarYear: calendarType.value === 'lunar' ? lunarYear.value : undefined,
    lunarMonth: calendarType.value === 'lunar' ? Math.abs(lunarMonth.value) : undefined,
    lunarDay: calendarType.value === 'lunar' ? lunarDay.value : undefined,
    isLeapMonth: calendarType.value === 'lunar' ? lunarMonth.value < 0 : undefined,
    reminderDaysBefore: [...reminderDaysBefore.value],
  }
  saving.value = true
  try {
    if (isEditing.value) await anniversaryStore.update(id.value, draft)
    else await anniversaryStore.create(draft)
    uni.showToast({ title: isEditing.value ? '已保存修改' : '重要日子已收藏', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 350)
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '保存失败，请稍后重试', icon: 'none' })
  } finally {
    saving.value = false
  }
}

const remove = () => {
  uni.showModal({
    title: '删除这个重要日子？',
    content: '删除后无法恢复，不会影响心情记录和其他数据。',
    confirmText: '删除',
    confirmColor: '#c9574d',
    success: async (result) => {
      if (!result.confirm || deleting.value) return
      deleting.value = true
      try {
        await anniversaryStore.remove(id.value)
        uni.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 350)
      } catch (error) {
        uni.showToast({ title: error instanceof Error ? error.message : '删除失败，请稍后重试', icon: 'none' })
      } finally {
        deleting.value = false
      }
    },
  })
}
</script>

<template>
  <view class="page-shell edit-page">
    <view class="edit-head">
      <text class="eyebrow">A DAY TO REMEMBER</text>
      <text class="edit-head__title">{{ isEditing ? '编辑重要日子' : '收藏一个重要日子' }}</text>
      <text class="edit-head__desc">先记下日期和意义，提醒功能可以在后续版本再慢慢加入。</text>
    </view>

    <view v-if="initialLoading" class="form-card card edit-skeleton" aria-label="正在加载重要日子">
      <view v-for="width in ['62%', '88%', '75%', '92%', '80%']" :key="width" class="edit-skeleton__field">
        <view class="edit-skeleton__label skeleton-shimmer" />
        <view class="edit-skeleton__line skeleton-shimmer" :style="{ width }" />
      </view>
    </view>

    <view v-else-if="loadError" class="load-error card">
      <view class="load-error__icon"><AppIcon name="calendar" :size="30" /></view>
      <text class="load-error__title">这个重要日子暂时没有加载出来</text>
      <text class="load-error__desc">{{ loadError }}</text>
      <view class="load-error__retry" role="button" hover-class="tap-hover" @tap="loadEditingItem">重新加载</view>
    </view>

    <view v-else class="form-card card">
      <view class="field">
        <text class="field__label">日子名称</text>
        <input v-model="title" class="text-input" maxlength="30" placeholder="例如：我们在一起的日子" placeholder-class="input-placeholder" />
        <text class="field__count">{{ title.length }}/30</text>
      </view>

      <view class="field">
        <text class="field__label">它是什么日子？</text>
        <view class="kind-grid">
          <view v-for="item in kinds" :key="item.value" class="kind-option" :class="{ active: kind === item.value }" role="button" @tap="chooseKind(item.value)">
            <view class="kind-option__icon"><AppIcon :name="item.value === 'relationship' ? 'heart' : 'calendar'" :size="19" :filled="item.value === 'relationship'" /></view>
            <text>{{ item.label }}</text>
          </view>
        </view>
      </view>

      <view class="field calendar-type-field">
        <text class="field__label">日期类型</text>
        <SegmentControl :model-value="calendarType" :options="calendarOptions" @update:model-value="changeCalendarType" />
      </view>

      <view class="field field--row">
        <view><text class="field__label">日期</text><text class="field__hint">{{ calendarType === 'solar' ? '公历日期' : '农历日期，支持闰月' }}</text></view>
        <picker v-if="calendarType === 'solar'" mode="date" :value="date" @change="onDateChange">
          <view class="date-picker">
            <view class="date-picker__icon"><AppIcon name="calendar" :size="17" /></view>
            <text class="date-picker__text">{{ date }}</text>
            <view class="date-picker__icon date-picker__icon--chevron"><AppIcon name="chevron" :size="15" color="#9d8b86" /></view>
          </view>
        </picker>
        <picker
          v-else
          mode="multiSelector"
          :range="lunarPickerRange"
          :value="lunarPickerValue"
          @columnchange="onLunarColumnChange"
          @change="onLunarChange"
        >
          <view class="date-picker date-picker--lunar">
            <view class="date-picker__icon"><AppIcon name="calendar" :size="17" /></view>
            <text class="date-picker__text">{{ lunarDateLabel }}</text>
            <view class="date-picker__icon date-picker__icon--chevron"><AppIcon name="chevron" :size="15" color="#9d8b86" /></view>
          </view>
        </picker>
      </view>

      <view class="field">
        <text class="field__label">重复方式</text>
        <SegmentControl v-model="repeat" :options="repeatOptions" />
        <text class="field__tip">生日和纪念日适合每年重复；只发生一次的安排可选择“仅这一次”。</text>
      </view>

      <view class="field">
        <text class="field__label">提醒日期</text>
        <view class="reminder-grid">
          <view
            v-for="item in reminderOptions"
            :key="item.value"
            class="reminder-option"
            :class="{ active: reminderDaysBefore.includes(item.value) }"
            :aria-pressed="reminderDaysBefore.includes(item.value)"
            @tap="toggleReminder(item.value)"
          >
            <view class="reminder-option__mark"><view v-if="reminderDaysBefore.includes(item.value)" /></view>
            <text>{{ item.label }}</text>
          </view>
        </view>
        <text class="field__tip">可以多选。目前只保存提醒设置，消息提醒功能将在后续版本开放。</text>
      </view>

      <view class="field">
        <text class="field__label">谁可以看</text>
        <SegmentControl v-model="visibility" :options="visibilityOptions" />
        <text class="field__tip">{{ archiveStore.activeRelationship ? '双方可见的日子会出现在你和对象的重要日子列表中。' : '当前没有绑定对象，重要日子只保存在你自己的列表中。' }}</text>
      </view>

      <view class="field field--last">
        <text class="field__label">备注（选填）</text>
        <textarea v-model="note" class="note-input" maxlength="100" placeholder="写下一句关于这个日子的回忆……" placeholder-class="input-placeholder" />
        <text class="field__count">{{ note.length }}/100</text>
      </view>
    </view>

    <button v-if="!initialLoading && !loadError" class="save-button" :disabled="archiveStore.user.isLoggedIn && !canSave" :loading="saving" @tap="save">{{ !archiveStore.user.isLoggedIn ? '登录后保存这个日子' : (saving ? '正在保存' : (isEditing ? '保存修改' : '收藏这个日子')) }}</button>
    <button v-if="archiveStore.user.isLoggedIn && isEditing && !initialLoading && !loadError" class="delete-button" :disabled="deleting" :loading="deleting" @tap="remove">{{ deleting ? '正在删除' : '删除这个日子' }}</button>
  </view>
</template>

<style scoped lang="scss">
.edit-page { padding-top: 27rpx; padding-bottom: calc(48rpx + env(safe-area-inset-bottom)); }
.edit-head { padding: 12rpx 3rpx 35rpx; }
.edit-head__title,.edit-head__desc { display: block; }
.edit-head__title { margin-top: 16rpx; font-size: 43rpx; font-weight: 750; line-height: 1.35; }
.edit-head__desc { margin-top: 13rpx; color: #80716d; font-size: 23rpx; line-height: 1.7; }
.form-card { overflow: hidden; padding: 0 26rpx; }
.field { position: relative; padding: 27rpx 0 29rpx; border-bottom: 1rpx solid #f0e5df; }
.field--last { border-bottom: 0; }
.field--row { display: flex; min-height: 116rpx; align-items: center; justify-content: space-between; }
.field__label,.field__hint,.field__tip { display: block; }
.field__label { color: #51423f; font-size: 25rpx; font-weight: 700; }
.field__hint { margin-top: 5rpx; color: #9b8b86; font-size: 20rpx; }
.field__tip { margin-top: 13rpx; color: #958681; font-size: 20rpx; line-height: 1.6; }
.text-input { height: 82rpx; padding-right: 84rpx; color: #493b38; font-size: 27rpx; }
.field__count { position: absolute; right: 1rpx; bottom: 39rpx; color: #aa9b96; font-size: 19rpx; }
:deep(.input-placeholder) { color: #b6a7a2; }
.kind-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14rpx; margin-top: 18rpx; }
.kind-option { display: flex; height: 78rpx; gap: 10rpx; align-items: center; justify-content: flex-start; padding: 0 18rpx; border: 1rpx solid #eaded8; border-radius: 21rpx; background: #fffcfa; color: #766864; font-size: 23rpx; line-height: 1; }
.kind-option.active { border-color: #dfa99e; background: #fff0ea; color: #a65349; font-weight: 700; }
.kind-option__icon { display: flex; width: 34rpx; height: 34rpx; align-items: center; justify-content: center; }
.date-picker { display: flex; min-width: 250rpx; height: 70rpx; gap: 9rpx; padding: 0 15rpx; align-items: center; justify-content: flex-end; border-radius: 20rpx; background: #fff5f1; color: #76534d; font-size: 23rpx; line-height: 1; }
.date-picker--lunar { min-width: 290rpx; }
.date-picker__icon { display: flex; width: 34rpx; height: 34rpx; flex: none; align-items: center; justify-content: center; font-size: 0; line-height: 1; }
.date-picker__icon--chevron { width: 30rpx; }
.date-picker__text { display: flex; height: 34rpx; flex: none; align-items: center; justify-content: center; line-height: 34rpx; white-space: nowrap; }
.field :deep(.segments) { margin-top: 17rpx; }
.reminder-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16rpx; margin-top: 18rpx; }
.reminder-option { display: flex; min-height: 88rpx; gap: 11rpx; padding: 0 20rpx; align-items: center; justify-content: flex-start; border: 1rpx solid #eaded8; border-radius: 22rpx; background: #fffcfa; color: #766864; font-size: 23rpx; line-height: 1; }
.reminder-option.active { border-color: #dfa99e; background: #fff0ea; color: #a65349; font-weight: 700; }
.reminder-option__mark { display: flex; width: 28rpx; height: 28rpx; flex: none; align-items: center; justify-content: center; border: 2rpx solid #d6c5bf; border-radius: 50%; background: #fff; }
.reminder-option.active .reminder-option__mark { border-color: #ca6b5e; }
.reminder-option__mark > view { width: 14rpx; height: 14rpx; border-radius: 50%; background: #ca6b5e; }
.note-input { width: 100%; height: 190rpx; margin-top: 16rpx; padding: 19rpx 20rpx; border-radius: 20rpx; background: #fffaf7; color: #4e403d; font-size: 25rpx; line-height: 1.65; }
.field--last .field__count { right: 14rpx; bottom: 43rpx; }
.save-button { display: flex; width: 100%; min-height: 92rpx; margin-top: 28rpx; align-items: center; justify-content: center; border-radius: 28rpx; background: linear-gradient(135deg,#d87868,#c9695b); color: #fff; font-size: 28rpx; font-weight: 700; line-height: 1; box-shadow: 0 14rpx 28rpx rgba(197,95,83,.2); }
.save-button[disabled] { background: #e6d7d2; color: #a79893; box-shadow: none; }
.delete-button { min-height: 76rpx; margin: 17rpx auto 0; background: transparent; color: #bd5a50; font-size: 23rpx; line-height: 76rpx; }
.edit-skeleton { padding: 0 26rpx; }
.edit-skeleton__field { padding: 31rpx 0; border-bottom: 1rpx solid #f0e5df; }
.edit-skeleton__field:last-child { border-bottom: 0; }
.edit-skeleton__label { width: 24%; height: 22rpx; border-radius: 12rpx; }
.edit-skeleton__line { height: 62rpx; margin-top: 20rpx; border-radius: 20rpx; }
.skeleton-shimmer { background: linear-gradient(100deg, #f5e9e4 25%, #fff7f3 45%, #f5e9e4 65%); background-size: 220% 100%; animation: skeleton-shimmer 1.35s ease-in-out infinite; }
@keyframes skeleton-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
.load-error { padding: 62rpx 34rpx; text-align: center; }
.load-error__icon { display: flex; width: 88rpx; height: 88rpx; margin: 0 auto 22rpx; align-items: center; justify-content: center; border-radius: 28rpx; background: #fff0ea; color: #a85b50; }
.load-error__title,.load-error__desc { display: block; }
.load-error__title { color: #51423f; font-size: 27rpx; font-weight: 700; }
.load-error__desc { margin-top: 12rpx; color: #958681; font-size: 21rpx; line-height: 1.6; }
.load-error__retry { display: flex; width: 210rpx; height: 72rpx; margin: 26rpx auto 0; align-items: center; justify-content: center; border-radius: 22rpx; background: #d87263; color: #fff; font-size: 23rpx; font-weight: 700; }
.tap-hover { opacity: .72; }
</style>
