<script setup lang="ts">
import { onLaunch, onPageNotFound } from '@dcloudio/uni-app'
import { installAuthNavigationGuard } from '@/utils/auth-navigation'

const homePath = '/pages/index/index'

onLaunch(() => {
  installAuthNavigationGuard()
  console.info('爱恋存档已启动')
})

onPageNotFound(() => {
  uni.reLaunch({ url: homePath })
})
</script>

<style lang="scss">
@use './styles/global.scss';
</style>
