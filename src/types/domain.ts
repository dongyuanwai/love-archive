export type MoodKind = 'happy' | 'sad'
export type Visibility = 'partner' | 'private'
export type AuthorId = 'me' | 'partner'

export interface UserProfile {
  id?: string
  name: string
  initial: string
  avatarUrl: string
  isLoggedIn: boolean
}

export interface Comment {
  id: string
  authorId: AuthorId
  authorName: string
  content: string
  createdAt: string
  isEdited?: boolean
}

export interface MoodRecord {
  id: string
  authorId: AuthorId
  authorName: string
  mood: MoodKind
  emotion: string
  content: string
  recordDate: string
  createdAt: string
  visibility: Visibility
  allowComments: boolean
  likedByPartner: boolean
  huggedByPartner: boolean
  comments: Comment[]
  relationshipId?: string
  isBackfilled?: boolean
}

export interface Relationship {
  id: string
  partnerName: string
  partnerInitial: string
  startedAt: string
  active: boolean
  daysTogether?: number
  sharedMoodCount?: number
  responseCount?: number
}
