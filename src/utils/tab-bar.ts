interface TabBarInstance {
  setData(data: { selected: number }): void
}

interface PageWithTabBar {
  route?: string
  getTabBar?: (callback?: (tabBar: TabBarInstance) => void) => TabBarInstance | undefined
}

const tabRoutes = [
  'pages/index/index',
  'pages/anniversary/index',
  'pages/insights/index',
  'pages/profile/index',
]

export const syncTabBarSelection = () => {
  const pages = getCurrentPages()
  const page = pages[pages.length - 1] as unknown as PageWithTabBar | undefined
  if (!page?.route || typeof page.getTabBar !== 'function') return

  const selected = tabRoutes.indexOf(page.route.replace(/^\//, ''))
  if (selected < 0) return

  const update = (tabBar?: TabBarInstance) => tabBar?.setData({ selected })
  const tabBar = page.getTabBar(update)
  update(tabBar)
}
