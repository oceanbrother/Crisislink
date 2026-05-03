const STORAGE_KEY = 'crisislink-listing-safety-v1'

function readSafetyMap() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeSafetyMap(map) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore storage errors
  }
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return []
  return tags.map((tag) => String(tag || '').trim()).filter(Boolean)
}

function normalizeStorage(storageCondition) {
  const value = String(storageCondition || '').trim()
  return value || ''
}

export function rememberListingSafety(listingId, { allergenTags = [], storageCondition = '' } = {}) {
  const key = String(listingId || '').trim()
  if (!key) return
  const map = readSafetyMap()
  map[key] = {
    allergenTags: normalizeTags(allergenTags),
    storageCondition: normalizeStorage(storageCondition),
    savedAt: Date.now(),
  }
  writeSafetyMap(map)
}

export function getRememberedListingSafety(listingId) {
  const key = String(listingId || '').trim()
  if (!key) return null
  const map = readSafetyMap()
  const record = map[key]
  if (!record || typeof record !== 'object') return null
  return {
    allergenTags: normalizeTags(record.allergenTags),
    storageCondition: normalizeStorage(record.storageCondition),
  }
}

export function mergeListingSafetyFallback(listing) {
  if (!listing || !listing.id) return listing

  const remembered = getRememberedListingSafety(listing.id)
  if (!remembered) return listing

  const currentAllergenTags = Array.isArray(listing.allergenTags)
    ? listing.allergenTags
    : (Array.isArray(listing.allergen_tags) ? listing.allergen_tags : [])
  const currentStorage = String(listing.storageCondition || listing.storage_condition || '').trim()

  if (currentAllergenTags.length > 0 && currentStorage) {
    return listing
  }

  const nextAllergenTags = currentAllergenTags.length > 0 ? currentAllergenTags : remembered.allergenTags
  const nextStorage = currentStorage || remembered.storageCondition

  return {
    ...listing,
    allergenTags: nextAllergenTags,
    allergen_tags: nextAllergenTags,
    storageCondition: nextStorage,
    storage_condition: nextStorage,
  }
}
