/// <reference types="@dcloudio/types" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_USE_DEV_WECHAT_LOGIN?: string
  readonly VITE_DEV_WECHAT_USER?: string
  readonly VITE_MP_WEIXIN_APP_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
