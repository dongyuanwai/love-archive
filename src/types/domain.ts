export type MoodKind = 'happy' | 'sad'
export type Visibility = 'partner' | 'private'
export type AuthorId = 'me' | 'partner'
export type AnniversaryKind = 'relationship' | 'birthday' | 'first_met' | 'custom'
export type AnniversaryRepeat = 'yearly' | 'once'
export type CalendarType = 'solar' | 'lunar'

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
  authorAvatarUrl?: string
  content: string
  createdAt: string
  isEdited?: boolean
}

export interface MoodImage {
  id: string
  url: string
  thumbnailUrl?: string
  width?: number
  height?: number
}

export interface MoodRecord {
  id: string
  authorId: AuthorId
  authorName: string
  authorAvatarUrl?: string
  mood: MoodKind
  emotion: string
  content: string
  recordDate: string
  createdAt: string
  visibility: Visibility
  allowComments: boolean
  likedByPartner: boolean
  huggedByPartner: boolean
  images: MoodImage[]
  comments: Comment[]
  relationshipId?: string
  isBackfilled?: boolean
}

export interface Relationship {
  id: string
  partnerName: string
  partnerInitial: string
  partnerAvatarUrl: string
  startedAt: string
  active: boolean
  daysTogether?: number
  sharedMoodCount?: number
  responseCount?: number
}

export interface Anniversary {
  id: string
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
  creatorId?: string
  relationshipId?: string
  nextOccurrenceDate?: string
  daysUntil?: number
  status?: string
  archived?: boolean
  createdAt: string
  updatedAt: string
}
