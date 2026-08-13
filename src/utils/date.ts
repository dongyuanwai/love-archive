export const formatShortDate = (date: string) => {
  const parsed = new Date(date.replace(/-/g, '/'))
  return `${parsed.getMonth() + 1}月${parsed.getDate()}日`
}

export const formatDateTime = (date: string) => {
  const parsed = new Date(date.replace(/-/g, '/'))
  const minute = String(parsed.getMinutes()).padStart(2, '0')
  return `${parsed.getMonth() + 1}月${parsed.getDate()}日 ${parsed.getHours()}:${minute}`
}

export const todayString = () => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}
