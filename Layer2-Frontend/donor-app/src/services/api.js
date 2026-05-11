import axios from "axios"

const RAW_API_BASE_URL = String(import.meta.env.VITE_API_URL || "").trim()
const IS_LOCALHOST_BASE =
  /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(RAW_API_BASE_URL)

// In local dev we normalize localhost direct URLs back to Vite proxy (/api),
// so API and /static always follow the same backend target.
const API_BASE_URL =
  import.meta.env.DEV && IS_LOCALHOST_BASE
    ? "/api"
    : (RAW_API_BASE_URL || "/api")
const FALLBACK_BASE_URL = "/api"
const IS_LOCAL_DIRECT_BASE =
  typeof API_BASE_URL === "string" &&
  /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(API_BASE_URL)

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
})

// Prediction service always routes through the Vite proxy in dev (/api → port 8001)
// so it is never affected by VITE_API_URL pointing at a production listing service.
const PREDICTION_BASE_URL = import.meta.env.DEV
  ? '/api'
  : (String(import.meta.env.VITE_PREDICTION_URL || '').trim() || '/api')

export const predictionApiClient = axios.create({
  baseURL: PREDICTION_BASE_URL,
  timeout: 120000,
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const requestConfig = error?.config
    // If direct localhost target is down in local dev, retry once via Vite proxy.
    const shouldRetryWithProxy =
      IS_LOCAL_DIRECT_BASE &&
      requestConfig &&
      !requestConfig.__retryWithProxy &&
      !error?.response

    if (shouldRetryWithProxy) {
      requestConfig.__retryWithProxy = true
      requestConfig.baseURL = FALLBACK_BASE_URL
      return apiClient.request(requestConfig)
    }

    return Promise.reject(error)
  },
)

export const recognizeFoodFromImage = async (imageFormData) => {
  // Listing-service endpoint for food class prediction + optional quantity hints.
  const response = await apiClient.post("/image-recognition/recognize", imageFormData, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return response.data
}

export const uploadImage = async (file) => {
  const fd = new FormData()
  fd.append("image", file)
  const response = await apiClient.post("/upload", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return response.data
}

export const submitListing = async (listingData) => {
  const response = await apiClient.post("/listings", listingData)
  return response.data
}

export const updateListing = async (listingId, listingData) => {
  const response = await apiClient.patch("/listings/" + listingId, listingData)
  return response.data
}

export const deleteListing = async (listingId, orgCode) => {
  const response = await apiClient.delete("/listings/" + listingId, {
    params: { orgCode },
  })
  return response.data
}

export const getListing = async (listingId) => {
  const response = await apiClient.get("/listings/" + listingId)
  return response.data
}

export const getAvailableListings = async (filters = {}) => {
  const response = await apiClient.get("/listings", { params: filters })
  return response.data
}

export const getRiskScores = async (postcodes = []) => {
  const response = await apiClient.get('/predictions/risk-scores', { params: { postcodes } })
  return response.data
}

export const getGapPostcodes = async (params = {}) => {
  const response = await apiClient.get('/predictions/gap-postcodes', { params })
  return response.data
}

export const getHotspots = async (params = {}) => {
  // Hotspots always come from prediction service route (proxy to :8001 in dev).
  const response = await predictionApiClient.get('/predictions/hotspots', { params })
  return response.data
}

export const claimListing = async (listingId, claimData) => {
  const response = await apiClient.post("/listings/" + listingId + "/claim", claimData)
  return response.data
}

export const unclaimListing = async (listingId, unclaimData) => {
  const response = await apiClient.patch("/listings/" + listingId + "/unclaim", unclaimData)
  return response.data
}

export const confirmPickup = async (listingId, pickupData) => {
  const response = await apiClient.patch("/listings/" + listingId + "/pickup", pickupData)
  return response.data
}

export const getClaimThread = async (claimId, orgCode) => {
  const response = await apiClient.get("/claims/" + claimId, { params: { orgCode } })
  return response.data
}

export const getClaimMessages = async (claimId, orgCode) => {
  // Claim thread is role-scoped by orgCode to enforce access boundaries.
  const response = await apiClient.get("/claims/" + claimId + "/messages", { params: { orgCode } })
  return response.data
}

export const sendClaimMessage = async (claimId, payload) => {
  const response = await apiClient.post("/claims/" + claimId + "/messages", payload)
  return response.data
}

export const markClaimMessagesRead = async (claimId, orgCode) => {
  const response = await apiClient.patch("/claims/" + claimId + "/messages/read", null, { params: { orgCode } })
  return response.data
}


export const getPredictionRiskScores = async (filters = {}) => {
  const response = await apiClient.get('/predictions/risk-scores', { params: filters })
  return response.data
}

export default apiClient
