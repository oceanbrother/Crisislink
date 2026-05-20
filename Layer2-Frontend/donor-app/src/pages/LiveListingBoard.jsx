import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAvailableListings, claimListing, unclaimListing, deleteListing, confirmPickup } from '../services/api'
import { DIETARY_FILTER_OPTIONS, FILTER_OPTIONS, formatBestBeforeLabel, resolveListingCategory } from '../constants/listings'
import { resolveImageUrl } from '../utils/imageUrl'
import { mergeListingSafetyFallback } from '../utils/listingSafety'
import { getStoredOrgName } from '../utils/codeGeneration'
import ChatModal from '../components/ChatModal'
import LanguageSwitcher from '../components/LanguageSwitcher'
import logoUrl from '../assets/outbackshare-logo.png'
import textureImg from '../assets/post-food-texture.jpg'

// helpers

// returns the translated display name for a food category
const getTranslatedCategory = (category, foodType, t) => {
  const resolvedCategory = resolveListingCategory(category, foodType)
  const option = FILTER_OPTIONS.find((item) => item.value === resolvedCategory)
  return t(`dashboard.tabs.${option?.key || 'other'}`, resolvedCategory)
}

// converts a timestamp to a human-readable relative time string
const getRelativeTime = (createdAt, t) => {
  if (!createdAt) return t('listing.justNow')
  const created = new Date(createdAt)
  const diff = Date.now() - created.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return t('listing.justNow')
  if (minutes < 60) return t('listing.minutesAgo', { count: minutes })
  if (hours < 24) return t('listing.hoursAgo', { count: hours })
  return t('listing.daysAgo', { count: days })
}

// normalises a dietary tag to lowercase with dashes
const normalizeDietaryTag = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '-')

// maps a dietary tag value to its i18n translation key
const resolveDietaryTranslationKey = (value) => {
  const normalized = normalizeDietaryTag(value)
  if (normalized === 'non-vegetarian') return 'nonVegetarian'
  if (normalized === 'dairy-free' || normalized === 'lactose-free') return 'dairyFree'
  if (normalized === 'gluten-free') return 'glutenFree'
  return normalized
}

// checks if a listing's dietary tags match the chosen filter value
const matchesDietaryFilter = (tags, filterValue) => {
  if (filterValue === 'all') return true
  if (!Array.isArray(tags) || tags.length === 0) return false
  return tags.some((rawTag) => {
    const normalized = normalizeDietaryTag(rawTag)
    if (filterValue === 'dairy-free') return normalized === 'dairy-free' || normalized === 'lactose-free'
    return normalized === filterValue
  })
}

// splits a string into word tokens for prefix-matching search
const tokenizeSearch = (value) =>
  String(value || '').toLowerCase().split(/[^\p{L}\p{N}]+/gu).filter(Boolean)

// checks whether any of the given field values contain or start with the search term
const matchesSearchFields = (fields, term) => {
  const normalizedTerm = String(term || '').trim().toLowerCase()
  if (!normalizedTerm) return true
  return fields.some((value) => {
    const text = String(value || '').toLowerCase().trim()
    if (!text) return false
    const tokens = tokenizeSearch(text)
    if (normalizedTerm.length === 1) return tokens.some((token) => token.startsWith(normalizedTerm))
    return text.includes(normalizedTerm) || tokens.some((token) => token.startsWith(normalizedTerm))
  })
}

// builds the list of listing fields to search based on what the user typed
const getSearchableFields = (listing, term) => {
  const normalizedTerm = String(term || '').trim().toLowerCase()
  const primaryFields = [listing.foodType, listing.description]
  if (!normalizedTerm) return primaryFields
  const secondaryFields = [listing.orgCode]
  if (normalizedTerm.length >= 2) secondaryFields.push(listing.sizeCue)
  if (/\d/.test(normalizedTerm)) secondaryFields.push(listing.postcode)
  if (normalizedTerm.length >= 3 && Array.isArray(listing.dietary_tags)) secondaryFields.push(listing.dietary_tags.join(' '))
  return [...primaryFields, ...secondaryFields]
}

// determines whether a listing was posted by us, claimed, collected, or is available
const getListingViewState = (listing, orgCode) => {
  const ownerCode = String(listing?.orgCode || '').trim().toUpperCase()
  const currentOrgCode = String(orgCode || '').trim().toUpperCase()
  const isOwnOrgListing = ownerCode !== '' && ownerCode === currentOrgCode
  const isClaimedByCurrentOrg =
    listing?.status === 'claimed' &&
    String(listing?.claimedBy || '').trim().toUpperCase() === currentOrgCode
  const isCollectedByCurrentOrg =
    (listing?.status === 'collected' || listing?.status === 'picked_up') &&
    String(listing?.claimedBy || '').trim().toUpperCase() === currentOrgCode
  if (isOwnOrgListing) return 'posted'
  if (isCollectedByCurrentOrg) return 'collected'
  if (isClaimedByCurrentOrg) return 'claimed'
  return 'available'
}

const VIEW_STATE_PRIORITY = { posted: 0, available: 1, claimed: 2, collected: 3 }

const STATUS_OPTIONS = [
  { value: 'all', key: 'all', summaryKey: 'total' },
  { value: 'available', key: 'available', summaryKey: 'available' },
  { value: 'posted', key: 'posted', summaryKey: 'posted' },
  { value: 'claimed', key: 'claimed', summaryKey: 'claimed' },
  { value: 'collected', key: 'collected', summaryKey: 'collected' },
]

const SUMMARY_STYLE = {
  all:       { accent: '#1a1c1b', bg: '#eeeeeb', icon: 'apps' },
  available: { accent: '#0f5238', bg: '#b1f0ce', icon: 'check_circle' },
  posted:    { accent: '#424561', bg: '#dfe0ff', icon: 'upload' },
  claimed:   { accent: '#9a442d', bg: '#ffdbd2', icon: 'inventory_2' },
  collected: { accent: '#404943', bg: '#e2e3e0', icon: 'done_all' },
}

const STATUS_BADGE = {
  posted:    { bg: 'rgba(66,69,97,0.88)',  color: '#fff',     label: (t) => t('dashboard.statusPills.posted', 'Posted by us') },
  collected: { bg: 'rgba(15,82,56,0.85)',  color: '#fff',     label: (t) => t('dashboard.statusPills.collected', 'Collected') },
  claimed:   { bg: 'rgba(154,68,45,0.88)', color: '#fff',     label: (t, l) => t('dashboard.statusPills.claimed', { claimId: String(l?.claimId || l?.claim_id || l?.id || '').trim() }) },
  expired:   { bg: 'rgba(186,26,26,0.88)', color: '#fff',     label: (t) => t('dashboard.statusPills.expired', 'Expired') },
  blocked:   { bg: 'rgba(255,218,214,0.95)', color: '#93000a', label: (t) => t('dashboard.statusPills.safetyRequired', 'Safety info needed') },
  available: { bg: 'rgba(15,82,56,0.88)',  color: '#fff',     label: (t) => t('dashboard.statusPills.available', 'Available') },
}

// parses a claim quantity input string to a number, returns null if invalid
const parseClaimQuantityValue = (value) => {
  const parsed = Number.parseFloat(String(value ?? '').replace(',', '.').trim())
  if (Number.isFinite(parsed) === false) return null
  return parsed
}

