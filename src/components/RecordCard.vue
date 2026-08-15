<script setup lang="ts">
import type { MoodRecord } from '@/types/domain'
import { formatDateTime } from '@/utils/date'
import AppIcon from './AppIcon.vue'
import MoodMark from './MoodMark.vue'
import { useArchiveStore } from '@/stores/archive'

defineProps<{ record: MoodRecord }>()
const emit = defineEmits<{ respond: [id: string]; open: [id: string] }>()
const store = useArchiveStore()
</script>

<template>
  <view class="record card" @tap="emit('open', record.id)">
    <view class="record__head">
      <view class="author">
        <view class="avatar" :class="{ 'avatar--partner': record.authorId === 'partner' }">
          <image v-if="record.authorId === 'me' && store.user.avatarUrl" class="avatar__image" :src="store.user.avatarUrl" mode="aspectFill" />
          <text v-else>{{ record.authorName.slice(-1) }}</text>
        </view>
        <view>
          <view class="author__line">
            <text class="author__name">{{ record.authorName }}</text>
            <text v-if="record.isBackfilled" class="tag">补记</text>
            <AppIcon v-if="record.visibility === 'private'" name="lock" :size="13" color="#897875" />
          </view>
          <text class="record__time">{{ formatDateTime(record.createdAt) }}</text>
        </view>
      </view>
      <view class="emotion-chip" :class="`emotion-chip--${record.mood}`">
        <MoodMark :mood="record.mood" size="small" />
        <text>{{ record.emotion }}</text>
      </view>
    </view>

    <text class="record__content">{{ record.content }}</text>

    <view class="record__footer" @tap.stop>
      <button
        v-if="record.authorId === 'partner'"
        class="action action--response"
        :class="[
          `action--${record.mood}`,
          { 'action--active': record.mood === 'happy' ? record.likedByPartner : record.huggedByPartner },
        ]"
        @tap="emit('respond', record.id)"
      >
        <AppIcon
          :name="record.mood === 'happy' ? 'heart' : 'hug'"
          :size="record.mood === 'happy' ? 18 : 19"
          :filled="record.mood === 'happy' && record.likedByPartner"
        />
        <text v-if="record.mood === 'happy'">{{ record.likedByPartner ? '已为你开心' : '为你开心' }}</text>
        <text v-else>{{ record.huggedByPartner ? '已抱抱' : '抱抱' }}</text>
      </button>
      <button class="action" @tap="emit('open', record.id)">
        <AppIcon name="comment" :size="18" />
        <text>{{ record.comments.length ? `已有 ${record.comments.length} 条评论` : '暂无评论' }}</text>
      </button>
    </view>

    <view v-if="record.comments[0]" class="comment-preview">
      <text class="comment-preview__name">{{ record.comments[0]?.authorName }}</text>
      <text>：{{ record.comments[0]?.content }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.record { padding: 28rpx 26rpx 24rpx; overflow: hidden; }
.record__head, .author, .author__line, .emotion-chip, .record__footer, .action { display: flex; align-items: center; }
.record__head { justify-content: space-between; }
.author { gap: 18rpx; }
.avatar { display: flex; width: 68rpx; height: 68rpx; align-items: center; justify-content: center; border-radius: 21rpx; background: #f7bb94; color: #704237; font-weight: 700; }
.avatar--partner { background: #cadbea; color: #4f6880; }
.avatar__image { display: block; width: 100%; height: 100%; border-radius: inherit; }
.author__line { gap: 10rpx; }
.author__name { font-weight: 700; }
.record__time { display: block; margin-top: 5rpx; color: #867875; font-size: 22rpx; }
.tag { padding: 3rpx 10rpx; border-radius: 10rpx; background: #f5ede7; color: #8c7670; font-size: 19rpx; }
.emotion-chip { gap: 8rpx; padding: 7rpx 14rpx 7rpx 8rpx; border-radius: 999rpx; font-size: 22rpx; font-weight: 700; }
.emotion-chip--happy { background: #fff0e4; color: #8e5639; }
.emotion-chip--sad { background: #eef3f8; color: #58708a; }
.record__content { display: block; margin: 24rpx 0 22rpx; color: #473b38; font-size: 28rpx; line-height: 1.78; }
.record__footer { gap: 16rpx; padding-top: 19rpx; border-top: 1rpx solid #f1e8e3; }
.action { gap: 8rpx; min-height: 58rpx; flex: 1; justify-content: center; border-radius: 18rpx; background: transparent; color: #786b67; font-size: 23rpx; }
.action--response { min-height: 50rpx; padding: 0 18rpx; flex: 0 0 auto; border-radius: 16rpx; background: #fbf4ef; font-size: 21rpx; }
.action--sad { background: #f0f5f9; }
.action--happy.action--active { background: #fff0e8; color: #c65f52; font-weight: 650; }
.action--sad.action--active { background: #e9f1f7; color: #5f7f9b; font-weight: 650; }
.comment-preview { margin-top: 18rpx; padding: 18rpx 20rpx; border-radius: 17rpx; background: #fbf5f0; color: #615451; font-size: 23rpx; line-height: 1.6; }
.comment-preview__name { color: #a1574d; font-weight: 650; }
</style>
