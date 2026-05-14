/**
 * Secure code generation and validation for CrisisLink identities.
 *
 * Formats:
 *   Donor:  DNR-XXXXXX   (6 uppercase alphanumeric, confusables removed)
 *   Org:    CBO-XXX-XXXX (3 uppercase alpha + 4 digits)
 *
 * Uses crypto.getRandomValues() — cryptographically secure, never Math.random().
 * localStorage reads are validated against a safe pattern before use so a
 * tampered or injected value can never propagate into API calls.
 */

// Exclude visually confusable characters (0/O, 1/I/l) to aid human transcription
const ALPHANUMERIC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ALPHA_ONLY   = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS_ONLY  = '0123456789'

// Accepts both new formats (DNR-*, CBO-*) and legacy codes (e.g. HCFB-2841).
// Only uppercase letters, digits, and hyphens — no injection surface.
const SAFE_CODE_RE = /^[A-Z0-9-]{3,20}$/

const STORAGE_KEYS = {
  donor: 'crisislink-donor-code',
  org:   'crisislink-org-code',
}

/**
 * Pick `count` random characters from `charset` using a CSPRNG.
 * Modulo bias is negligible here (charset sizes 25 and 10, well under 256).
 */
function pickRandom(charset, count) {
  const buf = new Uint8Array(count)
  crypto.getRandomValues(buf)
  return Array.from(buf, b => charset[b % charset.length]).join('')
}

// ── Code generators ───────────────────────────────────────────────────────────

export function generateDonorCode() {
  return `DNR-${pickRandom(ALPHANUMERIC, 6)}`
}

export function generateOrgCode() {
  return `CBO-${pickRandom(ALPHA_ONLY, 3)}-${pickRandom(DIGITS_ONLY, 4)}`
}

// ── Format validators (exported so backend round-trip can be verified) ────────

export function isNewDonorCode(code) {
  return typeof code === 'string' && /^DNR-[A-Z0-9]{6}$/.test(code)
}

export function isNewOrgCode(code) {
  return typeof code === 'string' && /^CBO-[A-Z]{3}-\d{4}$/.test(code)
}

/** Accepts any code that is safe to send over the wire (new or legacy format). */
export function isSafeCode(code) {
  return typeof code === 'string' && SAFE_CODE_RE.test(code)
}

// ── localStorage helpers ──────────────────────────────────────────────────────

/** Returns the stored donor code only if it passes the safe-pattern check. */
export function getStoredDonorCode() {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.donor)
    return isSafeCode(val) ? val : null
  } catch {
    return null
  }
}

/** Returns the stored org code only if it passes the safe-pattern check. */
export function getStoredOrgCode() {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.org)
    return isSafeCode(val) ? val : null
  } catch {
    return null
  }
}

/**
 * Persist a donor code. Silently rejects anything that does not match the
 * safe pattern — caller should validate independently and show an error.
 */
export function storeDonorCode(code) {
  if (!isSafeCode(code)) return false
  try {
    localStorage.setItem(STORAGE_KEYS.donor, code)
    return true
  } catch {
    return false
  }
}

/**
 * Persist an org code (new CBO-* format or legacy codes like HCFB-2841).
 * Silently rejects anything that does not match the safe pattern.
 */
export function storeOrgCode(code) {
  if (!isSafeCode(code)) return false
  try {
    localStorage.setItem(STORAGE_KEYS.org, code)
    return true
  } catch {
    return false
  }
}