// formats a numeric quantity for display, removing unnecessary decimal zeros
const formatQuantityValue = (value) => {
  const numeric = Number(value)
  if (Number.isFinite(numeric) === false) return String(value ?? '')
  return Number.isInteger(numeric) ? String(numeric) : String(numeric.toFixed(2)).replace(/\.00$/, '')
}

// parses a date string and strips the time component so comparisons are date-only
const normalizeDateOnly = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return null
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  parsed.setHours(0, 0, 0, 0)
  return parsed
}

// returns flags for whether a listing is expired, expires today, or has a date at all
const getExpiryMeta = (expiryDate) => {
  const parsed = normalizeDateOnly(expiryDate)
  if (!parsed) return { hasDate: false, isToday: false, isExpired: false }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const deltaDays = Math.round((parsed.getTime() - today.getTime()) / 86400000)
  return { hasDate: true, isToday: deltaDays === 0, isExpired: deltaDays < 0 }
}

// translates a storage condition key to a readable label
const formatStorageCondition = (storageCondition, t) => {
  const value = String(storageCondition || '').trim()
  if (!value) return t('listing.storage.unknown', 'Not provided')
  return t(`listing.storage.${value}`, value)
}

// normalises an allergen tag string to lowercase trimmed form
const normalizeAllergenTag = (tag) => String(tag || '').trim().toLowerCase()

// extracts allergen tags from a listing regardless of which field name the backend used
const getAllergenTags = (listing) => {
  if (Array.isArray(listing?.allergenTags)) return listing.allergenTags
  if (Array.isArray(listing?.allergen_tags)) return listing.allergen_tags
  return []
}

// reads storage condition from whichever field name the listing uses
const getStorageCondition = (listing) =>
  String(listing?.storageCondition || listing?.storage_condition || '').trim()

// translates a single allergen tag to its display label
const formatAllergenTag = (tag, t) => {
  const normalized = normalizeAllergenTag(tag)
  if (!normalized) return ''
  if (normalized === 'no known allergens') return t('listing.allergens.noknownallergens', 'No known allergens')
  const key = normalized.replace(/\s+/g, '')
  return t(`listing.allergens.${key}`, tag)
}

// checks if a listing has allergen and storage info filled in
const hasSafetyFields = (listing) => {
  const allergenTags = getAllergenTags(listing).map((tag) => String(tag || '').trim()).filter(Boolean)
  const hasAllergenInfo = allergenTags.length > 0
  const hasStorageInfo = getStorageCondition(listing) !== ''
  return { hasAllergenInfo, hasStorageInfo, hasCompleteSafetyInfo: hasAllergenInfo && hasStorageInfo }
}

// returns the reason a listing cannot be claimed, or empty string if it can be claimed
const getClaimBlockReason = (listing, t) => {
  const expiryMeta = getExpiryMeta(listing?.expiryDate)
  if (expiryMeta.isExpired) return t('listing.claimBlockedExpired', 'This listing is expired and can no longer be claimed.')
  if (!expiryMeta.hasDate) return t('listing.claimBlockedMissingExpiry', 'Please add an expiry date before this listing can be claimed.')
  if (expiryMeta.isToday) return ''
  const safety = hasSafetyFields(listing)
  if (!safety.hasAllergenInfo && !safety.hasStorageInfo) return t('listing.claimBlockedMissingAllergenAndStorage', 'Please add allergen information and storage condition before claiming this listing.')
  if (!safety.hasAllergenInfo) return t('listing.claimBlockedMissingAllergen', 'Please add allergen information before claiming this listing.')
  if (!safety.hasStorageInfo) return t('listing.claimBlockedMissingStorage', 'Please add storage condition before claiming this listing.')
  if (!safety.hasCompleteSafetyInfo) return t('listing.claimBlockedMissingSafety', 'This listing is missing required food safety information.')
  return ''
}

// builds the quantity display string with correct singular/plural unit
const formatApproxQuantityLabel = (listing, t) => {
  const quantity = Number(listing?.quantity)
  const formattedQuantity = formatQuantityValue(quantity)
  const unit = String(listing?.unit || 'portions').trim().toLowerCase()
  let displayUnit = t(`listing.units.${unit}`, unit)
  if (Number.isFinite(quantity) && Math.abs(quantity - 1) < 0.00001) {
    if (unit === 'portions') displayUnit = t('listing.units.portion', 'portion')
    if (unit === 'meals') displayUnit = t('listing.units.meal', 'meal')
    if (unit === 'items') displayUnit = t('listing.units.item', 'item')
    if (unit === 'boxes') displayUnit = t('listing.units.box', 'box')
  }
  return t('listing.approxQuantity', { quantity: formattedQuantity, unit: displayUnit })
}

// shows whether the listing came from us, a donor code, or another organisation
const formatSourceLabel = (listing, orgCode, t) => {
  const ownerCode = String(listing?.orgCode || '').trim()
  const currentOrgCode = String(orgCode || '').trim()
  if (ownerCode && ownerCode.toUpperCase() === currentOrgCode.toUpperCase()) return t('dashboard.statusTabs.posted', 'Posted by us')
  if (ownerCode.toUpperCase().startsWith('DONOR-')) return t('listing.fromDonorCode', { code: ownerCode })
  return t('listing.fromOrganizationCode', { code: ownerCode || t('dashboard.communityFallback', 'Community') })
}

// inline style constants (dark-green theme)

const BTN_PRIMARY = {
  background: '#95d4b3', color: '#002114', border: 'none', borderRadius: 12,
  fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center', gap: 6,
  transition: 'opacity 0.15s', padding: '10px 16px', width: '100%',
}
const BTN_OUTLINE = (color = '#95d4b3') => ({
  background: 'rgba(149,212,179,0.10)', color, border: `1px solid ${color}`, borderRadius: 12,
  fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center', gap: 6,
  transition: 'background 0.15s', padding: '10px 16px', width: '100%',
})
const BTN_MUTED = {
  background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12,
  fontWeight: 500, fontSize: 14, cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center', gap: 6,
  transition: 'background 0.15s', padding: '10px 16px', width: '100%',
}
const BTN_DANGER = {
  background: 'rgba(255,218,214,0.08)', color: '#ffb4ab', border: '1px solid rgba(255,180,171,0.3)', borderRadius: 12,
  fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center', gap: 6,
  transition: 'background 0.15s', padding: '10px 16px', width: '100%',
}
const CHIP_ACTIVE = { background: '#95d4b3', color: '#002114', border: '1px solid #95d4b3', borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }
const CHIP_INACTIVE = { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }
const DETAIL_ROW = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.7)' }

// component

