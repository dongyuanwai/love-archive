import { apiRequest } from './request'
import { resolveAssetUrl } from '@/utils/assets'

const APP_VERSION = '0.1.0'

export type SuggestionType = 'ISSUE' | 'SUGGESTION'

export interface SuggestionSubmitResult {
  id: string
  createdAt: string
}

export interface SuggestionListItem {
  id: string
  type: SuggestionType
  content: string
  appVersion: string | null
  createdAt: string
  user: {
    id: string
    nickname: string
    avatarUrl: string | null
  }
}

export interface SuggestionListResult {
  items: SuggestionListItem[]
  nextCursor: string | null
}

interface SuggestionListQuery {
  type?: SuggestionType
  cursor?: string
  limit?: number
}

export function submitSuggestion(type: SuggestionType, content: string): Promise<SuggestionSubmitResult> {
  return apiRequest<SuggestionSubmitResult>({
    path: '/suggestions',
    method: 'POST',
    data: {
      type,
      content: content.trim(),
      appVersion: APP_VERSION,
    },
  })
}

export async function getSuggestionList(query: SuggestionListQuery = {}): Promise<SuggestionListResult> {
  const result = await apiRequest<SuggestionListResult>({
    path: '/suggestions',
    data: {
      ...(query.type ? { type: query.type } : {}),
      ...(query.cursor ? { cursor: query.cursor } : {}),
      limit: query.limit || 20,
    },
  })
  return {
    ...result,
    items: result.items.map((item) => ({
      ...item,
      user: {
        ...item.user,
        avatarUrl: resolveAssetUrl(item.user.avatarUrl),
      },
    })),
  }
}
