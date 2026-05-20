const DONOR_CODE_STORAGE_KEY = 'crisislink-donor-code'
const DONOR_LISTING_IDS_KEY = 'crisislink-donor-listing-ids'

// generates a short random donor code using base-36 characters
function generateDonorCode() {
  return 'DONOR-' + Math.random().toString(36).slice(2, 8).toUpperCase()
}

// returns the saved donor code from storage, or creates and saves a new one
export function getOrCreateDonorCode() {
  const saved = window.localStorage.getItem(DONOR_CODE_STORAGE_KEY)
  if (saved) {
    return saved
  }
  const next = generateDonorCode()
  window.localStorage.setItem(DONOR_CODE_STORAGE_KEY, next)
  return next
}

// returns all listing ids this donor has previously submitted, as an array
export function getDonorListingIds() {
  try {
    const raw = window.localStorage.getItem(DONOR_LISTING_IDS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// adds a listing id to the donor's local record so ownership can be checked later
export function rememberDonorListing(listingId) {
  if (!listingId) return
  const next = Array.from(new Set([...getDonorListingIds(), listingId]))
  window.localStorage.setItem(DONOR_LISTING_IDS_KEY, JSON.stringify(next))
}

// removes a listing id from the donor's local record
export function forgetDonorListing(listingId) {
  if (!listingId) return
  const next = getDonorListingIds().filter((id) => id !== listingId)
  window.localStorage.setItem(DONOR_LISTING_IDS_KEY, JSON.stringify(next))
}

// checks whether this donor originally submitted the given listing
export function isRememberedDonorListing(listingId) {
  return getDonorListingIds().includes(listingId)
}
