import { defineStore } from 'pinia'
import type { MoodKind, MoodRecord, Relationship, UserProfile, Visibility } from '@/types/domain'
import { todayString } from '@/utils/date'

const userStorageKey = 'love-archive:test-new-user'
const defaultUser: UserProfile = { name: '微信用户', initial: '微', avatarUrl: '', isLoggedIn: false }

const getStoredUser = (): UserProfile => {
  try {
    const stored = uni.getStorageSync(userStorageKey) as Partial<UserProfile> | undefined
    if (!stored?.isLoggedIn || !stored.name) return { ...defaultUser }
    return {
      name: stored.name,
      initial: stored.name.slice(-1),
      avatarUrl: stored.avatarUrl || '',
      isLoggedIn: true,
    }
  } catch {
    return { ...defaultUser }
  }
}

const seedRecords: MoodRecord[] = []

export const useArchiveStore = defineStore('archive', {
  state: () => ({
    user: getStoredUser(),
    relationship: {
      id: '', partnerName: '', partnerInitial: '', startedAt: '', active: false
    } as Relationship,
    records: seedRecords as MoodRecord[],
    inviteCode: 'LOV826',
  }),
  getters: {
    activeRelationship: (state) => state.relationship.active ? state.relationship : null,
    visibleFeed(state): MoodRecord[] {
      return state.records
        .filter((record) => record.authorId === 'me' || (
          state.relationship.active &&
          record.relationshipId === state.relationship.id &&
          record.visibility === 'partner'
        ))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    recordById: (state) => (id: string) => state.records.find((record) => record.id === id),
  },
  actions: {
    completeWechatLogin(name: string, avatarUrl: string) {
      const normalizedName = name.trim()
      if (!normalizedName || !avatarUrl) return false
      this.user = {
        name: normalizedName,
        initial: normalizedName.slice(-1),
        avatarUrl,
        isLoggedIn: true,
      }
      this.records.forEach((record) => {
        if (record.authorId === 'me') record.authorName = normalizedName
        record.comments.forEach((comment) => {
          if (comment.authorId === 'me') comment.authorName = normalizedName
        })
      })
      uni.setStorageSync(userStorageKey, this.user)
      return true
    },
    logout() {
      this.user = { ...defaultUser }
      this.records.forEach((record) => {
        if (record.authorId === 'me') record.authorName = defaultUser.name
        record.comments.forEach((comment) => {
          if (comment.authorId === 'me') comment.authorName = defaultUser.name
        })
      })
      uni.removeStorageSync(userStorageKey)
    },
    addRecord(payload: { mood: MoodKind; emotion: string; content: string; recordDate: string; visibility: Visibility; allowComments: boolean }) {
      const now = new Date()
      const createdAt = `${todayString()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      this.records.unshift({
        id: `r-${Date.now()}`,
        authorId: 'me', authorName: this.user.name, ...payload, createdAt,
        likedByPartner: false, huggedByPartner: false, comments: [],
        relationshipId: payload.visibility === 'partner' && this.relationship.active ? this.relationship.id : undefined,
        isBackfilled: payload.recordDate !== todayString(),
      })
    },
    toggleLike(id: string) {
      const record = this.records.find((item) => item.id === id)
      if (record) record.likedByPartner = !record.likedByPartner
    },
    toggleHug(id: string) {
      const record = this.records.find((item) => item.id === id)
      if (record) record.huggedByPartner = !record.huggedByPartner
    },
    toggleMoodResponse(id: string) {
      const record = this.records.find((item) => item.id === id)
      if (!record) return
      if (record.mood === 'happy') record.likedByPartner = !record.likedByPartner
      else record.huggedByPartner = !record.huggedByPartner
    },
    addComment(id: string, content: string) {
      const record = this.records.find((item) => item.id === id)
      if (!record || !content.trim()) return
      record.comments.push({
        id: `c-${Date.now()}`, authorId: 'me', authorName: this.user.name,
        content: content.trim(), createdAt: `${todayString()} 现在`,
      })
    },
    editComment(recordId: string, commentId: string, content: string) {
      const record = this.records.find((item) => item.id === recordId)
      if (!record || !content.trim()) return false
      const comment = record.comments.find((item) => item.id === commentId)
      if (!comment || comment.authorId !== 'me') return false
      comment.content = content.trim()
      comment.isEdited = true
      return true
    },
    unbind() {
      this.relationship.active = false
    },
    bindWithCode(code: string) {
      if (!code.trim()) return false
      this.relationship.active = true
      this.relationship.id = `rel-${Date.now()}`
      this.relationship.startedAt = todayString()
      return true
    },
    regenerateInviteCode() {
      this.inviteCode = `LOVE${String(Date.now()).slice(-4)}`
    },
  },
})
