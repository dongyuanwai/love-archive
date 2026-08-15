<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import MoodMark from '@/components/MoodMark.vue'
import { useArchiveStore } from '@/stores/archive'
import { formatDateTime } from '@/utils/date'
import { getMoodDetail } from '@/api/moods'
import { addReaction, removeReaction } from '@/api/reactions'
import { createComment, editComment as requestEditComment } from '@/api/comments'

const store = useArchiveStore()
const recordId = ref('')
const comment = ref('')
const editingCommentId = ref('')
const editingComment = ref('')
const record = computed(() => store.recordById(recordId.value))
const detailLoading = ref(true)
const detailError = ref('')
const reactionLoading = ref(false)
const commentSaving = ref(false)

const loadDetail = async () => {
  if (!recordId.value) {
    detailError.value = '缺少心情记录 ID'
    detailLoading.value = false
    return
  }
  detailLoading.value = true
  detailError.value = ''
  try {
    store.upsertRecord(await getMoodDetail(recordId.value, store.user.id))
  } catch (error) {
    detailError.value = error instanceof Error ? error.message : '心情详情加载失败'
  } finally {
    detailLoading.value = false
  }
}

onLoad((query) => {
  recordId.value = String(query?.id || '')
  void loadDetail()
})

const submitComment = async () => {
  if (!comment.value.trim()) return
  commentSaving.value = true
  try {
    await createComment(recordId.value, comment.value)
    comment.value = ''
    await loadDetail()
    uni.showToast({ title: '回应已送达', icon: 'none' })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '评论发送失败', icon: 'none' })
  } finally {
    commentSaving.value = false
  }
}

const startEditComment = (commentId: string, content: string) => {
  editingCommentId.value = commentId
  editingComment.value = content
}

const cancelEditComment = () => {
  editingCommentId.value = ''
  editingComment.value = ''
}

const saveComment = async (commentId: string) => {
  if (!editingComment.value.trim()) {
    uni.showToast({ title: '评论内容不能为空', icon: 'none' })
    return
  }
  commentSaving.value = true
  try {
    await requestEditComment(commentId, editingComment.value)
    await loadDetail()
    cancelEditComment()
    uni.showToast({ title: '评论已更新', icon: 'none' })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '评论修改失败', icon: 'none' })
  } finally {
    commentSaving.value = false
  }
}

const toggleReaction = async () => {
  if (!record.value || reactionLoading.value) return
  if (record.value.authorId === 'me') {
    uni.showToast({ title: '这是你自己的心情', icon: 'none' })
    return
  }
  reactionLoading.value = true
  try {
    const active = record.value.mood === 'happy' ? record.value.likedByPartner : record.value.huggedByPartner
    if (active) await removeReaction(record.value.id)
    else await addReaction(record.value.id)
    await loadDetail()
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '回应失败', icon: 'none' })
  } finally {
    reactionLoading.value = false
  }
}
</script>

