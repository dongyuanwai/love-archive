import { apiRequest } from './request'

export function addReaction(moodId: string): Promise<unknown> {
  return apiRequest({ path: `/moods/${moodId}/reaction`, method: 'PUT' })
}

export function removeReaction(moodId: string): Promise<{ success: boolean }> {
  return apiRequest({ path: `/moods/${moodId}/reaction`, method: 'DELETE' })
}
