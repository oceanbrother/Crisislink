import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { deleteListing, getAvailableListings } from '../services/api'
import { DIETARY_FILTER_OPTIONS, FILTER_OPTIONS, formatBestBeforeLabel, resolveListingCategory } from '../constants/listings'
import DonorFeatureNav from '../components/DonorFeatureNav'
import LogisticsGuideCard from '../components/LogisticsGuideCard'
import WorkspaceContextCard from '../components/WorkspaceContextCard'
import WorkspaceFilterPanel from '../components/WorkspaceFilterPanel'
import WorkspaceHeader from '../components/WorkspaceHeader'
import WorkspaceSummaryCard from '../components/WorkspaceSummaryCard'
import { forgetDonorListing, getOrCreateDonorCode, isRememberedDonorListing } from '../utils/donorIdentity'
import { resolveImageUrl } from '../utils/imageUrl'
import { getSavedDonorPostcode, saveDonorPostcode } from '../utils/donorPostcode'
import { mergeListingSafetyFallback } from '../utils/listingSafety'
import '../styles/PostFeedPage.css'

function getDietaryClass(tag) {
  if (!tag) return ''
  return String(tag).toLowerCase().replace(/\s+/g, '-')
}

function normalizeDietaryTag(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '-')
}

function resolveDietaryTranslationKey(value) {
  const normalized = normalizeDietaryTag(value)
  if (normalized === 'non-vegetarian') return 'nonVegetarian'
  if (normalized === 'dairy-free' || normalized === 'lactose-free') return 'dairyFree'
  if (normalized === 'gluten-free') return 'glutenFree'
  return normalized
}

function matchesDietaryFilter(tags, filterValue) {
  if (filterValue === 'all') return true
  if (!Array.isArray(tags) || tags.length === 0) return false

  return tags.some((rawTag) => {
    const normalized = normalizeDietaryTag(rawTag)
    if (filterValue === 'dairy-free') {
      return normalized === 'dairy-free' || normalized === 'lactose-free'
    }
    return normalized === filterValue
  })
}

function formatStorageCondition(storageCondition, t) {
  const value = String(storageCondition || '').trim()
  if (!value) return t('listing.storage.unknown', 'Not provided')
  return t(`listing.storage.${value}`, value)
}

function normalizeAllergenTag(tag) {
  return String(tag || '').trim().toLowerCase()
}

function getAllergenTags(listing) {
  if (Array.isArray(listing?.allergenTags)) return listing.allergenTags
  if (Array.isArray(listing?.allergen_tags)) return listing.allergen_tags
  return []
}

function getStorageCondition(listing) {
  return String(listing?.storageCondition || listing?.storage_condition || '').trim()
}

function normalizeDateOnly(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  parsed.setHours(0, 0, 0, 0)
  return parsed
}

