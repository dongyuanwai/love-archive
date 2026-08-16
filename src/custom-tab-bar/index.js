const userStorageKey = 'love-archive:test-new-user'
const accessTokenKey = 'love-archive:access-token'

Component({
  data: {
    selected: 0,
    color: '#8B7E7A',
    selectedColor: '#D87263',
    list: [
      {
        pagePath: '/pages/index/index',
        text: '首页',
        iconPath: '/static/icons/tabbar/archive.png',
        selectedIconPath: '/static/icons/tabbar/archive-active.png',
      },
      {
        pagePath: '/pages/create/index',
        text: '记录',
        target: 'create',
        iconPath: '/static/icons/tabbar/create.png',
        selectedIconPath: '/static/icons/tabbar/create-active.png',
      },
      {
        pagePath: '/pages/insights/index',
        text: '回顾',
        target: 'insights',
        iconPath: '/static/icons/tabbar/insights.png',
        selectedIconPath: '/static/icons/tabbar/insights-active.png',
      },
      {
        pagePath: '/pages/profile/index',
        text: '我的',
        target: 'profile',
        iconPath: '/static/icons/tabbar/profile.png',
        selectedIconPath: '/static/icons/tabbar/profile-active.png',
      },
    ],
  },
  lifetimes: {
    attached() {
      this.syncSelected()
    },
  },
  pageLifetimes: {
    show() {
      this.syncSelected()
    },
  },
  methods: {
    syncSelected() {
      const pages = getCurrentPages()
      const route = pages.length ? `/${pages[pages.length - 1].route}` : ''
      const selected = this.data.list.findIndex((item) => item.pagePath === route)
      if (selected >= 0) this.setData({ selected })
    },
    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index)
      const item = this.data.list[index]
      if (!item) return

      if (item.target) {
        const user = wx.getStorageSync(userStorageKey)
        const accessToken = wx.getStorageSync(accessTokenKey)
        if (!user || !user.isLoggedIn || !accessToken) {
          wx.navigateTo({ url: `/pages/login/index?target=${item.target}` })
          return
        }
      }

      wx.switchTab({
        url: item.pagePath,
        success: () => this.setData({ selected: index }),
      })
    },
  },
})
