import type {
  Anniversary,
  AnniversaryKind,
  AnniversaryRepeat,
  CalendarType,
  Visibility,
} from '@/types/domain'
import { apiRequest } from './request'

type ApiImportantDayKind = 'anniversary' | 'birthday' | 'first_met' | 'custom'
type ApiCalendarType = 'solar' | 'lunar'
type ApiRepeat = 'yearly' | 'once'
type ApiVisibility = 'private' | 'partner'

interface ApiImportantDay {
  id: string
  creatorId: string
  relationshipId: string | null
  title: string
  kind: ApiImportantDayKind
  calendarType: ApiCalendarType
  repeat: ApiRepeat
  visibility: ApiVisibility
  note: string
  date: string
  lunarYear: number | null
  lunarMonth: number | null
  lunarDay: number | null
  isLeapMonth: boolean
  reminderDaysBefore: number[]
  nextOccurrenceDate: string
  daysUntil: number
  status: string
  archived: boolean
  createdAt: string
  updatedAt: string
}

interface ImportantDayListResponse {
  items: ApiImportantDay[]
  pagination: {
    page: number
    pageSize: number
    total: number
  }
}

export interface ImportantDayDraft {
  title: string
  date: string
  kind: AnniversaryKind
  calendarType: CalendarType
  repeat: AnniversaryRepeat
  visibility: Visibility
  note: string
  lunarYear?: number
  lunarMonth?: number
  lunarDay?: number
  isLeapMonth?: boolean
  reminderDaysBefore: number[]
}

export interface ImportantDayPage {
  items: Anniversary[]
  pagination: ImportantDayListResponse['pagination']
}

const requestKinds: Record<AnniversaryKind, string> = {
  relationship: 'ANNIVERSARY',
  birthday: 'BIRTHDAY',
  first_met: 'FIRST_MET',
  custom: 'CUSTOM',
}

const responseKinds: Record<ApiImportantDayKind, AnniversaryKind> = {
  anniversary: 'relationship',
  birthday: 'birthday',
  first_met: 'first_met',
  custom: 'custom',
}

const toAnniversary = (item: ApiImportantDay): Anniversary => ({
  id: item.id,
  creatorId: item.creatorId,
  relationshipId: item.relationshipId || undefined,
  title: item.title,
  kind: responseKinds[item.kind],
  calendarType: item.calendarType,
  repeat: item.repeat,
  visibility: item.visibility,
  note: item.note,
  date: item.date.slice(0, 10),
  lunarYear: item.lunarYear ?? undefined,
  lunarMonth: item.lunarMonth ?? undefined,
  lunarDay: item.lunarDay ?? undefined,
  isLeapMonth: item.isLeapMonth,
  reminderDaysBefore: item.reminderDaysBefore,
  nextOccurrenceDate: item.nextOccurrenceDate,
  daysUntil: item.daysUntil,
  status: item.status,
  archived: item.archived,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
})

const toRequestData = (draft: ImportantDayDraft) => ({
  title: draft.title,
  kind: requestKinds[draft.kind],
  calendarType: draft.calendarType.toUpperCase(),
  repeat: draft.repeat.toUpperCase(),
  visibility: draft.visibility.toUpperCase(),
  note: draft.note,
  reminderDaysBefore: draft.reminderDaysBefore,
  ...(draft.calendarType === 'solar'
    ? { solarDate: draft.date }
    : {
        lunarYear: draft.lunarYear,
        lunarMonth: draft.lunarMonth,
        lunarDay: draft.lunarDay,
        isLeapMonth: draft.isLeapMonth ?? false,
      }),
})

export async function listImportantDays(
  options: { page?: number; pageSize?: number; scope?: 'all' | 'mine' | 'partner' } = {},
): Promise<ImportantDayPage> {
  const page = options.page || 1
  const pageSize = options.pageSize || 20
  const scope = options.scope || 'all'
  const result = await apiRequest<ImportantDayListResponse>({
    path: `/important-days?scope=${scope}&page=${page}&pageSize=${pageSize}`,
  })
  return {
    items: result.items.map(toAnniversary),
    pagination: result.pagination,
  }
}

export async function getNearestImportantDay(): Promise<Anniversary | null> {
  const item = await apiRequest<ApiImportantDay | null>({ path: '/important-days/nearest' })
  return item ? toAnniversary(item) : null
}

export async function getImportantDay(id: string): Promise<Anniversary> {
  return toAnniversary(await apiRequest<ApiImportantDay>({ path: `/important-days/${id}` }))
}

export async function createImportantDay(draft: ImportantDayDraft): Promise<Anniversary> {
  return toAnniversary(await apiRequest<ApiImportantDay>({
    path: '/important-days',
    method: 'POST',
    data: toRequestData(draft),
  }))
}

export async function updateImportantDay(id: string, draft: ImportantDayDraft): Promise<Anniversary> {
  return toAnniversary(await apiRequest<ApiImportantDay>({
    path: `/important-days/${id}`,
    method: 'PUT',
    data: toRequestData(draft),
  }))
}

export function deleteImportantDay(id: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>({ path: `/important-days/${id}`, method: 'DELETE' })
}
