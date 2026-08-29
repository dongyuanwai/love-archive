import { defineStore } from 'pinia'
import { resolveAssetUrl } from '@/utils/assets'
import type { MoodKind, MoodRecord, Relationship, UserProfile, Visibility } from '@/types/domain'
import { todayString } from '@/utils/date'
import { clearTokens, getAccessToken } from '@/api/token'
import type { CurrentRelationshipResponse, RelationshipInvite } from '@/api/relationships'

const userStorageKey = 'love-archive:test-new-user'
const inviteStorageKey = 'love-archive:relationship-invite'
const defaultUser: UserProfile = { name: '微信用户', initial: '微', avatarUrl: '', isLoggedIn: false }
const createEmptyRelationship = (): Relationship => ({
  id: '', partnerName: '', partnerInitial: '', partnerAvatarUrl: '', startedAt: '', active: false,
})

const getStoredUser = (): UserProfile => {
  try {
    const stored = uni.getStorageSync(userStorageKey) as Partial<UserProfile> | undefined
    if (!stored?.isLoggedIn || !stored.name || !getAccessToken()) return { ...defaultUser }
    return {
      id: stored.id,
      name: stored.name,
      initial: stored.name.slice(-1),
      avatarUrl: resolveAssetUrl(stored.avatarUrl),
      isLoggedIn: true,
    }
  } catch {
    return { ...defaultUser }
  }
}

const seedRecords: MoodRecord[] = []

const getStoredInvite = (): RelationshipInvite | null => {
  try {
    const stored = uni.getStorageSync(inviteStorageKey) as RelationshipInvite | undefined
    if (!stored?.code || !stored.expiresAt || new Date(stored.expiresAt).getTime() <= Date.now()) return null
    return stored
  } catch {
    return null
  }
}

const storedInvite = getStoredInvite()

export const useArchiveStore = defineStore('archive', {
  state: () => ({
    user: getStoredUser(),
    relationship: createEmptyRelationship(),
    records: seedRecords as MoodRecord[],
    inviteCode: storedInvite?.code || '',
    inviteExpiresAt: storedInvite?.expiresAt || '',
  }),
  getters: {
    activeRelationship: (state) => state.relationship.active ? state.relationship : null,
    visibleFeed(state): MoodRecord[] {
      return [...state.records]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    recordById: (state) => (id: string) => state.records.find((record) => record.id === id),
  },
  actions: {
    completeWechatLogin(name: string, avatarUrl = '', userId?: string) {
      const normalizedName = name.trim()
      if (!normalizedName) return false
      this.user = {
        id: userId,
        name: normalizedName,
        initial: normalizedName.slice(-1),
        avatarUrl: resolveAssetUrl(avatarUrl),
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
    updateUserProfile(name: string, avatarUrl?: string) {
      const normalizedName = name.trim()
      if (!normalizedName || !this.user.isLoggedIn) return false
      this.user = {
        ...this.user,
        name: normalizedName,
        initial: normalizedName.slice(-1),
        avatarUrl: avatarUrl === undefined ? this.user.avatarUrl : resolveAssetUrl(avatarUrl),
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
      this.relationship = createEmptyRelationship()
      this.records = []
      uni.removeStorageSync(userStorageKey)
      this.clearInvite()
      clearTokens()
    },
    replaceRecords(records: MoodRecord[]) {
      this.records = records
    },
    appendRecords(records: MoodRecord[]) {
      const existingIds = new Set(this.records.map((record) => record.id))
      this.records.push(...records.filter((record) => !existingIds.has(record.id)))
    },
    prependRecord(record: MoodRecord) {
      this.records = [record, ...this.records.filter((item) => item.id !== record.id)]
    },
    upsertRecord(record: MoodRecord) {
      const index = this.records.findIndex((item) => item.id === record.id)
      if (index === -1) this.records.unshift(record)
      else this.records[index] = record
    },
    setCurrentRelationship(result: CurrentRelationshipResponse) {
      if (!result.active || !result.relationship?.partner) {
        this.relationship = createEmptyRelationship()
        return
      }
      const partnerName = result.relationship.partner.nickname
      this.relationship = {
        id: result.relationship.id,
        partnerName,
        partnerInitial: partnerName.slice(-1),
        partnerAvatarUrl: resolveAssetUrl(result.relationship.partner.avatarUrl),
        startedAt: result.relationship.startedAt.slice(0, 10),
        active: true,
        daysTogether: result.relationship.stats.daysTogether,
        sharedMoodCount: result.relationship.stats.sharedMoodCount,
        responseCount: result.relationship.stats.responseCount,
      }
      this.clearInvite()
    },
    setInvite(invite: RelationshipInvite) {
      this.inviteCode = invite.code
      this.inviteExpiresAt = invite.expiresAt
      uni.setStorageSync(inviteStorageKey, invite)
    },
    clearInvite() {
      this.inviteCode = ''
      this.inviteExpiresAt = ''
      uni.removeStorageSync(inviteStorageKey)
    },
    addRecord(payload: { mood: MoodKind; emotion: string; content: string; recordDate: string; visibility: Visibility; allowComments: boolean }) {
      const now = new Date()
      const createdAt = `${todayString()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      this.records.unshift({
        id: `r-${Date.now()}`,
        authorId: 'me', authorName: this.user.name, ...payload, createdAt,
        likedByPartner: false, huggedByPartner: false, images: [], comments: [],
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
      this.clearInvite()
    },
  },
})
