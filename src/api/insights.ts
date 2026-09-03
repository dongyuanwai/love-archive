import { apiRequest } from './request'

export type InsightPeriod = 'week' | 'month' | 'three_months'
export type InsightSubject = 'mine' | 'partner'

export interface InsightSummary {
  period: InsightPeriod
  subject: InsightSubject
  total: number
  happy: number
  sad: number
  happyRate: number
  sadRate: number
  responseCount: number
  emotions: Array<{ emotion: string; count: number }>
  calendar: Array<{ date: string; happy: number; sad: number }>
}

export function getInsightSummary(period: InsightPeriod, subject: InsightSubject, month?: string): Promise<InsightSummary> {
  const monthQuery = month ? `&month=${encodeURIComponent(month)}` : ''
  return apiRequest({ path: `/insights/summary?period=${period}&subject=${subject}${monthQuery}` })
}
