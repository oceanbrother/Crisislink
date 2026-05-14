import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 120 seconds timeout for long AI processing
})

/**
 * Send image to AI recognition service
 * @param {FormData} imageFormData - Form data containing the image file
 * @returns {Promise<Object>} - foodType, quantity, confidence, etc.
 */
export const recognizeFoodFromImage = async (imageFormData) => {
  try {
    const response = await apiClient.post('/image-recognition/recognize', imageFormData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  } catch (error) {
    console.error('Image recognition error:', error)
    throw error
  }
}

/**
 * Upload a food image and get back a permanent server-side URL.
 * @param {File} file - The image file to upload
 * @returns {Promise<{url: string}>}
 */
export const uploadImage = async (file) => {
  try {
    const fd = new FormData()
    fd.append('image', file)
    const response = await apiClient.post('/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data // { url: '/static/uuid.jpg' }
  } catch (error) {
    console.error('Image upload error:', error)
    throw error
  }
}

/**
 * Submit a food listing
 * @param {Object} listingData - Listing information
 * @returns {Promise<Object>} - Created listing data
 */
export const submitListing = async (listingData) => {
  try {
    const response = await apiClient.post('/listings', listingData)
    return response.data
  } catch (error) {
    console.error('Submit listing error:', error)
    throw error
  }
}

/**
 * Get available listings (for organization view)
 * @param {Object} filters - Filter parameters (postcode, foodType, etc.)
 * @returns {Promise<Array>} - Array of listings
 */
export const getAvailableListings = async (filters = {}) => {
  try {
    const response = await apiClient.get('/listings', {
      params: filters,
    })
    return response.data
  } catch (error) {
    console.error('Get listings error:', error)
    throw error
  }
}

/**
 * Claim a listing
 * @param {string} listingId - ID of the listing to claim
 * @param {Object} claimData - Claim information (org_id, etc.)
 * @returns {Promise<Object>} - Claim confirmation
 */
export const claimListing = async (listingId, claimData) => {
  try {
    const response = await apiClient.post(`/listings/${listingId}/claim`, claimData)
    return response.data
  } catch (error) {
    console.error('Claim listing error:', error)
    throw error
  }
}

/**
 * Register a new donor or community organisation identity.
 * @param {{ orgCode: string, orgType: 'donor'|'community_org', orgName?: string }} data
 * @returns {Promise<{ orgCode: string, orgType: string }>}
 */
export const registerUser = async ({ orgCode, orgType, orgName }) => {
  const response = await apiClient.post('/register', { orgCode, orgType, orgName })
  return response.data
}

// ── Chat API ──────────────────────────────────────────────────────────────────

/**
 * Fetch chat session metadata + both parties' public keys.
 * @param {string} listingId
 * @param {string} orgCode - caller's org code (participant check)
 */
export const getChatSession = async (listingId, orgCode) => {
  const response = await apiClient.get(`/chat/sessions/${listingId}`, {
    params: { orgCode },
  })
  return response.data
}

/**
 * Upload the caller's ephemeral EC public key (JWK object) to the server.
 * @param {string} listingId
 * @param {string} senderOrgCode
 * @param {Object} publicKeyJwk  - JWK object from exportPublicKeyJwk()
 */
export const uploadPublicKey = async (listingId, senderOrgCode, publicKeyJwk) => {
  const response = await apiClient.post(`/chat/sessions/${listingId}/keys`, {
    senderOrgCode,
    publicKey: JSON.stringify(publicKeyJwk),
  })
  return response.data
}

/**
 * Retrieve encrypted message history for a listing session.
 * @param {string} listingId
 * @param {string} orgCode - participant check
 */
export const getChatMessages = async (listingId, orgCode) => {
  const response = await apiClient.get(`/chat/messages/${listingId}`, {
    params: { orgCode },
  })
  return response.data
}

/**
 * Terminate chat + mark food as physically collected.
 * Deletes the session (CASCADE removes messages) and updates listing status.
 * Only the claiming org may call this.
 * @param {string} listingId
 * @param {string} orgCode - must be the claimer
 */
export const terminateChat = async (listingId, orgCode) => {
  const response = await apiClient.delete(`/chat/sessions/${listingId}`, {
    params: { orgCode },
  })
  return response.data
}

/**
 * Get listings claimed by a specific org (org's "My Claims" view).
 * @param {string} claimedByOrgCode
 */
export const getClaimedListings = async (claimedByOrgCode) => {
  const response = await apiClient.get('/listings', {
    params: { status: 'claimed', claimedByOrgCode },
  })
  return response.data
}

/**
 * Get a donor's own listings that have been claimed (donor chat view).
 * @param {string} postedByOrgCode - donor's org code
 */
export const getDonorClaimedListings = async (postedByOrgCode) => {
  const response = await apiClient.get('/listings', {
    params: { status: 'claimed', postedByOrgCode },
  })
  return response.data
}

export default apiClient
