import { defineStore } from 'pinia'
import {
  createImportantDay,
  deleteImportantDay,
  getImportantDay,
  getNearestImportantDay,
  listImportantDays,
  updateImportantDay,
  type ImportantDayDraft,
} from '@/api/important-days'
import type { Anniversary } from '@/types/domain'
import { sortAnniversaries } from '@/utils/anniversary'

export type AnniversaryDraft = ImportantDayDraft

let listRequestId = 0
let nearestRequestId = 0

const errorMessage = (error: unknown) => error instanceof Error ? error.message : '加载重要日子失败'

export const useAnniversaryStore = defineStore('anniversary', {
  state: () => ({
    items: [] as Anniversary[],
    nearestItem: null as Anniversary | null,
    currentUserId: '',
    loaded: false,
    loading: false,
    error: '',
    nearestLoaded: false,
    nearestLoading: false,
    nearestError: '',
  }),
  getters: {
    sortedItems: (state): Anniversary[] => sortAnniversaries(state.items),
    itemById: (state) => (id: string) => state.items.find((item) => item.id === id),
  },
  actions: {
    prepareUser(userId?: string) {
      const normalizedUserId = userId || ''
      if (this.currentUserId === normalizedUserId) return
      listRequestId += 1
      nearestRequestId += 1
      this.currentUserId = normalizedUserId
      this.items = []
      this.nearestItem = null
      this.loaded = false
      this.loading = false
      this.error = ''
      this.nearestLoaded = false
      this.nearestLoading = false
      this.nearestError = ''
    },
    reset() {
      this.prepareUser('')
    },
    async loadForUser(userId?: string, force = false) {
      this.prepareUser(userId)
      if (!this.currentUserId || this.loading || (this.loaded && !force)) return
      const requestId = ++listRequestId
      this.loading = true
      this.error = ''
      try {
        const pageSize = 50
        const firstPage = await listImportantDays({ page: 1, pageSize })
        const items = [...firstPage.items]
        const pageCount = Math.ceil(firstPage.pagination.total / pageSize)
        for (let page = 2; page <= pageCount; page += 1) {
          const result = await listImportantDays({ page, pageSize })
          items.push(...result.items)
        }
        if (requestId !== listRequestId) return
        this.items = items
        this.nearestItem = sortAnniversaries(items).find((item) => !item.archived) || null
        this.loaded = true
      } catch (error) {
        if (requestId === listRequestId) this.error = errorMessage(error)
      } finally {
        if (requestId === listRequestId) this.loading = false
      }
    },
    async loadNearest(userId?: string, force = false) {
      this.prepareUser(userId)
      if (!this.currentUserId || this.nearestLoading || (this.nearestLoaded && !force)) return
      const requestId = ++nearestRequestId
      this.nearestLoading = true
      this.nearestError = ''
      try {
        const item = await getNearestImportantDay()
        if (requestId !== nearestRequestId) return
        this.nearestItem = item
        this.nearestLoaded = true
      } catch (error) {
        if (requestId === nearestRequestId) this.nearestError = errorMessage(error)
      } finally {
        if (requestId === nearestRequestId) this.nearestLoading = false
      }
    },
    async loadDetail(id: string) {
      const item = await getImportantDay(id)
      const index = this.items.findIndex((current) => current.id === id)
      if (index >= 0) this.items[index] = item
      else this.items.push(item)
      return item
    },
    async create(draft: AnniversaryDraft) {
      const item = await createImportantDay(draft)
      this.items.push(item)
      this.loaded = true
      this.nearestLoaded = false
      return item
    },
    async update(id: string, draft: AnniversaryDraft) {
      const item = await updateImportantDay(id, draft)
      const index = this.items.findIndex((current) => current.id === id)
      if (index >= 0) this.items[index] = item
      else this.items.push(item)
      this.nearestLoaded = false
      return item
    },
    async remove(id: string) {
      await deleteImportantDay(id)
      this.items = this.items.filter((item) => item.id !== id)
      if (this.nearestItem?.id === id) this.nearestItem = null
      this.nearestLoaded = false
    },
  },
})
