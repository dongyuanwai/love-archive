<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import MoodMark from '@/components/MoodMark.vue'
import { useArchiveStore } from '@/stores/archive'
import type { MoodKind, Visibility } from '@/types/domain'
import { todayString } from '@/utils/date'
import { createMood, deletePendingMoodImage, uploadMoodImage } from '@/api/moods'

type DraftImageStatus = 'compressing' | 'ready' | 'uploading' | 'uploaded' | 'failed' | 'removing'

interface DraftImage {
  localId: string
  filePath: string
  status: DraftImageStatus
  uploadedId?: string
  error?: string
}

const maxMoodImages = 3
const maxMoodImageBytes = 3 * 1024 * 1024

const store = useArchiveStore()
const mood = ref<MoodKind>('happy')
const emotion = ref('愉快')
const content = ref('')
const recordDate = ref(todayString())
const visibility = ref<Visibility>('partner')
const allowComments = ref(true)
const publishing = ref(false)
const selectingImages = ref(false)
const draftImages = ref<DraftImage[]>([])
const publishStage = ref<'idle' | 'uploading' | 'creating'>('idle')
const uploadingNumber = ref(0)

const emotionOptions: Record<MoodKind, string[]> = {
  happy: ['愉快', '安心', '期待', '感动', '兴奋', '被爱'],
  sad: ['失落', '委屈', '焦虑', '生气', '孤独', '疲惫'],
}

const characterCount = computed(() => content.value.length)
const remainingImageCount = computed(() => maxMoodImages - draftImages.value.length)
const imageBusy = computed(() => draftImages.value.some((image) => ['compressing', 'uploading', 'removing'].includes(image.status)))
const canPublish = computed(() => (
  content.value.trim().length > 0
  && characterCount.value <= 1000
  && !publishing.value
  && !selectingImages.value
  && !imageBusy.value
))
const imageHint = computed(() => {
  if (publishStage.value === 'uploading') return `正在上传第 ${uploadingNumber.value} 张照片…`
  if (draftImages.value.some((image) => image.status === 'failed')) return '有照片上传失败，再次发布会从这里继续'
  if (draftImages.value.length && draftImages.value.every((image) => image.status === 'uploaded')) return '照片已上传，发布失败也无需重复上传'
  return '最多 3 张，单张不超过 3MB'
})
const publishLabel = computed(() => {
  if (!store.user.isLoggedIn) return '登录后收藏这一刻'
  if (publishStage.value === 'uploading') return `正在上传照片 ${uploadingNumber.value}/${draftImages.value.length}…`
  if (publishing.value) return '正在收藏…'
  return '收藏这一刻'
})

onShow(() => {
  if (!store.activeRelationship) visibility.value = 'private'
})

const chooseMood = (value: MoodKind) => {
  mood.value = value
  emotion.value = emotionOptions[value][0] ?? ''
}

const chooseDate = (event: { detail: { value: string } }) => { recordDate.value = event.detail.value }
const toggleComments = (event: unknown) => {
  allowComments.value = (event as { detail: { value: boolean } }).detail.value
}

const compressImage = (src: string) => new Promise<string>((resolve) => {
  uni.compressImage({
    src,
    quality: 80,
    compressedWidth: 1440,
    success: (result) => resolve(result.tempFilePath || src),
    fail: () => resolve(src),
  })
})

const getFileSize = (filePath: string) => new Promise<number>((resolve, reject) => {
  uni.getFileSystemManager().getFileInfo({
    filePath,
    success: (result) => resolve(result.size),
    fail: () => reject(new Error('暂时无法读取照片大小，请重试')),
  })
})

