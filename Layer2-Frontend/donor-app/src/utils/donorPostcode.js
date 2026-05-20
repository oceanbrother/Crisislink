const DONOR_POSTCODE_STORAGE_KEY = 'crisislink-donor-postcode'

// reads the donor's last used postcode from localStorage, returns empty string if none saved
export function getSavedDonorPostcode() {
  if (typeof window === 'undefined') return ''
  return String(window.localStorage.getItem(DONOR_POSTCODE_STORAGE_KEY) || '').trim()
}

// saves the donor's postcode to localStorage after trimming whitespace
export function saveDonorPostcode(postcode) {
  if (typeof window === 'undefined') return
  const normalized = String(postcode || '').trim()
  if (!normalized) return
  window.localStorage.setItem(DONOR_POSTCODE_STORAGE_KEY, normalized)
}
