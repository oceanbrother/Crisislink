const DONOR_POSTCODE_STORAGE_KEY = 'crisislink-donor-postcode'

export function getSavedDonorPostcode() {
  if (typeof window === 'undefined') return ''
  return String(window.localStorage.getItem(DONOR_POSTCODE_STORAGE_KEY) || '').trim()
}

export function saveDonorPostcode(postcode) {
  if (typeof window === 'undefined') return
  const normalized = String(postcode || '').trim()
  if (!normalized) return
  window.localStorage.setItem(DONOR_POSTCODE_STORAGE_KEY, normalized)
}