const chooseImages = async () => {
  if (selectingImages.value || publishing.value || remainingImageCount.value <= 0) return

  selectingImages.value = true
  try {
    const result = await new Promise<{ tempFiles: Array<{ tempFilePath: string }> }>((resolve, reject) => {
      uni.chooseMedia({
        count: remainingImageCount.value,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: resolve,
        fail: reject,
      })
    })
    const selected = result.tempFiles.slice(0, remainingImageCount.value).map((file, index): DraftImage => ({
      localId: `draft-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      filePath: file.tempFilePath,
      status: 'compressing',
    }))
    const processed = await Promise.all(selected.map(async (image) => {
      const filePath = await compressImage(image.filePath)
      const size = await getFileSize(filePath)
      return { ...image, filePath, size, status: 'ready' as const }
    }))
    const accepted = processed.filter((image) => image.size <= maxMoodImageBytes)
    const oversizedCount = processed.length - accepted.length
    draftImages.value.push(...accepted)
    if (oversizedCount > 0) {
      uni.showToast({
        title: oversizedCount === 1 ? '照片超过 3MB，已忽略' : oversizedCount + ' 张照片超过 3MB，已忽略',
        icon: 'none',
        duration: 2500,
      })
    }
  } catch (error) {
    const message = error && typeof error === 'object' && 'errMsg' in error
      ? String((error as { errMsg?: string }).errMsg || '')
      : ''
    if (!message.toLowerCase().includes('cancel')) {
      uni.showToast({
        title: error instanceof Error ? error.message : '暂时无法选择照片，请重试',
        icon: 'none',
      })
    }
  } finally {
    selectingImages.value = false
  }
}

const previewImage = (index: number) => {
  const urls = draftImages.value.map((image) => image.filePath).filter(Boolean)
  if (!urls.length) return
  uni.previewImage({
    current: urls[index] || urls[0],
    urls,
  })
}

const imageStatusLabel = (status: DraftImageStatus) => ({
  compressing: '压缩中',
  ready: '',
  uploading: '上传中',
  uploaded: '已上传',
  failed: '上传失败',
  removing: '移除中',
}[status])

const removeImage = async (image: DraftImage) => {
  if (publishing.value || selectingImages.value || ['compressing', 'uploading', 'removing'].includes(image.status)) return

  if (!image.uploadedId) {
    draftImages.value = draftImages.value.filter((item) => item.localId !== image.localId)
    return
  }

  image.status = 'removing'
  try {
    await deletePendingMoodImage(image.uploadedId)
    draftImages.value = draftImages.value.filter((item) => item.localId !== image.localId)
  } catch (error) {
    image.status = 'uploaded'
    uni.showToast({
      title: error instanceof Error ? error.message : '照片移除失败，请重试',
      icon: 'none',
    })
  }
}

const uploadImages = async () => {
  for (let index = 0; index < draftImages.value.length; index += 1) {
    const image = draftImages.value[index]
    if (!image || image.uploadedId) continue

    uploadingNumber.value = index + 1
    image.status = 'uploading'
    image.error = undefined
    try {
      const uploaded = await uploadMoodImage(image.filePath)
      image.uploadedId = uploaded.id
      image.status = 'uploaded'
    } catch (error) {
      image.status = 'failed'
      image.error = error instanceof Error ? error.message : '照片上传失败'
      throw error
    }
  }

  const imageIds = draftImages.value.map((image) => image.uploadedId).filter((id): id is string => Boolean(id))
  if (imageIds.length !== draftImages.value.length) throw new Error('还有照片未上传完成')
  return imageIds
}

const publish = async () => {
  if (!store.user.isLoggedIn) {
    uni.navigateTo({ url: '/pages/login/index?target=create&back=1' })
    return
  }
  if (!canPublish.value) {
    uni.showToast({
      title: selectingImages.value || imageBusy.value ? '照片还在处理中，请稍候' : '写下一点此刻的心情吧',
      icon: 'none',
    })
    return
  }
  publishing.value = true
  try {
    publishStage.value = draftImages.value.length ? 'uploading' : 'creating'
    const imageIds = await uploadImages()
    publishStage.value = 'creating'
    const record = await createMood({
      mood: mood.value,
      emotion: emotion.value,
      content: content.value.trim(),
      recordDate: recordDate.value,
      visibility: visibility.value,
      allowComments: visibility.value === 'partner' && allowComments.value,
      imageIds,
    }, store.user.id)
    store.prependRecord(record)
    content.value = ''
    draftImages.value = []
    recordDate.value = todayString()
    uni.showToast({ title: '这一刻已被收藏', icon: 'success' })
    setTimeout(() => uni.switchTab({ url: '/pages/index/index' }), 650)
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '发布失败，请稍后重试',
      icon: 'none',
      duration: 2500,
    })
  } finally {
    publishing.value = false
    publishStage.value = 'idle'
    uploadingNumber.value = 0
  }
}
</script>

<template>
  <view class="page-shell create-page">
    <view class="create-head">
      <text class="eyebrow">A MOMENT FOR YOU</text>
      <text class="create-head__title">此刻，你感觉怎么样？</text>
      <text class="create-head__desc">没有标准答案，诚实地陪陪自己就好。</text>
    </view>

    <view class="mood-switch">
      <button class="mood-choice mood-choice--happy" :class="{ 'mood-choice--active': mood === 'happy' }" @tap="chooseMood('happy')">
        <MoodMark mood="happy" size="large" />
        <text class="mood-choice__title">开心</text>
        <text class="mood-choice__desc">收藏今天的光</text>
      </button>
      <button class="mood-choice mood-choice--sad" :class="{ 'mood-choice--active': mood === 'sad' }" @tap="chooseMood('sad')">
        <MoodMark mood="sad" size="large" />
        <text class="mood-choice__title">难过</text>
        <text class="mood-choice__desc">让情绪有处安放</text>
      </button>
    </view>

    <view class="form-section">
      <text class="form-label">更像哪一种感受？</text>
      <view class="emotion-list">
        <button v-for="item in emotionOptions[mood]" :key="item" class="emotion-option" :class="[`emotion-option--${mood}`, { 'emotion-option--active': emotion === item }]" @tap="emotion = item">{{ item }}</button>
      </view>
    </view>

    <view class="writing-card card">
      <textarea v-model="content" class="writing-card__input" maxlength="1000" placeholder="写下发生了什么，或只是描述现在的感觉……" placeholder-class="writing-placeholder" />
      <view class="writing-card__meta"><text>慢慢写，不着急</text><text>{{ characterCount }}/1000</text></view>
    </view>

    <view class="photo-card card">
      <view class="photo-card__head">
        <view class="photo-card__intro">
          <text class="photo-card__title">这一刻的照片</text>
          <text class="photo-card__hint">{{ imageHint }}</text>
        </view>
        <text class="photo-card__count">{{ draftImages.length }}/{{ maxMoodImages }}</text>
      </view>

      <view class="photo-grid">
        <view
          v-for="(image, index) in draftImages"
          :key="image.localId"
          class="draft-photo"
          hover-class="tap-muted"
          role="button"
          :aria-label="`预览第 ${index + 1} 张照片`"
          @tap="previewImage(index)"
        >
          <image class="draft-photo__image" :src="image.filePath" mode="aspectFill" />
          <view
            v-if="['uploading', 'uploaded', 'failed', 'removing'].includes(image.status)"
            class="draft-photo__status"
            :class="[`draft-photo__status--${image.status}`]"
          >
            <text>{{ imageStatusLabel(image.status) }}</text>
          </view>
          <view
            class="draft-photo__remove"
            :class="{ 'draft-photo__remove--disabled': publishing || selectingImages || ['compressing', 'uploading', 'removing'].includes(image.status) }"
            hover-class="tap-muted"
            role="button"
            aria-label="移除照片"
            @tap.stop="removeImage(image)"
          >
            <text>×</text>
          </view>
        </view>

        <view
          v-if="remainingImageCount > 0"
          class="photo-add"
          :class="{ 'photo-add--disabled': selectingImages || publishing }"
          hover-class="tap-muted"
          role="button"
          aria-label="添加照片"
          @tap="chooseImages"
        >
          <view class="photo-add__icon"><AppIcon name="plus" :size="23" /></view>
          <text>{{ draftImages.length ? '继续添加' : '添加照片' }}</text>
        </view>
      </view>
    </view>

    <view class="settings card">
      <picker mode="date" :value="recordDate" :end="todayString()" @change="chooseDate">
        <view class="setting-row">
          <view class="setting-row__left"><view class="setting-icon"><AppIcon name="calendar" :size="18" /></view><view><text class="setting-title">记录日期</text><text class="setting-desc">{{ recordDate === todayString() ? '今天' : `${recordDate} · 补记` }}</text></view></view>
          <AppIcon name="chevron" :size="16" color="#aa9994" />
        </view>
      </picker>

      <view class="setting-row setting-row--top">
        <view class="setting-row__left"><view class="setting-icon"><AppIcon :name="visibility === 'private' ? 'lock' : 'heart'" :size="18" /></view><view><text class="setting-title">谁可以看</text><text class="setting-desc">{{ visibility === 'partner' ? `我和 ${store.activeRelationship?.partnerName}` : '仅自己可见' }}</text></view></view>
        <view class="mini-segments">
          <button v-if="store.activeRelationship" :class="{ active: visibility === 'partner' }" @tap="visibility = 'partner'">双方</button>
          <button :class="{ active: visibility === 'private' }" @tap="visibility = 'private'">仅自己</button>
        </view>
      </view>

      <view v-if="visibility === 'partner'" class="setting-row setting-row--top">
        <view class="setting-row__left"><view class="setting-icon"><AppIcon name="comment" :size="18" /></view><view><text class="setting-title">允许评论</text><text class="setting-desc">TA 可以温柔回应你</text></view></view>
        <switch :checked="allowComments" color="#d87263" @change="toggleComments" />
      </view>
    </view>

    <button class="primary-button publish" :class="{ 'publish--disabled': store.user.isLoggedIn && !canPublish }" :loading="publishing" :disabled="publishing || selectingImages" @tap="publish">{{ publishLabel }}</button>
    <text class="privacy-note"><AppIcon name="lock" :size="13" />你的私密记录不会出现在 TA 的报告里</text>
  </view>
</template>

<style scoped lang="scss">
.create-page { padding-bottom: calc(112rpx + env(safe-area-inset-bottom)); }
.create-head { padding: 12rpx 2rpx 38rpx; }
.create-head__title { display: block; margin-top: 18rpx; font-size: 46rpx; font-weight: 750; }
.create-head__desc { display: block; margin-top: 14rpx; color: #746663; font-size: 25rpx; }
.mood-switch { display: grid; grid-template-columns: 1fr 1fr; gap: 20rpx; }
.mood-choice { display: flex; min-height: 284rpx; flex-direction: column; align-items: center; justify-content: center; border: 3rpx solid transparent; border-radius: 28rpx; color: #514441; }
.mood-choice--happy { background: rgba(255, 234, 217, .72); }
.mood-choice--sad { background: rgba(226, 236, 246, .75); }
.mood-choice--active { border-color: #d17b6a; box-shadow: 0 12rpx 30rpx rgba(112, 76, 64, .10); }
.mood-choice--sad.mood-choice--active { border-color: #7896b0; }
.mood-choice__title, .mood-choice__desc { display: block; }
.mood-choice__title { margin-top: 16rpx; font-size: 31rpx; font-weight: 750; }
.mood-choice__desc { margin-top: 7rpx; color: #817370; font-size: 21rpx; }
.form-section { margin-top: 42rpx; }
.form-label { font-size: 29rpx; font-weight: 700; }
.emotion-list { display: flex; flex-wrap: wrap; gap: 14rpx; margin-top: 18rpx; }
.emotion-option { display: flex; min-width: 104rpx; height: 64rpx; padding: 0 22rpx; align-items: center; justify-content: center; border: 1rpx solid #eaded6; border-radius: 999rpx; background: #fff; color: #746662; font-size: 24rpx; line-height: 1; text-align: center; }
.emotion-option--active.emotion-option--happy { border-color: #e4a177; background: #ffe7d4; color: #8e5336; font-weight: 700; }
.emotion-option--active.emotion-option--sad { border-color: #91aeca; background: #e5eef6; color: #536f89; font-weight: 700; }
.writing-card { margin-top: 30rpx; padding: 28rpx; }
.writing-card__input { width: 100%; min-height: 280rpx; color: #453a37; font-size: 29rpx; line-height: 1.75; }
.writing-card__meta { display: flex; justify-content: space-between; color: #a0928e; font-size: 21rpx; }
:deep(.writing-placeholder) { color: #b4a6a1; }
.photo-card { margin-top: 26rpx; padding: 26rpx; }
.photo-card__head { display: flex; align-items: flex-start; justify-content: space-between; }
.photo-card__intro { min-width: 0; flex: 1; }
.photo-card__title, .photo-card__hint { display: block; }
.photo-card__title { color: #4d403d; font-size: 27rpx; font-weight: 700; }
.photo-card__hint { margin-top: 8rpx; color: #9a8b87; font-size: 20rpx; line-height: 1.45; }
.photo-card__count { flex: none; margin-left: 20rpx; color: #b06d62; font-size: 22rpx; font-weight: 650; }
.photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14rpx; margin-top: 22rpx; }
.draft-photo, .photo-add { position: relative; display: flex; height: 176rpx; overflow: hidden; align-items: center; justify-content: center; box-sizing: border-box; border-radius: 21rpx; }
.draft-photo { background: #f4e9e3; }
.draft-photo__image { display: block; width: 100%; height: 100%; }
.draft-photo__status { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(61, 48, 45, .48); color: #fff; font-size: 20rpx; font-weight: 650; }
.draft-photo__status--uploaded { inset: auto auto 9rpx 9rpx; min-height: 38rpx; padding: 0 12rpx; border-radius: 999rpx; background: rgba(63, 96, 72, .82); font-size: 18rpx; }
.draft-photo__status--failed { background: rgba(139, 67, 59, .66); }
.draft-photo__remove { position: absolute; top: 8rpx; right: 8rpx; display: flex; width: 42rpx; height: 42rpx; align-items: center; justify-content: center; border-radius: 50%; background: rgba(55, 43, 40, .72); color: #fff; font-size: 32rpx; line-height: 1; }
.draft-photo__remove text { transform: translateY(-1rpx); }
.draft-photo__remove--disabled { opacity: .5; }
.photo-add { flex-direction: column; gap: 10rpx; border: 2rpx dashed #e4c9bd; background: #fff9f5; color: #9a6258; font-size: 21rpx; }
.photo-add__icon { display: flex; width: 52rpx; height: 52rpx; align-items: center; justify-content: center; border-radius: 18rpx; background: #ffebe1; }
.photo-add--disabled { opacity: .5; }
.settings { margin-top: 26rpx; padding: 4rpx 24rpx; }
.setting-row { display: flex; min-height: 124rpx; align-items: center; justify-content: space-between; }
.setting-row--top { border-top: 1rpx solid #f1e9e4; }
.setting-row__left { display: flex; align-items: center; gap: 17rpx; }
.setting-icon { display: flex; width: 64rpx; height: 64rpx; align-items: center; justify-content: center; border-radius: 19rpx; background: #ffeadf; color: #95584e; }
.setting-title, .setting-desc { display: block; }
.setting-title { font-weight: 650; }
.setting-desc { margin-top: 6rpx; color: #938582; font-size: 21rpx; }
.mini-segments { display: flex; padding: 5rpx; border-radius: 17rpx; background: #f2e9e3; }
.mini-segments button { display: flex; height: 53rpx; padding: 0 18rpx; align-items: center; justify-content: center; border-radius: 13rpx; background: transparent; color: #8e807c; font-size: 21rpx; line-height: 1; text-align: center; }
.mini-segments button.active { background: #fff; color: #9c564d; font-weight: 700; }
.publish { margin-top: 32rpx; }
.publish--disabled { opacity: .48; box-shadow: none; }
.privacy-note { display: flex; gap: 8rpx; margin-top: 18rpx; align-items: center; justify-content: center; color: #9a8b87; font-size: 21rpx; }
</style>
