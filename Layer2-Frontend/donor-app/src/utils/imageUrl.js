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
    return value
  }

  if (
    value.startsWith('static/') ||
    value.startsWith('uploads/') ||
    value.startsWith('images/')
  ) {
    return '/' + value
  }

  return value
}
