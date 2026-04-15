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
    const payload = response.data
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.items)) return payload.items
    console.warn('Unexpected listings payload shape:', payload)
    return []
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
 * Expire a listing so it is no longer shown as available.
 * Used as a temporary "replace listing" fallback when true edit isn't available.
 * @param {string} listingId
 * @returns {Promise<Object>}
 */
export const expireListing = async (listingId) => {
  try {
    const response = await apiClient.patch(`/listings/${listingId}/expire`)
    return response.data
  } catch (error) {
    console.error('Expire listing error:', error)
    throw error
  }
}

export default apiClient
