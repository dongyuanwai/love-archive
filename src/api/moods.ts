import type { AuthorId, Comment, MoodImage, MoodKind, MoodRecord, Visibility } from '@/types/domain'
import { resolveAssetUrl } from '@/utils/assets'
import { API_BASE_URL } from '@/config/env'
import { getAccessToken } from './token'
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

interface ApiMoodImage {
  id: string
  url: string
  thumbnailUrl?: string | null
  width?: number | null
  height?: number | null
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
  images?: ApiMoodImage[] | null
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
  imageIds?: string[]
}

export interface UploadedMoodImage {
  id: string
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

const toMoodImage = (image: ApiMoodImage): MoodImage => ({
  id: image.id,
  url: resolveAssetUrl(image.url),
  thumbnailUrl: image.thumbnailUrl ? resolveAssetUrl(image.thumbnailUrl) : undefined,
  width: image.width ?? undefined,
  height: image.height ?? undefined,
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
    images: (record.images ?? []).map(toMoodImage),
    comments: record.comments.map((comment) => toComment(comment, currentUserId)),
    relationshipId: record.relationshipId || undefined,
    isBackfilled: record.isBackfilled,
  }
}

const uploadErrorMessage = (data: unknown, fallback: string) => {
  if (!data || typeof data !== 'object') return fallback
  const message = (data as { message?: string | string[] }).message
  if (Array.isArray(message)) return message.join('；')
  return message || fallback
}

export function uploadMoodImage(filePath: string): Promise<UploadedMoodImage> {
  const accessToken = getAccessToken()
  if (!accessToken) return Promise.reject(new Error('请先登录'))

  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${API_BASE_URL}/moods/images`,
      filePath,
      name: 'image',
      header: { Authorization: `Bearer ${accessToken}` },
      success: (response) => {
        let data: unknown
        try {
          data = JSON.parse(response.data) as unknown
        } catch {
          reject(new Error('图片上传响应异常'))
          return
        }

        if (response.statusCode >= 200 && response.statusCode < 300) {
          const body = data as { id?: string; imageId?: string }
          const id = body.id || body.imageId
          if (!id) {
            reject(new Error('图片上传响应缺少 ID'))
            return
          }
          resolve({ id })
          return
        }

        reject(new Error(uploadErrorMessage(data, '图片上传失败')))
      },
      fail: () => reject(new Error('图片上传失败，请检查网络')),
    })
  })
}

export function deletePendingMoodImage(id: string): Promise<void> {
  return apiRequest<void>({
    path: `/moods/images/${encodeURIComponent(id)}`,
    method: 'DELETE',
  })
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

export async function updateMood(id: string, input: CreateMoodInput, currentUserId?: string): Promise<MoodRecord> {
  const record = await apiRequest<ApiMoodRecord>({
    path: `/moods/${encodeURIComponent(id)}`,
    method: 'PUT',
    data: {
      ...input,
      mood: input.mood.toUpperCase(),
      visibility: input.visibility.toUpperCase(),
    },
  })
  return toMoodRecord(record, currentUserId)
}

export function deleteMood(id: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>({
    path: `/moods/${encodeURIComponent(id)}`,
    method: 'DELETE',
  })
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
