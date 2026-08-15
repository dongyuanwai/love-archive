import { apiRequest } from './request'

export interface CurrentRelationshipResponse {
  active: boolean
  relationship: {
    id: string
    startedAt: string
    partner: {
      id: string
      nickname: string
      avatarUrl: string | null
    } | null
    stats: {
      daysTogether: number
      sharedMoodCount: number
      responseCount: number
    }
  } | null
}

export interface RelationshipInvite {
  code: string
  expiresAt: string
}

export function getCurrentRelationship(): Promise<CurrentRelationshipResponse> {
  return apiRequest<CurrentRelationshipResponse>({ path: '/relationships/current' })
}

export function createRelationshipInvite(): Promise<RelationshipInvite> {
  return apiRequest<RelationshipInvite>({
    path: '/relationships/invites',
    method: 'POST',
  })
}

export function acceptRelationshipInvite(code: string): Promise<{ id: string; startedAt: string }> {
  return apiRequest({
    path: '/relationships/invites/accept',
    method: 'POST',
    data: { code: code.trim().toUpperCase() },
  })
}

export function unbindCurrentRelationship(): Promise<{ success: boolean; endedAt: string }> {
  return apiRequest({
    path: '/relationships/current',
    method: 'DELETE',
  })
}