function getExpiryMeta(expiryDate) {
  const parsed = normalizeDateOnly(expiryDate)
  if (!parsed) {
    return { hasDate: false, isToday: false, isExpired: false }
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const deltaDays = Math.round((parsed.getTime() - today.getTime()) / 86400000)
  return {
    hasDate: true,
    isToday: deltaDays === 0,
    isExpired: deltaDays < 0,
  }
}

function formatAllergenTag(tag, t) {
  const normalized = normalizeAllergenTag(tag)
  if (!normalized) return ''
  if (normalized === 'no known allergens') {
    return t('listing.allergens.noknownallergens', 'No known allergens')
  }
  const key = normalized.replace(/\s+/g, '')
  return t(`listing.allergens.${key}`, tag)
}

function isLegacyDonorListing(listing, currentPostcode) {
  const listingOrgCode = String(listing?.orgCode || '').trim().toUpperCase()
  const postcode = String(currentPostcode || '').trim()
  return postcode !== '' && listingOrgCode === ('DONOR-' + postcode).toUpperCase()
}

function isOwnedDonorListing(listing, donorCode, postcode) {
  return (
    listing.orgCode === donorCode ||
    isRememberedDonorListing(listing.id) ||
    isLegacyDonorListing(listing, postcode)
  )
}

function getRelativeTime(createdAt, t) {
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

function formatCollectedAtLabel(collectedAt, locale) {
  if (!collectedAt) return ''
  const date = new Date(collectedAt)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(locale || 'en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
  })
}

function formatQuantityValue(value) {
  const numeric = Number(value)
  if (Number.isFinite(numeric) === false) return String(value ?? '')
  return Number.isInteger(numeric) ? String(numeric) : String(numeric.toFixed(2)).replace(/\.00$/, '')
}

function formatApproxQuantityLabel(listing, t) {
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

function tokenizeSearch(value) {
  return String(value || '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/gu)
    .filter(Boolean)
}

function matchesSearchFields(fields, term) {
  const normalizedTerm = String(term || '').trim().toLowerCase()
  if (!normalizedTerm) return true

  return fields.some((value) => {
    const text = String(value || '').toLowerCase().trim()
    if (!text) return false
    const tokens = tokenizeSearch(text)

    if (normalizedTerm.length === 1) {
      return tokens.some((token) => token.startsWith(normalizedTerm))
    }

    return text.includes(normalizedTerm) || tokens.some((token) => token.startsWith(normalizedTerm))
  })
}

function getSearchableFields(listing, term) {
  const normalizedTerm = String(term || '').trim().toLowerCase()
  const primaryFields = [listing.foodType, listing.description]

  if (!normalizedTerm) {
    return primaryFields
  }

  const secondaryFields = []

  if (normalizedTerm.length >= 2) {
    secondaryFields.push(listing.sizeCue)
  }

  if (/\d/.test(normalizedTerm)) {
    secondaryFields.push(listing.postcode)
  }

  return [...primaryFields, ...secondaryFields]
}

const PostFeedPage = () => {
  const { postcode: routePostcode } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { t, i18n } = useTranslation()

  const [activeFilter, setActiveFilter] = useState('All')
  const [activeFoodType, setActiveFoodType] = useState('all')
  const [listingScope, setListingScope] = useState('all')
  const [search, setSearch] = useState('')
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [brokenImageIds, setBrokenImageIds] = useState([])

  const donorCode = useMemo(() => getOrCreateDonorCode(), [])
  const postcode = String(routePostcode || location.state?.postcode || getSavedDonorPostcode() || '').trim()

  const fetchListings = async () => {
    try {
      setLoading(true)
      const buildFilters = (status) => {
        const filters = { status }
        if (postcode) filters.postcode = postcode
        return filters
      }

      const [availableData, claimedData, collectedData] = await Promise.all([
        getAvailableListings(buildFilters('available')).catch(() => []),
        getAvailableListings(buildFilters('claimed')).catch(() => []),
        getAvailableListings(buildFilters('collected')).catch(() => []),
      ])

      const mergedById = new Map()
      // We fetch status buckets separately, then merge by listing id so a listing
      // appears once even if backend transitions happen between requests.
      ;[availableData, claimedData, collectedData].forEach((bucket) => {
        ;(Array.isArray(bucket) ? bucket : []).forEach((listing) => {
          mergedById.set(listing.id, listing)
        })
      })

      const safeListings = Array.from(mergedById.values()).map((listing) => mergeListingSafetyFallback(listing))
      setListings(safeListings)
      setError('')
    } catch (err) {
      console.error('Fetch donor listings error:', err)
      setListings([])
      setError(t('feed.loadError', 'Unable to load listings right now.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    saveDonorPostcode(postcode)
    fetchListings()
  }, [postcode])

  const filteredListings = useMemo(() => {
    const term = search.trim().toLowerCase()
    return listings.filter((listing) => {
      const category = resolveListingCategory(listing.category, listing.foodType)
      const ownListing = isOwnedDonorListing(listing, donorCode, postcode)

      if (!ownListing) return false
      // Treat legacy `picked_up` as `collected` in UI filters.
      const statusValue = String(listing.status || '').toLowerCase()
      const normalizedStatus = statusValue === 'picked_up' ? 'collected' : statusValue
      if (listingScope !== 'all' && normalizedStatus !== listingScope) return false

      const matchesFilter = activeFilter === 'All' || category === activeFilter
      if (!matchesFilter) return false

      const matchesFoodType = matchesDietaryFilter(listing.dietary_tags, activeFoodType)
      if (!matchesFoodType) return false

      return matchesSearchFields(getSearchableFields(listing, term), term)
    })
  }, [activeFilter, activeFoodType, donorCode, listingScope, listings, postcode, search])

  const hasActiveSearch = search.trim() !== ''
  const hasActiveFilter = activeFilter !== 'All'
  const hasActiveFoodTypeFilter = activeFoodType !== 'all'
  const hasActiveScopeFilter = listingScope !== 'all'
  const hasActiveControls = hasActiveSearch || hasActiveFilter || hasActiveFoodTypeFilter || hasActiveScopeFilter
  const isBaseEmpty = listings.length === 0
  const isFilteredEmpty = !loading && !isBaseEmpty && filteredListings.length === 0

  const clearFilters = () => {
    setSearch('')
    setActiveFilter('All')
    setActiveFoodType('all')
    setListingScope('all')
  }

  const donorSummary = useMemo(() => {
    return listings.reduce((acc, listing) => {
      if (!isOwnedDonorListing(listing, donorCode, postcode)) return acc
      acc.total += 1
      // Keep summary counters aligned with status filter semantics.
      const statusValue = String(listing.status || '').toLowerCase()
      const normalizedStatus = statusValue === 'picked_up' ? 'collected' : statusValue
      if (normalizedStatus === 'available') acc.available += 1
      if (normalizedStatus === 'claimed') acc.claimed += 1
      if (normalizedStatus === 'collected') acc.collected += 1
      return acc
    }, { total: 0, available: 0, claimed: 0, collected: 0 })
  }, [donorCode, listings, postcode])


  const handleEdit = (listing) => {
    navigate('/donor/post', {
      state: {
        postcode: listing.postcode,
        editMode: true,
        listing,
        orgMode: false,
      },
    })
  }

  const handleCreatePost = () => {
    navigate('/donor/post', {
      state: {
        postcode,
        orgMode: false,
      },
    })
  }

  const handleRemove = async (listing) => {
    try {
      await deleteListing(listing.id, listing.orgCode || donorCode)
      forgetDonorListing(listing.id)
      await fetchListings()
    } catch (err) {
      console.error('Remove donor listing error:', err)
      setError(t('feed.removeError', 'Unable to remove this listing right now.'))
    }
  }

  const markImageBroken = (listingId) => {
    setBrokenImageIds((prev) => (prev.includes(listingId) ? prev : [...prev, listingId]))
  }

  return (
    <div className="post-feed-page donor-role-page">
      <WorkspaceHeader
        role="donor"
        onBackClick={() => navigate('/roles')}
        onBrandClick={() => navigate('/roles')}
      />

      <main className="feed-content donor-feed-content">
        <div className="workspace-nav-row donor-area-nav-row">
          <DonorFeatureNav active="listings" postcode={postcode} />
        </div>
        <LogisticsGuideCard role="donor" />

        <WorkspaceSummaryCard
          role="donor"
          className="workspace-listings-summary workspace-listings-summary--donor"
          title={t('feed.pageTitle', 'My listings')}
          subtitle={t('feed.subtitle', 'Edit or remove the items you have posted.')}
          action={(
            <button
              type="button"
              className="workspace-primary-action workspace-summary-card__cta donor-quick-post-btn"
              onClick={handleCreatePost}
              aria-label={t('feed.quickPostTooltip', 'Post surplus food')}
              title={t('feed.quickPostTooltip', 'Post surplus food')}
            >
              <span className="material-symbols-outlined" aria-hidden="true">add</span>
              <span>{t('feed.quickPost', 'Post food')}</span>
            </button>
          )}
          context={(
            <WorkspaceContextCard
              label={t('listing.postcode', 'Postcode')}
              value={postcode || t('feed.postcodePending', 'Saved on next post')}
              supportingText={t('feed.postcodeHint', 'Reference postcode for your donor workspace.')}
              icon="location_on"
            />
          )}
        >
          <div className="workspace-summary-grid donor-summary-grid">
            <button
              type="button"
              className={listingScope === 'all'
                ? 'workspace-summary-metric workspace-summary-metric--button donor-summary-card donor-summary-card--all is-active'
                : 'workspace-summary-metric workspace-summary-metric--button donor-summary-card donor-summary-card--all'}
              onClick={() => setListingScope('all')}
            >
              <span className="workspace-summary-metric__label">{t('feed.statusTabs.all', 'All listings')}</span>
              <strong className="workspace-summary-metric__value">{donorSummary.total}</strong>
            </button>
            <button
              type="button"
              className={listingScope === 'available'
                ? 'workspace-summary-metric workspace-summary-metric--soft workspace-summary-metric--button donor-summary-card donor-summary-card--available is-active'
                : 'workspace-summary-metric workspace-summary-metric--soft workspace-summary-metric--button donor-summary-card donor-summary-card--available'}
              onClick={() => setListingScope('available')}
            >
              <span className="workspace-summary-metric__label">{t('feed.statusTabs.available', 'Available listings')}</span>
              <strong className="workspace-summary-metric__value">{donorSummary.available}</strong>
            </button>
            <button
              type="button"
              className={listingScope === 'claimed'
                ? 'workspace-summary-metric workspace-summary-metric--soft workspace-summary-metric--button donor-summary-card donor-summary-card--claimed is-active'
                : 'workspace-summary-metric workspace-summary-metric--soft workspace-summary-metric--button donor-summary-card donor-summary-card--claimed'}
              onClick={() => setListingScope('claimed')}
            >
              <span className="workspace-summary-metric__label">{t('feed.statusTabs.claimed', 'Claimed listings')}</span>
              <strong className="workspace-summary-metric__value">{donorSummary.claimed}</strong>
            </button>
            <button
              type="button"
              className={listingScope === 'collected'
                ? 'workspace-summary-metric workspace-summary-metric--soft workspace-summary-metric--button donor-summary-card donor-summary-card--collected is-active'
                : 'workspace-summary-metric workspace-summary-metric--soft workspace-summary-metric--button donor-summary-card donor-summary-card--collected'}
              onClick={() => setListingScope('collected')}
            >
              <span className="workspace-summary-metric__label">{t('feed.statusTabs.collected', 'Collected listings')}</span>
              <strong className="workspace-summary-metric__value">{donorSummary.collected}</strong>
            </button>
          </div>
        </WorkspaceSummaryCard>

        <WorkspaceFilterPanel role="donor" className="filter-section workspace-listings-filters workspace-listings-filters--donor donor-filter-section">
          <div className={hasActiveSearch ? 'search-wrapper donor-search-wrapper donor-search-wrapper--active' : 'search-wrapper donor-search-wrapper'}>
            <span className="material-symbols-outlined search-icon">search</span>
            <input
              className={hasActiveSearch ? 'search-input search-input--active' : 'search-input'}
              type="text"
              placeholder={t('feed.searchDonor', 'Search your listings')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {hasActiveSearch ? (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearch('')}
                aria-label={t('feed.clearSearch', 'Clear search')}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            ) : null}
          </div>
          <div className="filter-group filter-panel-group">
            <div className="filter-group-heading">
              <div className="filter-group-label">{t('dashboard.filterLabels.category')}</div>
            </div>
            <div className="filter-chips donor-filter-chips">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={activeFilter === option.value ? 'filter-chip active' : 'filter-chip'}
                  onClick={() => setActiveFilter(option.value)}
                >
                  {option.value === 'All'
                    ? t('dashboard.filterLabels.allCategories')
                    : t('dashboard.tabs.' + option.key, option.value)}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group filter-panel-group">
            <div className="filter-group-heading">
              <div className="filter-group-label">{t('dashboard.filterLabels.foodType', 'Food type')}</div>
            </div>
            <div className="filter-chips donor-filter-chips">
              {DIETARY_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={activeFoodType === option.value ? 'filter-chip active' : 'filter-chip'}
                  onClick={() => setActiveFoodType(option.value)}
                >
                  {option.value === 'all'
                    ? t('dashboard.tabs.allTypes', 'All types')
                    : t(`listing.dietary.${option.key}`, option.value)}
                </button>
              ))}
            </div>
          </div>

          {hasActiveControls ? (
            <div className={`filter-feedback-row ${hasActiveSearch ? '' : 'filter-feedback-row--minimal'}`.trim()} aria-live="polite">
              <div className="filter-feedback-pills">
                {hasActiveSearch ? (
                  <span className="filter-feedback-pill filter-feedback-pill--query">
                    <span className="material-symbols-outlined">search</span>
                    {t('feed.searchingFor', 'Searching for')} “{search.trim()}”
                  </span>
                ) : null}
                {hasActiveFilter ? (
                  <span className="filter-feedback-pill">
                    {t('feed.filteringCategory', 'Category')} · {t('dashboard.tabs.' + (FILTER_OPTIONS.find((option) => option.value === activeFilter)?.key || 'all'), activeFilter)}
                  </span>
                ) : null}
                {hasActiveFoodTypeFilter ? (
                  <span className="filter-feedback-pill">
                    {t('dashboard.filterLabels.foodType', 'Food type')} · {t(`listing.dietary.${resolveDietaryTranslationKey(activeFoodType)}`, activeFoodType)}
                  </span>
                ) : null}
                {hasActiveScopeFilter ? (
                  <span className="filter-feedback-pill">
                    {t('dashboard.filterLabels.status', 'Status')} · {t(`feed.statusTabs.${listingScope}`, listingScope)}
                  </span>
                ) : null}
              </div>
              <button type="button" className="filter-clear-btn" onClick={clearFilters}>
                {t('feed.clearFilters', 'Clear filters')}
              </button>
            </div>
          ) : (
            <p className="filter-feedback-hint">{t('feed.filterHint', 'Search by food name, notes, category, or postcode.')}</p>
          )}

          {isFilteredEmpty ? null : (
            <div className="feed-meta-row">
              <span className={hasActiveControls ? 'feed-count feed-count--filtered' : 'feed-count'}>
                {hasActiveControls
                  ? t('feed.showingMatches', { count: filteredListings.length })
                  : t('listing.itemsAvailable', { count: filteredListings.length })}
              </span>
            </div>
          )}
        </WorkspaceFilterPanel>

        {error ? <div className="error-message board-error">{error}</div> : null}

        {loading ? (
          <div className="empty-state empty-state--rich"><p>{t('common.loading')}</p></div>
        ) : isBaseEmpty ? (
          <div className="empty-state empty-state--rich">
            <span className="material-symbols-outlined empty-state-icon">inventory_2</span>
            <h3 className="empty-state-title">{t('feed.emptyTitle', 'No donor listings yet')}</h3>
            <p className="empty-state-subtitle">{t('feed.emptyHint', 'Once you post surplus food from this postcode, it will appear here for you to manage.')}</p>
          </div>
        ) : isFilteredEmpty ? (
          <div className="empty-state empty-state--rich">
            <span className="material-symbols-outlined empty-state-icon">search_off</span>
            <h3 className="empty-state-title">{t('feed.emptySearchTitle', 'No matching donor listings')}</h3>
            <p className="empty-state-subtitle">{t('feed.emptySearchHint', 'Try another search term or clear the active category filter to see all of your listings again.')}</p>
            <button type="button" className="empty-state-action" onClick={clearFilters}>{t('feed.clearFilters', 'Clear filters')}</button>
          </div>
        ) : (
          <div className="food-grid donor-food-grid">
            {filteredListings.map((listing) => {
              const ownListing = isOwnedDonorListing(listing, donorCode, postcode)
              const dietaryTag = Array.isArray(listing.dietary_tags) && listing.dietary_tags.length > 0 ? listing.dietary_tags[0] : ''
              const allergenTags = getAllergenTags(listing).map((tag) => String(tag || '').trim()).filter(Boolean)
              const allergenDisplayTags = allergenTags.length > 0 ? allergenTags : ['no known allergens']
              const storageLabel = formatStorageCondition(getStorageCondition(listing), t)
              const bestBefore = formatBestBeforeLabel(listing.expiryDate, i18n.language === 'zh' ? 'zh-CN' : 'en-AU')
              const category = resolveListingCategory(listing.category, listing.foodType)
              const categoryOption = FILTER_OPTIONS.find((option) => option.value === category)
              const expiryMeta = getExpiryMeta(listing.expiryDate)
              const isExpiredListing = ownListing && expiryMeta.isExpired
              const statusValue = String(listing.status || '').toLowerCase()
              const isClaimedListing = statusValue === 'claimed'
              const isCollectedListing = statusValue === 'collected' || statusValue === 'picked_up'
              const collectedAtLabel = formatCollectedAtLabel(
                listing.pickedUpAt || listing.picked_up_at,
                i18n.language === 'zh' ? 'zh-CN' : 'en-AU',
              )
              const listingLocked = ownListing && (listing.hasClaims || isExpiredListing || isClaimedListing || isCollectedListing)
              const listingLockReason = listing.hasClaims
                ? t('feed.editLockedTooltip', 'This listing has already been claimed and can no longer be edited or removed.')
                : (isCollectedListing
                    ? t('feed.editLockedCollectedTooltip', 'This listing has already been collected and can no longer be edited or removed.')
                    : (isClaimedListing
                        ? t('feed.editLockedClaimedTooltip', 'This listing is currently claimed and can no longer be edited or removed.')
                        : (isExpiredListing
                            ? t('feed.editLockedExpiredTooltip', 'This listing has expired and can no longer be edited or removed.')
                            : '')))
              const relativeTime = getRelativeTime(listing.createdAt, t)
              const imageUrl = resolveImageUrl(listing.photoUrl)
              const shouldShowImage = imageUrl && !brokenImageIds.includes(listing.id)
              const pickupWindow = String(listing.pickupWindow || listing.pickup_window || '').trim()

              return (
                <article key={listing.id} className={ownListing ? 'food-card own-listing-card donor-card' : 'food-card donor-card'}>
                  {shouldShowImage ? (
                    <img
                      className="food-card-image"
                      src={imageUrl}
                      alt={listing.foodType}
                      onError={() => markImageBroken(listing.id)}
                    />
                  ) : null}

                  <div className="food-card-header donor-card-header">
                    <div className="donor-card-heading-stack">
                      <h3 className="food-card-title donor-card-title">{listing.foodType}</h3>
                      <div className="donor-card-meta-row">
                        <p className="food-card-source donor-card-source">
                          {ownListing
                            ? t('feed.postedByYou', 'Posted by you')
                            : t('feed.availableForGroups', 'Available to community groups')}
                        </p>
                        <span className="donor-card-time">{relativeTime}</span>
                      </div>
                      <div className="donor-card-category-row">
                        <span className="food-card-category donor-card-category">
                          {t('dashboard.tabs.' + (categoryOption?.key || 'other'), category)}
                        </span>
                      </div>
                      {isCollectedListing ? (
                        <div className="donor-card-status donor-card-status--collected">
                          {t('dashboard.statusPills.collected', 'Collected')}
                        </div>
                      ) : isClaimedListing ? (
                        <div className="donor-card-status donor-card-status--claimed">
                          {t('dashboard.statusPills.claimedSimple', 'Claimed')}
                        </div>
                      ) : (
                        <div className="donor-card-status donor-card-status--available">
                          {t('dashboard.statusPills.available', 'Available to claim')}
                        </div>
                      )}
                      {isExpiredListing ? (
                        <div className="donor-card-status donor-card-status--expired">
                          {t('dashboard.statusPills.expired', 'Expired — cannot claim')}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="food-card-details donor-card-details">
                    <div className="food-card-detail-row donor-card-detail-row">
                      <span className="material-symbols-outlined">inventory_2</span>
                      <span>{formatApproxQuantityLabel(listing, t)}</span>
                    </div>
                    {listing.sizeCue ? (
                      <div className="food-card-detail-row donor-card-detail-row">
                        <span className="material-symbols-outlined">straighten</span>
                        <span>{listing.sizeCue}</span>
                      </div>
                    ) : null}
                    <div className="food-card-detail-row donor-card-detail-row">
                      <span className="material-symbols-outlined">location_on</span>
                      <span>{t('listing.postcode', 'Postcode')} {listing.postcode}</span>
                    </div>
                    {bestBefore ? (
                      <div className="food-card-detail-row donor-card-detail-row">
                        <span className="material-symbols-outlined">schedule</span>
                        <span>
                          {expiryMeta.isToday
                            ? t('listing.bestBeforeToday', 'Best before today')
                            : `${t('listing.bestBefore', 'Best before')} ${bestBefore}`}
                        </span>
                      </div>
                    ) : null}
                    <div className="food-card-detail-row donor-card-detail-row">
                      <span className="material-symbols-outlined">kitchen</span>
                      <span>{t('listing.storageLabel', 'Storage')}: {storageLabel}</span>
                    </div>
                    {pickupWindow ? (
                      <div className="food-card-detail-row donor-card-detail-row">
                        <span className="material-symbols-outlined">calendar_month</span>
                        <span>{t('listing.pickupWindowLabel', 'Pickup window')}: {pickupWindow}</span>
                      </div>
                    ) : null}
                    {isCollectedListing && collectedAtLabel ? (
                      <div className="food-card-detail-row donor-card-detail-row">
                        <span className="material-symbols-outlined">event_available</span>
                        <span>{t('listing.collectedAtLabel', 'Collected at')}: {collectedAtLabel}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="card-supporting-stack donor-supporting-stack">
                    {dietaryTag ? (
                      <div className="supporting-panel donor-dietary-panel">
                        <strong className="supporting-panel-label">{t('donation.dietary', 'Dietary tag')}</strong>
                        <div className="tags-row tags-row-spaced donor-tag-row supporting-tag-list">
                          <span className={'tag-chip tag-' + getDietaryClass(dietaryTag)}>
                            {t('listing.dietary.' + getDietaryClass(dietaryTag), dietaryTag)}
                          </span>
                        </div>
                      </div>
                    ) : null}

                    <div className="supporting-panel donor-allergen-panel">
                      <strong className="supporting-panel-label">{t('listing.allergenLabel', 'Allergens')}</strong>
                      <div className="tags-row tags-row-spaced donor-tag-row supporting-tag-list">
                        {allergenDisplayTags.map((tag, index) => (
                          <span key={`${tag}-${index}`} className="tag-chip">
                            {formatAllergenTag(tag, t)}
                          </span>
                        ))}
                      </div>
                    </div>

                    {listing.description ? (
                      <div className="donor-extra-notes supporting-panel">
                        <strong className="supporting-panel-label">{t('donation.extraNotes', 'Extra notes')}</strong>
                        <p>{listing.description}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="food-card-actions donor-card-actions">
                    {ownListing ? (
                      <>
                        <button
                          type="button"
                          className={listingLocked ? 'card-action-btn primary disabled' : 'card-action-btn primary'}
                          onClick={() => handleEdit(listing)}
                          disabled={listingLocked}
                          title={listingLocked ? listingLockReason : ''}
                        >
                          {t('donation.actions.editListing', 'Edit this listing')}
                        </button>
                        <button
                          type="button"
                          className={listingLocked ? 'card-action-btn disabled' : 'card-action-btn'}
                          onClick={() => handleRemove(listing)}
                          disabled={listingLocked}
                          title={listingLocked ? listingLockReason : ''}
                        >
                          {t('donation.actions.removeListing', 'Remove this listing')}
                        </button>
                        {listingLocked ? (
                          <div className="donor-edit-lock-note">
                            {listing.hasClaims
                              ? t('feed.editLockedNote', 'A community group has already claimed part of this listing, so editing and removal are now locked.')
                              : (isCollectedListing
                                  ? t('feed.editLockedCollectedNote', 'This listing has been collected, so editing and removal are now locked.')
                                  : (isClaimedListing
                                      ? t('feed.editLockedClaimedNote', 'This listing is currently claimed, so editing and removal are now locked.')
                                      : t('feed.editLockedExpiredNote', 'This listing has expired, so editing and removal are now locked.')))}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="donor-reference-note">
                        {t('feed.groupClaimNote', 'Community groups can claim this item from their board.')}
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

export default PostFeedPage