<template>
  <view v-if="detailLoading" class="page-shell">
    <view class="empty-state card"><text class="empty-state__title">正在打开这份心情</text><text class="empty-state__desc">请稍等一下。</text></view>
  </view>
  <view v-else-if="record" class="page-shell detail-page">
    <view class="detail-card card" :class="`detail-card--${record.mood}`">
      <view class="detail-card__top">
        <view class="author">
          <view class="avatar" :class="{ 'avatar--partner': record.authorId === 'partner' }"><image v-if="record.authorId === 'me' && store.user.avatarUrl" class="avatar__image" :src="store.user.avatarUrl" mode="aspectFill" /><text v-else>{{ record.authorName.slice(-1) }}</text></view>
          <view><text class="author__name">{{ record.authorName }}</text><text class="record-time">{{ formatDateTime(record.createdAt) }}</text></view>
        </view>
      </view>
      <view class="mood-center">
        <MoodMark :mood="record.mood" size="large" />
        <text class="mood-center__label">{{ record.mood === 'happy' ? '开心' : '难过' }} · {{ record.emotion }}</text>
        <text v-if="record.isBackfilled" class="backfill">补记于 {{ record.recordDate }}</text>
      </view>
      <text class="detail-content">{{ record.content }}</text>
      <view class="visibility"><AppIcon :name="record.visibility === 'private' ? 'lock' : 'heart'" :size="14" /><text>{{ record.visibility === 'private' ? '仅自己可见' : `我和 ${store.activeRelationship?.partnerName || 'TA'} 可见` }}</text></view>
    </view>

    <view v-if="record.authorId === 'partner'" class="reaction-card card">
      <button
        class="reaction"
        :class="[
          `reaction--${record.mood}`,
          { active: record.mood === 'happy' ? record.likedByPartner : record.huggedByPartner },
        ]"
        :loading="reactionLoading"
        :disabled="reactionLoading"
        @tap="toggleReaction"
      >
        <view class="reaction__icon">
          <AppIcon
            :name="record.mood === 'happy' ? 'heart' : 'hug'"
            :size="24"
            :filled="record.mood === 'happy' && record.likedByPartner"
          />
        </view>
        <view class="reaction__copy">
          <text class="reaction__title" v-if="record.mood === 'happy'">{{ record.likedByPartner ? '已为你开心' : '为你开心' }}</text>
          <text class="reaction__title" v-else>{{ record.huggedByPartner ? '已给你抱抱' : '给你一个抱抱' }}</text>
          <text class="reaction__desc">{{ record.mood === 'happy' ? '一起收藏这份快乐' : '我在这里陪着你' }}</text>
        </view>
      </button>
    </view>

    <text class="section-title">
      温柔回应
      <text class="comment-count">{{ record.comments.length ? `已有 ${record.comments.length} 条评论` : '暂无评论' }}</text>
    </text>
    <view v-if="record.comments.length" class="comments card">
      <view v-for="item in record.comments" :key="item.id" class="comment-item">
        <view class="comment-avatar"><image v-if="item.authorId === 'me' && store.user.avatarUrl" class="avatar__image" :src="store.user.avatarUrl" mode="aspectFill" /><text v-else>{{ item.authorName.slice(-1) }}</text></view>
        <view class="comment-body">
          <view class="comment-meta">
            <text>{{ item.authorName }}</text>
            <view class="comment-meta__actions">
              <text>{{ item.createdAt }}</text>
              <text v-if="item.isEdited" class="edited-tag">已编辑</text>
              <button
                v-if="item.authorId === 'me' && editingCommentId !== item.id"
                class="edit-comment"
                @tap="startEditComment(item.id, item.content)"
              >编辑</button>
            </view>
          </view>
          <view v-if="editingCommentId === item.id" class="comment-editor">
            <input v-model="editingComment" class="comment-editor__input" maxlength="200" focus />
            <view class="comment-editor__actions">
              <button class="comment-editor__cancel" @tap="cancelEditComment">取消</button>
              <button class="comment-editor__save" :class="{ disabled: !editingComment.trim() }" :loading="commentSaving" :disabled="commentSaving" @tap="saveComment(item.id)">保存</button>
            </view>
          </view>
          <text v-else class="comment-text">{{ item.content }}</text>
        </view>
      </view>
    </view>
    <view v-else class="empty-comments card"><text>还没有回应</text><text class="muted">一句“我在”，也能让心情被接住。</text></view>

    <view v-if="record.allowComments && record.visibility === 'partner'" class="comment-box card">
      <input v-model="comment" class="comment-input" maxlength="200" placeholder="写一句温柔的回应……" />
      <button class="send-button" :class="{ disabled: !comment.trim() }" :loading="commentSaving" :disabled="commentSaving" @tap="submitComment">发送</button>
    </view>
    <view v-else class="comments-closed"><AppIcon name="lock" :size="14" /><text>{{ record.visibility === 'private' ? '私密记录只有自己能看到' : '这条记录已关闭评论' }}</text></view>
  </view>
  <view v-else class="page-shell"><view class="empty-state card"><text class="empty-state__title">记录暂时无法查看</text><text class="empty-state__desc">{{ detailError || '请返回心情存档后重新进入。' }}</text><button class="detail-retry" @tap="loadDetail">重新加载</button></view></view>
</template>

