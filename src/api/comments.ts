import { apiRequest } from './request'

export function createComment(moodId: string, content: string): Promise<unknown> {
  return apiRequest({
    path: `/moods/${moodId}/comments`,
    method: 'POST',
    data: { content: content.trim() },
  })
}

export function editComment(commentId: string, content: string): Promise<unknown> {
  return apiRequest({
    path: `/comments/${commentId}`,
    method: 'PUT',
    data: { content: content.trim() },
  })
}
