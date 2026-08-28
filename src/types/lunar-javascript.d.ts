declare module 'lunar-javascript' {
  interface SolarDate {
    getYear(): number
    getMonth(): number
    getDay(): number
    getLunar(): LunarDate
    toString(): string
  }

  interface LunarDate {
    getYear(): number
    getMonth(): number
    getDay(): number
    getMonthInChinese(): string
    getDayInChinese(): string
    getSolar(): SolarDate
  }

  interface LunarMonth {
    getMonth(): number
    getDayCount(): number
  }

  interface LunarYearDate {
    getLeapMonth(): number
    getMonth(month: number): LunarMonth | null
  }

  export const Solar: {
    fromYmd(year: number, month: number, day: number): SolarDate
  }

  export const Lunar: {
    fromYmd(year: number, month: number, day: number): LunarDate
  }

  export const LunarYear: {
    fromYear(year: number): LunarYearDate
  }
}
