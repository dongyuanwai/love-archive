import { todayString } from './date'

export interface TogetherDayDuration {
  years: number
  months: number
  days: number
  totalDays: number
}

const parseDate = (value: string) => {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!matched) return null
  const year = Number(matched[1])
  const month = Number(matched[2])
  const day = Number(matched[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null
  return date
}

const anniversaryInYear = (start: Date, year: number) => {
  const month = start.getUTCMonth()
  const day = start.getUTCDate()
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)))
}

const addMonthsClamped = (date: Date, months: number) => {
  const targetMonthIndex = date.getUTCMonth() + months
  const year = date.getUTCFullYear() + Math.floor(targetMonthIndex / 12)
  const month = ((targetMonthIndex % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)))
}

const differenceInDays = (later: Date, earlier: Date) =>
  Math.floor((later.getTime() - earlier.getTime()) / (24 * 60 * 60 * 1000))

export const getTogetherDayDuration = (
  startValue: string,
  todayValue = todayString(),
): TogetherDayDuration | null => {
  const start = parseDate(startValue)
  const today = parseDate(todayValue)
  if (!start || !today || start > today) return null

  let years = today.getUTCFullYear() - start.getUTCFullYear()
  let latestAnniversary = anniversaryInYear(start, start.getUTCFullYear() + years)
  if (latestAnniversary > today) {
    years -= 1
    latestAnniversary = anniversaryInYear(start, start.getUTCFullYear() + years)
  }

  let months = (today.getUTCFullYear() - latestAnniversary.getUTCFullYear()) * 12
    + today.getUTCMonth() - latestAnniversary.getUTCMonth()
  let latestMonthAnniversary = addMonthsClamped(latestAnniversary, months)

  if (latestMonthAnniversary > today) {
    months -= 1
    latestMonthAnniversary = addMonthsClamped(latestAnniversary, months)
  }

  return {
    years,
    months,
    days: differenceInDays(today, latestMonthAnniversary),
    totalDays: differenceInDays(today, start) + 1,
  }
}

export const formatTogetherDayDate = (value: string) => {
  const date = parseDate(value)
  if (!date) return value
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`
}
