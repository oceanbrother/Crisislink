const RAW_API_BASE_URL = String(import.meta.env.VITE_API_URL || '').trim()
const HAS_ABSOLUTE_API_BASE = /^https?:\/\//i.test(RAW_API_BASE_URL)

// prepends the absolute API base to a path when the env var points to a remote host
function withApiBase(pathname) {
  if (!HAS_ABSOLUTE_API_BASE) return pathname
  return RAW_API_BASE_URL.replace(/\/$/, '') + pathname
}

// turns any raw image value from the backend into a usable URL for the browser
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
