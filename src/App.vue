<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { installAuthNavigationGuard } from '@/utils/auth-navigation'

onLaunch(() => {
  installAuthNavigationGuard()
  console.info('爱恋存档已启动')
})
</script>

<style lang="scss">
@use './styles/global.scss';
</style>
