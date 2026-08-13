import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

const manifestPath = path.resolve(__dirname, 'src/manifest.json')

function syncWeixinAppId(mode: string) {
  const env = loadEnv(mode, process.cwd(), '')
  const weixinAppId = env.VITE_MP_WEIXIN_APP_ID?.trim()

  if (!weixinAppId) return

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

  if (manifest?.['mp-weixin']?.appid === weixinAppId) return

  manifest['mp-weixin'] = {
    ...manifest['mp-weixin'],
    appid: weixinAppId,
  }

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}

export default defineConfig(({ mode }) => {
  syncWeixinAppId(mode)

  return {
    plugins: [uni()],
  }
})
