import type { AuthorId, Comment, MoodKind, MoodRecord, Visibility } from '@/types/domain'
import { resolveAssetUrl } from '@/utils/assets'
import { apiRequest } from './request'

type ApiMoodKind = 'HAPPY' | 'SAD'
type ApiVisibility = 'PRIVATE' | 'PARTNER'

interface ApiUserSummary {
  id: string
  nickname: string
  avatarUrl: string | null
}

interface ApiComment {
  id: string
  authorId: string
  content: string
  createdAt: string
  isEdited?: boolean
  author: ApiUserSummary
}

interface ApiMoodRecord {
  id: string
  authorId: string
  relationshipId: string | null
  mood: ApiMoodKind
  emotion: string
  content: string
  recordDate: string
  visibility: ApiVisibility
  allowComments: boolean
  isBackfilled: boolean
  createdAt: string
  authorRole: AuthorId
  hasReacted: boolean
  hasResponse: boolean
  author: ApiUserSummary
  comments: ApiComment[]
}

interface MoodListResponse {
  items: ApiMoodRecord[]
  pagination: {
    page: number
    pageSize: number
    total: number
  }
}

export type MoodListScope = 'all' | 'mine' | 'partner'

export interface MoodPage {
  items: MoodRecord[]
  pagination: MoodListResponse['pagination']
}

export interface TodayMoodStatus {
  mine: {
    id: string
    mood: ApiMoodKind
    emotion: string
    createdAt: string
  } | null
  partner: {
    hasMood: boolean
    id: string | null
  }
}

export interface CreateMoodInput {
  mood: MoodKind
  emotion: string
  content: string
  recordDate: string
  visibility: Visibility
  allowComments: boolean
}

const toComment = (comment: ApiComment, currentUserId?: string): Comment => ({
  id: comment.id,
  authorId: comment.authorId === currentUserId ? 'me' : 'partner',
  authorName: comment.author.nickname,
  authorAvatarUrl: resolveAssetUrl(comment.author.avatarUrl),
  content: comment.content,
  createdAt: comment.createdAt,
  isEdited: comment.isEdited,
})

export const toMoodRecord = (record: ApiMoodRecord, currentUserId?: string): MoodRecord => {
  const mood: MoodKind = record.mood === 'HAPPY' ? 'happy' : 'sad'
  const visibility: Visibility = record.visibility === 'PARTNER' ? 'partner' : 'private'
  return {
    id: record.id,
    authorId: record.authorRole,
    authorName: record.author.nickname,
    authorAvatarUrl: resolveAssetUrl(record.author.avatarUrl),
    mood,
    emotion: record.emotion,
    content: record.content,
    recordDate: record.recordDate.slice(0, 10),
    createdAt: record.createdAt,
    visibility,
    allowComments: record.allowComments,
    likedByPartner: mood === 'happy' && (record.authorRole === 'me' ? record.hasResponse : record.hasReacted),
    huggedByPartner: mood === 'sad' && (record.authorRole === 'me' ? record.hasResponse : record.hasReacted),
    comments: record.comments.map((comment) => toComment(comment, currentUserId)),
    relationshipId: record.relationshipId || undefined,
    isBackfilled: record.isBackfilled,
  }
}

export async function createMood(input: CreateMoodInput, currentUserId?: string): Promise<MoodRecord> {
  const record = await apiRequest<ApiMoodRecord>({
    path: '/moods',
    method: 'POST',
    data: {
      ...input,
      mood: input.mood.toUpperCase(),
      visibility: input.visibility.toUpperCase(),
    },
  })
  return toMoodRecord(record, currentUserId)
}

export async function listMoods(
  options: { page?: number; pageSize?: number; scope?: MoodListScope } = {},
  currentUserId?: string,
): Promise<MoodPage> {
  const page = options.page || 1
  const pageSize = options.pageSize || 10
  const scope = options.scope || 'all'
  const result = await apiRequest<MoodListResponse>({
    path: `/moods?scope=${scope}&page=${page}&pageSize=${pageSize}`,
  })
  return {
    items: result.items.map((item) => toMoodRecord(item, currentUserId)),
    pagination: result.pagination,
  }
}

export function getTodayMoodStatus(): Promise<TodayMoodStatus> {
  return apiRequest<TodayMoodStatus>({ path: '/moods/today/status' })
}

export async function getMoodDetail(id: string, currentUserId?: string): Promise<MoodRecord> {
  const record = await apiRequest<ApiMoodRecord>({ path: `/moods/${id}` })
  return toMoodRecord(record, currentUserId)
}
