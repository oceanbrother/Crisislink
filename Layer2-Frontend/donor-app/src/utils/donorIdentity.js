const DONOR_CODE_STORAGE_KEY = 'crisislink-donor-code'
const DONOR_LISTING_IDS_KEY = 'crisislink-donor-listing-ids'

function generateDonorCode() {
  return 'DONOR-' + Math.random().toString(36).slice(2, 8).toUpperCase()
}

export function getOrCreateDonorCode() {
  const saved = window.localStorage.getItem(DONOR_CODE_STORAGE_KEY)
  if (saved) {
    return saved
  }
  const next = generateDonorCode()
  window.localStorage.setItem(DONOR_CODE_STORAGE_KEY, next)
  return next
}

export function getDonorListingIds() {
  try {
    const raw = window.localStorage.getItem(DONOR_LISTING_IDS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function rememberDonorListing(listingId) {
  if (!listingId) return
  const next = Array.from(new Set([...getDonorListingIds(), listingId]))
  window.localStorage.setItem(DONOR_LISTING_IDS_KEY, JSON.stringify(next))
}

export function forgetDonorListing(listingId) {
  if (!listingId) return
  const next = getDonorListingIds().filter((id) => id !== listingId)
  window.localStorage.setItem(DONOR_LISTING_IDS_KEY, JSON.stringify(next))
}

export function isRememberedDonorListing(listingId) {
  return getDonorListingIds().includes(listingId)
}
