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
        pagePath: '/pages/anniversary/index',
        text: '纪念日',
        iconPath: '/static/icons/tabbar/create.png',
        selectedIconPath: '/static/icons/tabbar/create-active.png',
      },
      {
        pagePath: '/pages/insights/index',
        text: '回顾',
        iconPath: '/static/icons/tabbar/insights.png',
        selectedIconPath: '/static/icons/tabbar/insights-active.png',
      },
      {
        pagePath: '/pages/profile/index',
        text: '我的',
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

      if (index === this.data.selected) return

      this.setData({ selected: index })
      wx.switchTab({
        url: item.pagePath,
        fail: () => this.syncSelected(),
      })
    },
  },
})
