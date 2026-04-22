import axios from "axios"

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api"

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
})

export const recognizeFoodFromImage = async (imageFormData) => {
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

export const claimListing = async (listingId, claimData) => {
  const response = await apiClient.post("/listings/" + listingId + "/claim", claimData)
  return response.data
}

export const unclaimListing = async (listingId, unclaimData) => {
  const response = await apiClient.patch("/listings/" + listingId + "/unclaim", unclaimData)
  return response.data
}

export default apiClient