<style scoped lang="scss">
.detail-card { padding: 30rpx; }
.detail-card--happy { background: linear-gradient(145deg, #fff, #fff3e9); }
.detail-card--sad { background: linear-gradient(145deg, #fff, #eef4fa); }
.detail-card__top, .author, .visibility, .reaction-card, .reaction, .comment-meta, .comment-box, .comments-closed { display: flex; align-items: center; }
.detail-card__top { justify-content: space-between; }
.author { gap: 16rpx; }
.avatar { display: flex; width: 70rpx; height: 70rpx; align-items: center; justify-content: center; border-radius: 24rpx; background: #f8c6a5; color: #7a4738; font-weight: 700; }
.avatar--partner { background: #cadbea; color: #4f6880; }
.avatar__image { display: block; width: 100%; height: 100%; border-radius: inherit; }
.author__name, .record-time { display: block; }
.author__name { font-weight: 700; }
.record-time { margin-top: 6rpx; color: #968783; font-size: 22rpx; }
.mood-center { display: flex; flex-direction: column; align-items: center; margin: 40rpx 0 32rpx; }
.mood-center__label { margin-top: 17rpx; font-size: 31rpx; font-weight: 750; }
.backfill { margin-top: 7rpx; color: #998985; font-size: 21rpx; }
.detail-content { display: block; font-size: 31rpx; line-height: 1.9; }
.visibility { gap: 7rpx; margin-top: 28rpx; color: #8e7e7a; font-size: 22rpx; }
.reaction-card { margin-top: 22rpx; padding: 12rpx; }
.reaction { gap: 14rpx; min-height: 84rpx; padding: 0 18rpx; justify-content: flex-start; border-radius: 19rpx; background: #fff5ef; color: #8d554c; text-align: left; }
.reaction--sad { background: #eef4f8; color: #5e7890; }
.reaction__icon { display: flex; width: 54rpx; height: 54rpx; flex: none; align-items: center; justify-content: center; border-radius: 17rpx; background: #ffe8dc; }
.reaction--sad .reaction__icon { background: #dfeaf3; }
.reaction__copy { flex: 1; }
.reaction__title, .reaction__desc { display: block; }
.reaction__title { font-size: 24rpx; font-weight: 700; }
.reaction__desc { margin-top: 4rpx; color: #8b7a75; font-size: 19rpx; font-weight: 400; }
.reaction--sad .reaction__desc { color: #71879a; }
.reaction.active { background: #ffece3; color: #b85449; }
.reaction--sad.active { background: #e2edf5; color: #55758f; }
.comment-count { color: #ad7167; font-size: 25rpx; }
.comments { padding: 8rpx 26rpx; }
.comment-item { display: flex; gap: 16rpx; padding: 24rpx 0; border-bottom: 1rpx solid #f1e9e4; }
.comment-item:last-child { border-bottom: 0; }
.comment-avatar { display: flex; width: 58rpx; height: 58rpx; flex: none; align-items: center; justify-content: center; border-radius: 20rpx; background: #f2ded2; color: #885b50; font-size: 23rpx; font-weight: 700; }
.comment-body { flex: 1; }
.comment-meta { justify-content: space-between; color: #72625f; font-size: 23rpx; font-weight: 650; }
.comment-meta__actions { display: flex; align-items: center; gap: 14rpx; }
.comment-meta__actions > text { color: #aa9b97; font-size: 19rpx; font-weight: 400; }
.edited-tag { color: #9b8883 !important; }
.edit-comment { min-width: 76rpx; min-height: 56rpx; padding: 0 14rpx; border-radius: 16rpx; background: #f8f1ec; color: #9b5f56; font-size: 20rpx; }
.comment-text { display: block; margin-top: 10rpx; line-height: 1.65; }
.comment-editor { margin-top: 14rpx; padding: 14rpx; border-radius: 18rpx; background: #fbf6f2; }
.comment-editor__input { min-height: 72rpx; padding: 0 18rpx; border: 1rpx solid #e7d8d0; border-radius: 16rpx; background: #fff; }
.comment-editor__actions { display: flex; gap: 16rpx; justify-content: flex-end; margin-top: 14rpx; }
.comment-editor__cancel, .comment-editor__save { min-width: 120rpx; min-height: 70rpx; border-radius: 18rpx; font-size: 22rpx; }
.comment-editor__cancel { border: 1rpx solid #eadbd2; background: #fff; color: #786b67; }
.comment-editor__save { background: #d87263; color: #fff; font-weight: 700; }
.comment-editor__save.disabled { opacity: .45; }
.empty-comments { padding: 38rpx; text-align: center; }
.empty-comments text { display: block; }
.empty-comments .muted { margin-top: 9rpx; font-size: 23rpx; }
.comment-box { gap: 15rpx; margin-top: 22rpx; padding: 16rpx 16rpx 16rpx 24rpx; }
.comment-input { flex: 1; min-height: 70rpx; }
.send-button { min-width: 110rpx; min-height: 64rpx; border-radius: 20rpx; background: #d87263; color: #fff; font-size: 24rpx; font-weight: 700; }
.send-button.disabled { opacity: .45; }
.comments-closed { gap: 8rpx; justify-content: center; margin-top: 24rpx; color: #9b8c88; font-size: 22rpx; }
.detail-retry { display: flex; min-height: 72rpx; margin: 22rpx auto 0; padding: 0 28rpx; align-items: center; justify-content: center; border-radius: 20rpx; background: #d87263; color: #fff; font-size: 23rpx; font-weight: 700; line-height: 1; }
</style>
