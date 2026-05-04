const RAW_API_BASE_URL = String(import.meta.env.VITE_API_URL || '').trim()
const HAS_ABSOLUTE_API_BASE = /^https?:\/\//i.test(RAW_API_BASE_URL)

function withApiBase(pathname) {
  if (!HAS_ABSOLUTE_API_BASE) return pathname
  return RAW_API_BASE_URL.replace(/\/$/, '') + pathname
}

export function resolveImageUrl(rawUrl) {
  const value = String(rawUrl || '').trim()
  if (!value) return ''

  if (
    value.startsWith('blob:') ||
    value.startsWith('data:') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('//')
  ) {
    return value
  }

  if (value.startsWith('/')) {
    return withApiBase(value)
  }

  if (
    value.startsWith('static/') ||
    value.startsWith('uploads/') ||
    value.startsWith('images/')
  ) {
    return withApiBase('/' + value)
  }

  return value
}
