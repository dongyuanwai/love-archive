import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

const manifestPath = path.resolve(__dirname, 'src/manifest.json')

const privateProjectConfig = {
  description: '项目私有配置文件。此文件由编译过程在缺失时创建，微信开发者工具可继续写入本机设置。',
}

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

function ensureWeixinPrivateConfig(mode: string) {
  if (process.env.UNI_PLATFORM !== 'mp-weixin') return

  const outputType = mode === 'production' ? 'build' : 'dev'
  const outputDir = path.resolve(__dirname, `dist/${outputType}/mp-weixin`)
  const configPath = path.join(outputDir, 'project.private.config.json')

  fs.mkdirSync(outputDir, { recursive: true })
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(
      configPath,
      `${JSON.stringify(privateProjectConfig, null, 2)}\n`,
      'utf8',
    )
  }
}

export default defineConfig(({ mode }) => {
  syncWeixinAppId(mode)

  return {
    plugins: [
      uni(),
      {
        name: 'ensure-weixin-private-project-config',
        closeBundle() {
          ensureWeixinPrivateConfig(mode)
        },
      },
    ],
  }
})
