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
    // Ignore quota/private-mode failures; form flow should still continue.
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

function normalizePickupWindow(pickupWindow) {
  const value = String(pickupWindow || '').trim()
  return value || ''
}

export function rememberListingSafety(listingId, { allergenTags = [], storageCondition = '', pickupWindow = '' } = {}) {
  // Cache donor-entered safety fields so they can be restored if backend payloads omit them.
  const key = String(listingId || '').trim()
  if (!key) return
  const map = readSafetyMap()
  map[key] = {
    allergenTags: normalizeTags(allergenTags),
    storageCondition: normalizeStorage(storageCondition),
    pickupWindow: normalizePickupWindow(pickupWindow),
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
    pickupWindow: normalizePickupWindow(record.pickupWindow),
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
  const currentPickupWindow = String(listing.pickupWindow || listing.pickup_window || '').trim()

  if (currentAllergenTags.length > 0 && currentStorage && currentPickupWindow) {
    // Do not override complete backend data with local cache.
    return listing
  }

  const nextAllergenTags = currentAllergenTags.length > 0 ? currentAllergenTags : remembered.allergenTags
  const nextStorage = currentStorage || remembered.storageCondition
  const nextPickupWindow = currentPickupWindow || remembered.pickupWindow

  return {
    ...listing,
    allergenTags: nextAllergenTags,
    allergen_tags: nextAllergenTags,
    storageCondition: nextStorage,
    storage_condition: nextStorage,
    pickupWindow: nextPickupWindow,
    pickup_window: nextPickupWindow,
  }
}