const LiveListingBoard = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { t, i18n } = useTranslation()
  const [listings, setListings] = useState([])
  const [filteredListings, setFilteredListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [claimingId, setClaimingId] = useState(null)
  const [removingId, setRemovingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('All')
  const [filterFoodType, setFilterFoodType] = useState('all')
  const [filterStatus, setFilterStatus] = useState(location.state?.filterStatus || 'all')
  const [claimDialogListing, setClaimDialogListing] = useState(null)
  const [detailDialogListing, setDetailDialogListing] = useState(null)
  const [claimQuantity, setClaimQuantity] = useState('1')
  const [claimError, setClaimError] = useState('')
  const [pickingUpId, setPickingUpId] = useState(null)
  const [chatClaimId, setChatClaimId] = useState(null)
  const [chatListingTitle, setChatListingTitle] = useState('')

  const savedOrgSession = (() => {
    try { return JSON.parse(window.localStorage.getItem('crisislink-org-session') || '{}') }
    catch { return {} }
  })()

  const orgCode = location.state?.orgCode || savedOrgSession.orgCode || 'HCFB-2841'
  const orgName = getStoredOrgName()

  useEffect(() => {
    window.localStorage.setItem('crisislink-org-session', JSON.stringify({ orgCode }))
    loadListings()
  }, [orgCode])

  useEffect(() => { filterAndDisplayListings() }, [listings, searchTerm, filterCategory, filterFoodType, filterStatus, orgCode])

  // fetches available, claimed, and collected listings and merges them into state
  const loadListings = async () => {
    setLoading(true); setError('')
    try {
      const [availableData, claimedResult, collectedResult] = await Promise.all([
        getAvailableListings({ status: 'available' }),
        getAvailableListings({ status: 'claimed' }).catch(() => []),
        getAvailableListings({ status: 'collected' }).catch(() => []),
      ])
      const claimedData = Array.isArray(claimedResult) ? claimedResult : []
      const collectedData = Array.isArray(collectedResult) ? collectedResult : []
      const mergedData = [
        ...availableData,
        ...claimedData.filter((l) => String(l.claimedBy || '').trim().toUpperCase() === String(orgCode || '').trim().toUpperCase()),
        ...collectedData.filter((l) => String(l.claimedBy || '').trim().toUpperCase() === String(orgCode || '').trim().toUpperCase()),
      ]
      const formatted = mergedData.map((listing) => {
        const safeListing = mergeListingSafetyFallback(listing)
        return { ...safeListing, category: resolveListingCategory(safeListing.category, safeListing.foodType) }
      })
      setListings(formatted)
    } catch {
      setError(t('feed.noListings')); setListings([])
    } finally { setLoading(false) }
  }

  // applies all active filters and sort order to the listings and updates the display list
  const filterAndDisplayListings = () => {
    let filtered = listings
    if (filterCategory !== 'All') filtered = filtered.filter(l => resolveListingCategory(l.category, l.foodType) === filterCategory)
    if (filterStatus !== 'all') filtered = filtered.filter((l) => getListingViewState(l, orgCode) === filterStatus)
    if (filterFoodType !== 'all') filtered = filtered.filter((l) => matchesDietaryFilter(l.dietary_tags, filterFoodType))
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter((l) => matchesSearchFields(getSearchableFields(l, term), term))
    }
    filtered = [...filtered].sort((a, b) => {
      const stateA = getListingViewState(a, orgCode)
      const stateB = getListingViewState(b, orgCode)
      return (VIEW_STATE_PRIORITY[stateA] ?? 99) - (VIEW_STATE_PRIORITY[stateB] ?? 99)
    })
    setFilteredListings(filtered)
  }

  // validates claim eligibility then opens the claim dialog
  const handleClaim = (listing) => {
    if (!listing) return
    const blockReason = getClaimBlockReason(listing, t)
    if (blockReason) { setError(blockReason); setTimeout(() => setError(''), 3200); return }
    openClaimDialog(listing)
  }

  // removes an existing claim for the current org from the backend
  const handleRemoveClaim = async (listingId) => {
    setRemovingId(listingId); setError(''); setSuccess('')
    try {
      await unclaimListing(listingId, { orgId: orgCode })
      setSuccess('Claim removed successfully.')
      await loadListings(); setTimeout(() => setSuccess(''), 1500)
    } catch { setError('Unable to remove this claim right now.'); setTimeout(() => setError(''), 3000) }
    finally { setRemovingId(null) }
  }

  // marks a claimed listing as collected and refreshes the board
  const handlePickupConfirm = async (listingId) => {
    setPickingUpId(listingId); setError(''); setSuccess('')
    try {
      await confirmPickup(listingId, { orgId: orgCode })
      setSuccess(t('dashboard.markCollectedSuccess', 'Marked as collected. This donation has been completed.'))
      await loadListings(); setTimeout(() => setSuccess(''), 3000)
    } catch { setError(t('dashboard.markCollectedFailed', 'Unable to mark this listing as collected right now.')); setTimeout(() => setError(''), 3000) }
    finally { setPickingUpId(null) }
  }

  // navigates to the post food form in org mode
  const handlePostExcess = () => navigate('/form', { state: { orgMode: true, orgCode, orgName: orgName || `Organisation ${orgCode}` } })
  // opens the post food form pre-filled with an existing listing for editing
  const handleEditListing = (listing) => navigate('/form', { state: { editMode: true, listing, orgMode: true, orgCode, orgName: orgName || `Organisation ${orgCode}` } })

  // deletes a listing posted by this org and refreshes the board
  const handleRemoveListing = async (listing) => {
    setRemovingId(listing.id); setError(''); setSuccess('')
    try {
      await deleteListing(listing.id, listing.orgCode || orgCode)
      setSuccess(t('donation.actions.removeListing', 'Remove this listing'))
      await loadListings(); setTimeout(() => setSuccess(''), 1200)
    } catch { setError('Unable to remove this listing right now.'); setTimeout(() => setError(''), 3000) }
    finally { setRemovingId(null) }
  }

  const maxClaimQuantity = useMemo(() => claimDialogListing ? Number(claimDialogListing.quantity || 0) : 0, [claimDialogListing])
  const claimDialogBlockedReason = useMemo(() => claimDialogListing ? getClaimBlockReason(claimDialogListing, t) : '', [claimDialogListing, t])

  const hasActiveSearch = searchTerm.trim() !== ''
  const hasActiveCategoryFilter = filterCategory !== 'All'
  const hasActiveFoodTypeFilter = filterFoodType !== 'all'
  const hasActiveStatusFilter = filterStatus !== 'all'
  const hasActiveControls = hasActiveSearch || hasActiveCategoryFilter || hasActiveFoodTypeFilter || hasActiveStatusFilter
  const isBaseEmpty = listings.length === 0
  const isFilteredEmpty = !loading && !isBaseEmpty && filteredListings.length === 0

  // resets all search and filter controls to their default values
  const clearFilters = () => { setSearchTerm(''); setFilterCategory('All'); setFilterFoodType('all'); setFilterStatus('all') }

  const listingSummary = useMemo(() =>
    listings.reduce((acc, listing) => {
      const state = getListingViewState(listing, orgCode)
      acc.total += 1; acc[state] = (acc[state] || 0) + 1
      return acc
    }, { total: 0, available: 0, posted: 0, claimed: 0, collected: 0 }),
    [listings, orgCode]
  )

  // opens the claim quantity dialog and pre-fills a sensible default quantity
  const openClaimDialog = (listing) => {
    setDetailDialogListing(null); setClaimDialogListing(listing)
    const quantity = Number(listing?.quantity || 0)
    const initialQuantity = quantity > 0 && quantity < 1 ? quantity : 1
    setClaimQuantity(formatQuantityValue(initialQuantity))
    setClaimError(getClaimBlockReason(listing, t)); setError(''); setSuccess('')
  }
  // closes the claim dialog if no claim request is in flight
  const closeClaimDialog = () => { if (claimingId) return; setClaimDialogListing(null); setClaimQuantity('1'); setClaimError('') }
  // opens the details modal for a listing
  const openDetailsDialog = (listing) => { if (!listing) return; setDetailDialogListing(listing); setError(''); setSuccess('') }
  // closes the details modal
  const closeDetailsDialog = () => setDetailDialogListing(null)

  // increments or decrements the claim quantity within the allowed range
  const handleClaimQuantityAdjust = (delta) => {
    setClaimQuantity((prev) => {
      const current = parseClaimQuantityValue(prev) ?? 0
      const next = Math.max(1, Math.min(maxClaimQuantity, current + delta))
      return formatQuantityValue(next)
    })
  }
  // sets the claim quantity to the full available amount
  const handleClaimAll = () => { if (!claimDialogListing) return; setClaimQuantity(formatQuantityValue(maxClaimQuantity)); setClaimError('') }

  // validates quantity then submits the claim request to the backend
  const submitClaimQuantity = async () => {
    if (!claimDialogListing) return
    const blockReason = getClaimBlockReason(claimDialogListing, t)
    if (blockReason) { setClaimError(blockReason); return }
    const requestedQuantity = parseClaimQuantityValue(claimQuantity)
    if (requestedQuantity === null || requestedQuantity <= 0) { setClaimError(t('dashboard.claimDialog.invalidQuantity')); return }
    if (requestedQuantity > maxClaimQuantity) { setClaimError(t('dashboard.claimDialog.exceedsQuantity', { quantity: formatQuantityValue(maxClaimQuantity) })); return }
    setClaimingId(claimDialogListing.id); setClaimError(''); setError(''); setSuccess('')
    try {
      await claimListing(claimDialogListing.id, { orgId: orgCode, quantity: requestedQuantity })
      setSuccess(t('dashboard.claimDialog.success', { quantity: formatQuantityValue(requestedQuantity) }))
      setClaimDialogListing(null); setClaimQuantity('1')
      await loadListings(); setTimeout(() => setSuccess(''), 1200)
    } catch (err) {
      const detail = err?.response?.data?.detail
      setClaimError(typeof detail === 'string' ? detail : t('dashboard.claimDialog.failed'))
    } finally { setClaimingId(null) }
  }

  const detailDialogBlockReason = useMemo(() => detailDialogListing ? getClaimBlockReason(detailDialogListing, t) : '', [detailDialogListing, t])
  const detailDialogIsClaimBlocked = Boolean(detailDialogBlockReason)

  // render

  const SIDEBAR_NAV = [
    { icon: 'list_alt',       label: 'Listings',          active: true,  onClick: () => {} },
    { icon: 'add_circle',     label: 'Post Food',         active: false, onClick: handlePostExcess },
    { icon: 'travel_explore', label: 'Area Intelligence', active: false, onClick: () => navigate('/org/intelligence', { state: { orgCode } }) },
    { icon: 'near_me',        label: 'Around Me',         active: false, onClick: () => navigate('/org/coverage-map', { state: { orgCode } }) },
  ]

  const DARK_DETAIL_ROW = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.7)' }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#1b4332', fontFamily: 'Inter, system-ui, sans-serif', position: 'relative' }}>

      {/* Bloom effects */}
      <div style={{ position: 'fixed', top: '5%', left: '12%', width: 500, height: 500, borderRadius: '50%', background: 'rgba(45,106,79,0.28)', filter: 'blur(90px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '10%', right: '8%', width: 400, height: 400, borderRadius: '50%', background: 'rgba(45,106,79,0.22)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', width: 350, height: 350, borderRadius: '50%', background: 'rgba(26,156,103,0.12)', filter: 'blur(100px)', transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Texture overlay */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `url(${textureImg})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.04, pointerEvents: 'none', zIndex: 0 }} />

      {/* Left sidebar */}
      <aside style={{ width: 256, flexShrink: 0, position: 'fixed', top: 0, left: 0, bottom: 0, background: 'rgba(20,52,38,0.97)', borderRight: '1px solid rgba(149,212,179,0.2)', display: 'flex', flexDirection: 'column', zIndex: 50, overflowY: 'auto' }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px 20px' }}>
          <button type="button" onClick={() => navigate('/roles')} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', marginBottom: 26, width: '100%' }}>
            <img src={logoUrl} alt="OutBackShare" style={{ height: 38, width: 'auto', maxWidth: 192, objectFit: 'contain', objectPosition: 'left center', display: 'block', filter: 'brightness(0) invert(1)' }} />
          </button>

          {/* Nav */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {SIDEBAR_NAV.map(({ icon, label, active, onClick }) => (
              <button key={label} type="button" onClick={onClick}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 10, border: 'none', background: active ? 'rgba(149,212,179,0.22)' : 'transparent', color: active ? '#95d4b3' : 'rgba(255,255,255,0.7)', fontWeight: active ? 700 : 500, fontSize: 14, cursor: 'pointer', transition: 'background 0.15s', fontFamily: 'inherit', textAlign: 'left' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
                <span style={{ flex: 1 }}>{label}</span>
                {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#95d4b3', flexShrink: 0 }} />}
              </button>
            ))}
          </nav>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(149,212,179,0.15)', margin: '4px 20px' }} />

        {/* Sarah quote card */}
        <div style={{ margin: '16px 16px 0', padding: '16px', background: 'rgba(149,212,179,0.08)', border: '1px solid rgba(149,212,179,0.18)', borderRadius: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #95d4b3, #2d6a4f)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#fff' }}>person</span>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#95d4b3' }}>Sarah M.</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>Community Manager</div>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>
            "Every morning I check here first. One claim can feed 40 families before lunch."
          </p>
        </div>

        {/* Stats block */}
        <div style={{ margin: '12px 16px', padding: '14px 16px', background: 'rgba(252,145,116,0.08)', border: '1px solid rgba(252,145,116,0.18)', borderRadius: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#fc9174', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Today's Impact</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { val: listingSummary.available, label: 'Available' },
              { val: listingSummary.claimed,   label: 'Claimed' },
              { val: listingSummary.collected, label: 'Collected' },
              { val: listingSummary.posted,    label: 'Posted' },
            ].map(({ val, label }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{val || 0}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 500, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Language switcher */}
        <div style={{ padding: '12px 20px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Language</span>
          <LanguageSwitcher dark />
        </div>

        {/* Org badge at bottom */}
        <div style={{ padding: '12px 20px 20px', borderTop: '1px solid rgba(149,212,179,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(149,212,179,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#95d4b3' }}>groups</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{orgName || 'Organisation'}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{orgCode}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div style={{ marginLeft: 256, flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>

        {/* Top header */}
        <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(27,67,50,0.84)', backdropFilter: 'blur(18px)', borderBottom: '1px solid rgba(149,212,179,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px', height: 68 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.01em' }}>Live Listing Board</h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
              {t('dashboard.subtitle', 'Claim food, post listings, monitor local demand.')}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {error && (
              <div style={{ padding: '6px 14px', borderRadius: 10, background: 'rgba(255,180,171,0.15)', color: '#ffb4ab', fontSize: 13, fontWeight: 500, border: '1px solid rgba(255,180,171,0.2)' }}>{error}</div>
            )}
            {success && (
              <div style={{ padding: '6px 14px', borderRadius: 10, background: 'rgba(149,212,179,0.15)', color: '#95d4b3', fontSize: 13, fontWeight: 500, border: '1px solid rgba(149,212,179,0.2)' }}>{success}</div>
            )}
            <LanguageSwitcher dark />
            <button type="button" onClick={handlePostExcess}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#95d4b3', color: '#002114', border: 'none', borderRadius: 12, padding: '9px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'opacity 0.15s', fontFamily: 'inherit' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
              Post a listing
            </button>
          </div>
        </header>

        {/* Page content */}
        <main style={{ padding: '32px 40px 80px', flex: 1 }}>

          {/* Summary strip */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 28, overflowX: 'auto', paddingBottom: 4 }}>
            {STATUS_OPTIONS.map((option) => {
              const cfg = SUMMARY_STYLE[option.key]
              const count = listingSummary[option.summaryKey] || 0
              const isActive = filterStatus === option.value
              return (
                <button key={option.value} type="button" onClick={() => setFilterStatus(option.value)}
                  style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 20px', minWidth: 148, borderRadius: 18, border: isActive ? '2px solid rgba(149,212,179,0.6)' : '1px solid rgba(255,255,255,0.1)', background: isActive ? 'rgba(149,212,179,0.12)' : 'rgba(255,255,255,0.05)', cursor: 'pointer', backdropFilter: 'blur(10px)', transition: 'all 0.2s', fontFamily: 'inherit', flexShrink: 0 }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.09)' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: isActive ? 'rgba(149,212,179,0.25)' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 17, color: isActive ? '#95d4b3' : 'rgba(255,255,255,0.5)' }}>{cfg.icon}</span>
                    </div>
                    {isActive && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#95d4b3', display: 'block' }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: isActive ? '#95d4b3' : '#fff', lineHeight: 1, marginBottom: 4 }}>{count}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>
                      {t(`dashboard.statusTabs.${option.key}`, option.key)}
                    </div>
                  </div>
                </button>
              )
            })}

            {/* Sarah impact card — fills the row */}
            <div style={{ flex: 1, minWidth: 200, borderRadius: 18, border: '1px solid rgba(252,145,116,0.2)', background: 'rgba(252,145,116,0.07)', backdropFilter: 'blur(10px)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(252,145,116,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#fc9174' }}>volunteer_activism</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fc9174', marginBottom: 3 }}>Sarah's Tip</div>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.5 }}>
                  "Check the 'Available' tab first — items expire fast."
                </p>
              </div>
            </div>
          </div>

          {/* Filter panel */}
          <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '20px 24px', marginBottom: 28, backdropFilter: 'blur(12px)' }}>
            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 20, color: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }}>search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('feed.search', 'Search by food name, notes, or postcode…')}
                style={{ width: '100%', height: 46, paddingLeft: 44, paddingRight: searchTerm ? 40 : 16, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, fontSize: 14, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: 'rgba(255,255,255,0.06)', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                onFocus={e => { e.target.style.borderColor = '#95d4b3'; e.target.style.boxShadow = '0 0 0 3px rgba(149,212,179,0.15)' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.boxShadow = 'none' }}
              />
              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm('')} aria-label="Clear search"
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'rgba(255,255,255,0.5)', display: 'flex' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                </button>
              )}
            </div>

            {/* Category chips */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                {t('dashboard.filterLabels.category', 'Category')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {FILTER_OPTIONS.map((option) => (
                  <button key={option.value} type="button" onClick={() => setFilterCategory(option.value)}
                    style={filterCategory === option.value ? CHIP_ACTIVE : CHIP_INACTIVE}
                  >
                    {option.value === 'All' ? t('dashboard.filterLabels.allCategories', 'All') : t(`dashboard.tabs.${option.key}`, option.value)}
                  </button>
                ))}
              </div>
            </div>

            {/* Dietary chips */}
            <div style={{ marginBottom: hasActiveControls ? 16 : 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                {t('dashboard.filterLabels.foodType', 'Food type')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {DIETARY_FILTER_OPTIONS.map((option) => (
                  <button key={option.value} type="button" onClick={() => setFilterFoodType(option.value)}
                    style={filterFoodType === option.value ? CHIP_ACTIVE : CHIP_INACTIVE}
                  >
                    {option.value === 'all' ? t('dashboard.tabs.allTypes', 'All types') : t(`listing.dietary.${option.key}`, option.value)}
                  </button>
                ))}
              </div>
            </div>

            {/* Active filters row */}
            {hasActiveControls && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                {hasActiveSearch && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 500 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>search</span>
                    "{searchTerm.trim()}"
                  </span>
                )}
                {hasActiveCategoryFilter && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(149,212,179,0.18)', color: '#95d4b3', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 500 }}>
                    {filterCategory}
                  </span>
                )}
                {hasActiveFoodTypeFilter && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(149,212,179,0.18)', color: '#95d4b3', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 500 }}>
                    {t(`listing.dietary.${resolveDietaryTranslationKey(filterFoodType)}`, filterFoodType)}
                  </span>
                )}
                {hasActiveStatusFilter && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(149,212,179,0.18)', color: '#95d4b3', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 500 }}>
                    {t(`dashboard.statusTabs.${filterStatus}`, filterStatus)}
                  </span>
                )}
                <button type="button" onClick={clearFilters}
                  style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: '#fc9174', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', fontFamily: 'inherit' }}>
                  {t('feed.clearFilters', 'Clear filters')}
                </button>
              </div>
            )}
          </div>

          {/* Result count */}
          {!loading && !isBaseEmpty && !isFilteredEmpty && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 20, fontWeight: 500 }}>
              {hasActiveControls
                ? t('dashboard.showingMatches', { count: filteredListings.length })
                : t('listing.itemsAvailable', { count: filteredListings.length })}
            </div>
          )}

          {/* Card grid and empty states */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '80px 0', color: 'rgba(255,255,255,0.5)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'rgba(149,212,179,0.4)' }}>hourglass_empty</span>
              <p style={{ fontSize: 16, margin: 0 }}>{t('common.loading')}</p>
            </div>
          ) : isBaseEmpty ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '60px 32px', textAlign: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24 }}>
                <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(149,212,179,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 36, color: '#95d4b3' }}>inventory_2</span>
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 600, color: '#fff', margin: 0 }}>{t('dashboard.emptyTitle', 'No listings yet')}</h3>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: 0, maxWidth: 320 }}>{t('dashboard.emptyHint', 'Listings from donors and organisations will appear here as soon as they are posted.')}</p>
                <button type="button" onClick={handlePostExcess} style={{ ...BTN_PRIMARY, width: 'auto', padding: '10px 24px' }}>
                  Post the first listing
                </button>
              </div>
              {/* Sarah context card beside empty state */}
              <div style={{ background: 'rgba(252,145,116,0.07)', border: '1px solid rgba(252,145,116,0.2)', borderRadius: 24, padding: '32px 28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fc9174', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Meet Sarah</div>
                  <p style={{ fontSize: 18, fontWeight: 600, color: '#fff', lineHeight: 1.5, margin: '0 0 16px' }}>
                    "I run a community food bank in Reservoir. On a good week we redirect 300 meals that would otherwise go to waste."
                  </p>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: 0 }}>
                    Sarah coordinates pickups for 3 food banks across Melbourne. CrisisLink cuts her admin time in half.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 24 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #fc9174, #9a442d)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#fff' }}>person</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Sarah M.</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Community Food Bank Manager, VIC</div>
                  </div>
                </div>
              </div>
            </div>
          ) : isFilteredEmpty ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '60px 32px', textAlign: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24 }}>
                <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(149,212,179,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 36, color: '#95d4b3' }}>search_off</span>
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 600, color: '#fff', margin: 0 }}>{t('dashboard.emptySearchTitle', 'No matching listings')}</h3>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: 0, maxWidth: 320 }}>{t('dashboard.emptySearchHint', 'Try another search term or clear the active filters.')}</p>
                <button type="button" onClick={clearFilters} style={{ ...BTN_OUTLINE(), width: 'auto', padding: '10px 24px', marginTop: 4 }}>
                  {t('feed.clearFilters', 'Clear filters')}
                </button>
              </div>
              <div style={{ background: 'rgba(149,212,179,0.06)', border: '1px solid rgba(149,212,179,0.15)', borderRadius: 24, padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#95d4b3', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Sarah's Workflow</div>
                {[
                  { icon: 'schedule', text: 'Check listings every morning before 9am — freshest stock gets claimed first.' },
                  { icon: 'travel_explore', text: 'Use Area Intelligence to see which suburb has the highest demand before deciding what to claim.' },
                  { icon: 'near_me',        text: 'Around Me shows real-time coverage gaps within driving distance of your centre.' },
                ].map(({ icon, text }) => (
                  <div key={icon} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(149,212,179,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#95d4b3' }}>{icon}</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.6 }}>{text}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              {filteredListings.map((listing, idx) => {
                const viewState = getListingViewState(listing, orgCode)
                const isOwnOrgListing = viewState === 'posted'
                const isClaimedByCurrentOrg = viewState === 'claimed'
                const isCollectedByCurrentOrg = viewState === 'collected'
                const expiryMeta = getExpiryMeta(listing.expiryDate)
                const claimBlockReason = getClaimBlockReason(listing, t)
                const isClaimBlocked = Boolean(claimBlockReason)
                const isAvailableAndExpired = viewState === 'available' && expiryMeta.isExpired
                const bestBefore = formatBestBeforeLabel(listing.expiryDate, i18n.language === 'zh' ? 'zh-CN' : 'en-AU')
                const dietaryTags = Array.isArray(listing.dietary_tags) ? listing.dietary_tags : []
                const allergenTags = getAllergenTags(listing).map((tag) => String(tag || '').trim()).filter(Boolean)
                const storageCondition = getStorageCondition(listing)
                const hasPickupNotes = String(listing.description || '').trim() !== ''
                const pickupWindow = String(listing.pickupWindow || listing.pickup_window || '').trim()
                const hasPickupWindow = pickupWindow !== ''

                let badge = STATUS_BADGE.available
                if (isOwnOrgListing) badge = STATUS_BADGE.posted
                else if (isCollectedByCurrentOrg) badge = STATUS_BADGE.collected
                else if (isClaimedByCurrentOrg) badge = STATUS_BADGE.claimed
                else if (isAvailableAndExpired) badge = STATUS_BADGE.expired
                else if (isClaimBlocked) badge = STATUS_BADGE.blocked

                const card = (
                  <article key={listing.id}
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'box-shadow 0.2s, transform 0.2s', backdropFilter: 'blur(10px)' }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.25)'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.background = 'rgba(255,255,255,0.10)' }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
                  >
                    {/* Image */}
                    <div style={{ position: 'relative', height: 180, flexShrink: 0, overflow: 'hidden' }}>
                      {listing.photoUrl ? (
                        <img src={resolveImageUrl(listing.photoUrl)} alt={listing.foodType}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'rgba(149,212,179,0.3)' }}>image_not_supported</span>
                        </div>
                      )}
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,30,20,0.55) 0%, transparent 50%)' }} />
                      <span style={{ position: 'absolute', top: 12, left: 12, background: badge.bg, color: badge.color, padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, backdropFilter: 'blur(6px)' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: badge.color, display: 'block', opacity: 0.85 }} />
                        {badge.label(t, listing)}
                      </span>
                      <span style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.45)', color: 'rgba(255,255,255,0.85)', padding: '4px 9px', borderRadius: 999, fontSize: 11, fontWeight: 500, backdropFilter: 'blur(6px)' }}>
                        {getRelativeTime(listing.createdAt, t)}
                      </span>
                    </div>

                    {/* Body */}
                    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                      <div>
                        <h4 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 3px', lineHeight: 1.3 }}>{listing.foodType}</h4>
                        <p style={{ fontSize: 12, color: '#fc9174', fontWeight: 500, margin: 0 }}>{formatSourceLabel(listing, orgCode, t)}</p>
                      </div>

                      <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, color: '#95d4b3', background: 'rgba(149,212,179,0.12)', padding: '3px 10px', borderRadius: 999, alignSelf: 'flex-start', border: '1px solid rgba(149,212,179,0.2)' }}>
                        {getTranslatedCategory(listing.category, listing.foodType, t)}
                      </span>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 10px' }}>
                        <div style={DARK_DETAIL_ROW}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'rgba(149,212,179,0.6)', flexShrink: 0 }}>inventory_2</span>
                          <span style={{ fontSize: 12 }}>{formatApproxQuantityLabel(listing, t)}</span>
                        </div>
                        {bestBefore ? (
                          <div style={DARK_DETAIL_ROW}>
                            <span className="material-symbols-outlined" style={{ fontSize: 14, color: expiryMeta.isToday ? '#fc9174' : 'rgba(149,212,179,0.6)', flexShrink: 0 }}>schedule</span>
                            <span style={{ fontSize: 12, color: expiryMeta.isToday ? '#fc9174' : 'rgba(255,255,255,0.7)', fontWeight: expiryMeta.isToday ? 600 : 400 }}>
                              {expiryMeta.isToday ? t('listing.bestBeforeToday', 'Today') : bestBefore}
                            </span>
                          </div>
                        ) : null}
                        <div style={DARK_DETAIL_ROW}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'rgba(149,212,179,0.6)', flexShrink: 0 }}>location_on</span>
                          <span style={{ fontSize: 12 }}>{listing.postcode}</span>
                        </div>
                        <div style={DARK_DETAIL_ROW}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'rgba(149,212,179,0.6)', flexShrink: 0 }}>kitchen</span>
                          <span style={{ fontSize: 12 }}>{formatStorageCondition(storageCondition, t)}</span>
                        </div>
                        {listing.sizeCue ? (
                          <div style={{ ...DARK_DETAIL_ROW, gridColumn: '1 / -1' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'rgba(149,212,179,0.6)', flexShrink: 0 }}>straighten</span>
                            <span style={{ fontSize: 12 }}>{listing.sizeCue}</span>
                          </div>
                        ) : null}
                        {hasPickupWindow ? (
                          <div style={{ ...DARK_DETAIL_ROW, gridColumn: '1 / -1' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'rgba(149,212,179,0.6)', flexShrink: 0 }}>calendar_month</span>
                            <span style={{ fontSize: 12 }}>{t('listing.pickupWindowLabel', 'Pickup')}: {pickupWindow}</span>
                          </div>
                        ) : null}
                      </div>

                      {dietaryTags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {dietaryTags.map((tag, i) => (
                            <span key={i} style={{ fontSize: 10, fontWeight: 600, color: '#95d4b3', background: 'rgba(149,212,179,0.12)', padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(149,212,179,0.2)' }}>
                              {t(`listing.dietary.${resolveDietaryTranslationKey(tag)}`, tag)}
                            </span>
                          ))}
                        </div>
                      )}

                      <div>
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {t('listing.allergenLabel', 'Allergens')}:{' '}
                        </span>
                        {allergenTags.length > 0 ? (
                          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
                            {allergenTags.map((tag, i) => (
                              <span key={`${tag}-${i}`} style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.08)', padding: '2px 7px', borderRadius: 999 }}>
                                {formatAllergenTag(tag, t)}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: '#ffb4ab', fontWeight: 500 }}>
                            {t('listing.allergenRequired', 'Allergen info required')}
                          </span>
                        )}
                      </div>

                      {hasPickupNotes && (
                        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {t('listing.pickupNotesLabel', 'Pickup notes')}:
                          </span>
                          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: '4px 0 0', lineHeight: 1.5 }}>{listing.description}</p>
                        </div>
                      )}

                      <div style={{ flex: 1 }} />

                      {/* Action buttons */}
                      {isOwnOrgListing ? (
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                          <button type="button" style={BTN_OUTLINE()} onClick={() => handleEditListing(listing)} disabled={removingId === listing.id}>
                            {t('donation.actions.editListing', 'Edit listing')}
                          </button>
                          <button type="button" style={BTN_MUTED} onClick={() => handleRemoveListing(listing)} disabled={removingId === listing.id}>
                            {removingId === listing.id ? 'Removing…' : t('donation.actions.removeListing', 'Remove')}
                          </button>
                        </div>
                      ) : isClaimedByCurrentOrg ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                          <button type="button" style={BTN_PRIMARY} onClick={() => handlePickupConfirm(listing.id)} disabled={pickingUpId === listing.id || removingId === listing.id}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
                            {pickingUpId === listing.id ? t('dashboard.markingCollectedButton', 'Marking…') : t('dashboard.markCollectedButton', 'Mark as collected')}
                          </button>
                          {(listing.claimId || listing.claim_id) && (
                            <button type="button" style={BTN_OUTLINE()} onClick={() => { setChatClaimId(listing.claimId || listing.claim_id); setChatListingTitle(listing.foodType) }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>forum</span>
                              Chat with donor
                            </button>
                          )}
                          <button type="button" style={BTN_DANGER} onClick={() => handleRemoveClaim(listing.id)} disabled={removingId === listing.id || pickingUpId === listing.id}>
                            {removingId === listing.id ? 'Removing…' : 'Remove claim'}
                          </button>
                        </div>
                      ) : isCollectedByCurrentOrg ? (
                        <div style={{ background: 'rgba(149,212,179,0.12)', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, border: '1px solid rgba(149,212,179,0.2)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#95d4b3' }}>done_all</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#95d4b3' }}>
                            {t('dashboard.collectedInfo', 'Collection confirmed. Donation completed.')}
                          </span>
                        </div>
                      ) : (
                        <div style={{ marginTop: 4 }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" style={BTN_OUTLINE()} onClick={() => openDetailsDialog(listing)}>
                              {t('listing.viewDetailsButton', 'View details')}
                            </button>
                            <button type="button"
                              style={isClaimBlocked
                                ? { ...BTN_PRIMARY, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)', cursor: 'not-allowed' }
                                : BTN_PRIMARY}
                              onClick={() => handleClaim(listing)}
                              disabled={claimingId === listing.id || isClaimBlocked}
                            >
                              {claimingId === listing.id ? t('listing.claimingButton') : isAvailableAndExpired ? t('listing.claimUnavailableButton', 'Unavailable') : t('listing.claimItemButton', 'Claim')}
                            </button>
                          </div>
                          {isClaimBlocked && (
                            <p style={{ fontSize: 11, color: '#ffb4ab', margin: '7px 0 0', lineHeight: 1.4 }}>{claimBlockReason}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                )

                // After every 5 cards inject a Sarah insight card spanning full row
                if ((idx + 1) % 6 === 0 && idx < filteredListings.length - 1) {
                  const SARAH_CARDS = [
                    { icon: 'volunteer_activism', accent: '#fc9174', quote: "“When I see a listing about to expire I claim it immediately — perishables can’t wait until tomorrow.”", sub: 'Sarah M. — Community Manager, Reservoir VIC' },
                    { icon: 'travel_explore',     accent: '#95d4b3', quote: "“Area Intelligence told me Footscray had zero veg stock this Tuesday. I rerouted a full van there in under an hour.”", sub: 'Sarah M. — Community Manager, Reservoir VIC' },
                    { icon: 'near_me',            accent: '#c2c4e5', quote: "“Around Me helped me discover two donors just 4km away I never knew existed. That’s 80 extra meals a week.”", sub: 'Sarah M. — Community Manager, Reservoir VIC' },
                  ]
                  const sc = SARAH_CARDS[Math.floor(idx / 6) % SARAH_CARDS.length]
                  return [
                    card,
                    <div key={`sarah-${idx}`} style={{ gridColumn: '1 / -1', background: `rgba(${sc.accent === '#fc9174' ? '252,145,116' : sc.accent === '#95d4b3' ? '149,212,179' : '194,196,229'},0.07)`, border: `1px solid rgba(${sc.accent === '#fc9174' ? '252,145,116' : sc.accent === '#95d4b3' ? '149,212,179' : '194,196,229'},0.18)`, borderRadius: 20, padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 20 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 14, background: `rgba(${sc.accent === '#fc9174' ? '252,145,116' : sc.accent === '#95d4b3' ? '149,212,179' : '194,196,229'},0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 26, color: sc.accent }}>{sc.icon}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 15, fontWeight: 600, color: '#fff', margin: '0 0 6px', lineHeight: 1.5, fontStyle: 'italic' }}>{sc.quote}</p>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{sc.sub}</span>
                      </div>
                    </div>,
                  ]
                }
                return card
              })}
            </div>
          )}
        </main>
      </div>

      {/* Claim modal */}
      {claimDialogListing && (
        <div onClick={closeClaimDialog}
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(10,25,18,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'rgba(27,67,50,0.98)', border: '1px solid rgba(149,212,179,0.25)', borderRadius: 24, padding: 32, maxWidth: 460, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>{t('dashboard.claimDialog.title')}</h2>
              <button type="button" onClick={closeClaimDialog} style={{ border: 'none', background: 'rgba(255,255,255,0.08)', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
            <div style={{ background: 'rgba(149,212,179,0.10)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(149,212,179,0.2)' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{claimDialogListing.foodType}</span>
              <span style={{ fontSize: 13, color: '#fc9174', fontWeight: 500 }}>{formatSourceLabel(claimDialogListing, orgCode, t)}</span>
            </div>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginBottom: 16 }}>
              {t('dashboard.claimDialog.available', {
                quantity: formatQuantityValue(claimDialogListing.quantity),
                unit: t(`listing.units.${claimDialogListing.unit || 'portions'}`, claimDialogListing.unit || 'portions'),
              })}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24, padding: '14px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: 12, fontSize: 13, border: '1px solid rgba(255,255,255,0.08)' }}>
              {[
                { icon: 'schedule', text: getExpiryMeta(claimDialogListing.expiryDate).isToday ? t('listing.bestBeforeToday', 'Best before today') : `${t('listing.bestBefore', 'Best before')} ${formatBestBeforeLabel(claimDialogListing.expiryDate, i18n.language === 'zh' ? 'zh-CN' : 'en-AU') || '—'}` },
                { icon: 'kitchen', text: `${t('listing.storageLabel', 'Storage')}: ${formatStorageCondition(getStorageCondition(claimDialogListing), t)}` },
                { icon: 'calendar_month', text: `${t('listing.pickupWindowLabel', 'Pickup')}: ${String(claimDialogListing.pickupWindow || claimDialogListing.pickup_window || '').trim() || t('listing.storage.unknown', 'Not provided')}` },
                { icon: 'warning', text: `${t('listing.allergenLabel', 'Allergens')}: ${(() => { const tags = getAllergenTags(claimDialogListing).map(tag => String(tag || '').trim()).filter(Boolean); return tags.length === 0 ? t('listing.allergenRequired', 'Allergen info required') : tags.map(tag => formatAllergenTag(tag, t)).join(', ') })()}` },
              ].map(({ icon, text }) => (
                <div key={icon} style={DARK_DETAIL_ROW}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#95d4b3', flexShrink: 0 }}>{icon}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: 10 }}>
                {t('dashboard.claimDialog.quantityLabel', 'How many portions?')}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button type="button" onClick={() => handleClaimQuantityAdjust(-1)} disabled={Boolean(claimDialogBlockedReason) || claimingId === claimDialogListing.id}
                  style={{ width: 42, height: 42, borderRadius: 10, border: '1px solid rgba(149,212,179,0.25)', background: 'rgba(149,212,179,0.08)', fontSize: 20, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#95d4b3' }}>−</button>
                <input type="text" inputMode="decimal" value={claimQuantity} disabled={Boolean(claimDialogBlockedReason)}
                  onChange={e => { setClaimQuantity(e.target.value.replace(/[^0-9.]/g, '')); if (claimError) setClaimError('') }}
                  style={{ flex: 1, height: 42, textAlign: 'center', fontSize: 20, fontWeight: 700, color: '#fff', border: '1px solid rgba(149,212,179,0.25)', borderRadius: 10, outline: 'none', fontFamily: 'inherit', background: 'rgba(255,255,255,0.06)' }} />
                <button type="button" onClick={() => handleClaimQuantityAdjust(1)} disabled={Boolean(claimDialogBlockedReason) || claimingId === claimDialogListing.id}
                  style={{ width: 42, height: 42, borderRadius: 10, border: '1px solid rgba(149,212,179,0.25)', background: 'rgba(149,212,179,0.08)', fontSize: 20, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#95d4b3' }}>+</button>
              </div>
              <button type="button" onClick={handleClaimAll} disabled={Boolean(claimDialogBlockedReason) || claimingId === claimDialogListing.id}
                style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: '#95d4b3', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                {t('dashboard.claimDialog.claimAll', `Claim all ${formatQuantityValue(maxClaimQuantity)}`)}
              </button>
            </div>
            {(claimDialogBlockedReason || claimError) && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,180,171,0.12)', color: '#ffb4ab', fontSize: 13, marginBottom: 16, border: '1px solid rgba(255,180,171,0.2)' }}>
                {claimDialogBlockedReason || claimError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={closeClaimDialog} disabled={Boolean(claimingId)} style={{ ...BTN_MUTED }}>
                {t('common.cancel', 'Cancel')}
              </button>
              <button type="button" onClick={submitClaimQuantity} disabled={Boolean(claimingId) || Boolean(claimDialogBlockedReason)}
                style={claimDialogBlockedReason ? { ...BTN_PRIMARY, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)', cursor: 'not-allowed' } : BTN_PRIMARY}>
                {claimingId === claimDialogListing.id ? t('listing.claimingButton') : t('dashboard.claimDialog.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details modal */}
      {detailDialogListing && (
        <div onClick={closeDetailsDialog}
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(10,25,18,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'rgba(27,67,50,0.98)', border: '1px solid rgba(149,212,179,0.25)', borderRadius: 24, padding: 32, maxWidth: 460, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>{t('dashboard.detailsDialog.title', 'Listing details')}</h2>
              <button type="button" onClick={closeDetailsDialog} style={{ border: 'none', background: 'rgba(255,255,255,0.08)', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
            <div style={{ background: 'rgba(149,212,179,0.10)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, border: '1px solid rgba(149,212,179,0.2)' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>{detailDialogListing.foodType}</span>
              <span style={{ fontSize: 13, color: '#fc9174', fontWeight: 500 }}>{formatSourceLabel(detailDialogListing, orgCode, t)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: 12, fontSize: 13, marginBottom: 24, border: '1px solid rgba(255,255,255,0.08)' }}>
              {[
                { icon: 'inventory_2', text: `${t('dashboard.detailsDialog.availableLabel', 'Available')}: ${formatQuantityValue(detailDialogListing.quantity)} ${t(`listing.units.${detailDialogListing.unit || 'portions'}`, detailDialogListing.unit || 'portions')}` },
                { icon: 'location_on', text: `${t('listing.postcode', 'Postcode')}: ${detailDialogListing.postcode}` },
                { icon: 'schedule', text: getExpiryMeta(detailDialogListing.expiryDate).isToday ? t('listing.bestBeforeToday', 'Best before today') : `${t('listing.bestBefore', 'Best before')} ${formatBestBeforeLabel(detailDialogListing.expiryDate, i18n.language === 'zh' ? 'zh-CN' : 'en-AU') || '—'}` },
                { icon: 'kitchen', text: `${t('listing.storageLabel', 'Storage')}: ${formatStorageCondition(getStorageCondition(detailDialogListing), t)}` },
                { icon: 'calendar_month', text: `${t('listing.pickupWindowLabel', 'Pickup window')}: ${String(detailDialogListing.pickupWindow || detailDialogListing.pickup_window || '').trim() || t('listing.storage.unknown', 'Not provided')}` },
                { icon: 'warning', text: `${t('listing.allergenLabel', 'Allergens')}: ${(() => { const tags = getAllergenTags(detailDialogListing).map(tag => String(tag || '').trim()).filter(Boolean); return tags.length === 0 ? t('listing.allergenRequired', 'Required') : tags.map(tag => formatAllergenTag(tag, t)).join(', ') })()}` },
              ].map(({ icon, text }) => (
                <div key={icon + text} style={DARK_DETAIL_ROW}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#95d4b3', flexShrink: 0 }}>{icon}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
            {detailDialogIsClaimBlocked && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,180,171,0.12)', color: '#ffb4ab', fontSize: 13, marginBottom: 16, border: '1px solid rgba(255,180,171,0.2)' }}>
                {detailDialogBlockReason}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={closeDetailsDialog} style={BTN_MUTED}>{t('common.close', 'Close')}</button>
              <button type="button"
                style={detailDialogIsClaimBlocked ? { ...BTN_PRIMARY, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)', cursor: 'not-allowed' } : BTN_PRIMARY}
                disabled={detailDialogIsClaimBlocked}
                onClick={() => openClaimDialog(detailDialogListing)}>
                {detailDialogIsClaimBlocked ? t('listing.claimUnavailableButton', 'Claim unavailable') : `${t('listing.claimItemButton', 'Claim item')} →`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat modal */}
      {chatClaimId && (
        <ChatModal claimId={chatClaimId} orgCode={orgCode} listingTitle={chatListingTitle} onClose={() => setChatClaimId(null)} />
      )}

    </div>
  )
}

export default LiveListingBoard
