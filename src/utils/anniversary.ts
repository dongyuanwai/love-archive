import { Lunar, LunarYear, Solar } from 'lunar-javascript'
import type { Anniversary, AnniversaryKind } from '@/types/domain'

export const anniversaryKindLabels: Record<AnniversaryKind, string> = {
  relationship: '纪念日',
  birthday: '生日',
  first_met: '初见',
  custom: '自定义',
}

const parseLocalDate = (value: string) => {
  const [year = 1970, month = 1, day = 1] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

const startOfToday = () => {
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  return today
}

const toLocalDate = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12)

const lunarToLocalDate = (year: number, month: number, day: number) => {
  const lunarYear = LunarYear.fromYear(year)
  const requestedMonth = lunarYear.getMonth(month) ? month : Math.abs(month)
  const monthInfo = lunarYear.getMonth(requestedMonth)
  const normalizedDay = Math.min(day, monthInfo?.getDayCount() || 29)
  const solar = Lunar.fromYmd(year, requestedMonth, normalizedDay).getSolar()
  return toLocalDate(solar.getYear(), solar.getMonth(), solar.getDay())
}

const getNextLunarOccurrence = (item: Anniversary, today: Date) => {
  const lunarYear = item.lunarYear || today.getFullYear()
  const lunarMonth = item.isLeapMonth ? -(item.lunarMonth || 1) : (item.lunarMonth || 1)
  const lunarDay = item.lunarDay || 1
  if (item.repeat === 'once') return lunarToLocalDate(lunarYear, lunarMonth, lunarDay)

  const todayLunar = Solar.fromYmd(today.getFullYear(), today.getMonth() + 1, today.getDate()).getLunar()
  let occurrenceYear = todayLunar.getYear()
  let occurrence = lunarToLocalDate(occurrenceYear, lunarMonth, lunarDay)
  if (occurrence < today) occurrence = lunarToLocalDate(++occurrenceYear, lunarMonth, lunarDay)
  return occurrence
}

export const getNextOccurrence = (item: Anniversary, today = startOfToday()) => {
  if (item.calendarType === 'lunar') return getNextLunarOccurrence(item, today)
  const original = parseLocalDate(item.date)
  if (item.repeat === 'once') return original

  const month = original.getMonth()
  const day = original.getDate()
  let next = new Date(today.getFullYear(), month, day, 12)
  if (next < today) next = new Date(today.getFullYear() + 1, month, day, 12)
  return next
}

export const getDaysUntil = (item: Anniversary, today = startOfToday()) => {
  const occurrence = getNextOccurrence(item, today)
  return Math.round((occurrence.getTime() - today.getTime()) / 86400000)
}

export const getAnniversaryStatus = (item: Anniversary) => {
  const days = getDaysUntil(item)
  if (days === 0) return '就是今天'
  if (days > 0) return `还有 ${days} 天`
  return `已过去 ${Math.abs(days)} 天`
}

export const formatAnniversaryDate = (item: Anniversary) => {
  if (item.calendarType === 'lunar' && item.lunarYear && item.lunarMonth && item.lunarDay) {
    const month = item.isLeapMonth ? -item.lunarMonth : item.lunarMonth
    const lunar = Lunar.fromYmd(item.lunarYear, month, item.lunarDay)
    const lunarDate = `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`
    return item.repeat === 'yearly' ? `每年农历${lunarDate}` : `农历${item.lunarYear}年${lunarDate}`
  }
  const date = parseLocalDate(item.date)
  const monthAndDay = `${date.getMonth() + 1}月${date.getDate()}日`
  return item.repeat === 'yearly' ? `每年 ${monthAndDay}` : `${date.getFullYear()}年${monthAndDay}`
}

export const sortAnniversaries = (items: Anniversary[]) => [...items].sort((a, b) => {
  const aDays = getDaysUntil(a)
  const bDays = getDaysUntil(b)
  const aArchived = a.repeat === 'once' && aDays < 0
  const bArchived = b.repeat === 'once' && bDays < 0
  if (aArchived !== bArchived) return aArchived ? 1 : -1
  return aArchived ? b.date.localeCompare(a.date) : aDays - bDays
})
