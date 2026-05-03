import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAvailableListings, claimListing, unclaimListing, deleteListing, confirmPickup } from '../services/api'
import { DIETARY_FILTER_OPTIONS, FILTER_OPTIONS, formatBestBeforeLabel, resolveListingCategory } from '../constants/listings'
import OrgFeatureNav from '../components/OrgFeatureNav'
import HowItWorksStrip from '../components/HowItWorksStrip'
import WorkspaceContextCard from '../components/WorkspaceContextCard'
import WorkspaceFilterPanel from '../components/WorkspaceFilterPanel'
import WorkspaceHeader from '../components/WorkspaceHeader'
import WorkspaceSummaryCard from '../components/WorkspaceSummaryCard'
import '../styles/LiveListingBoard.css'

const getTranslatedCategory = (category, foodType, t) => {
  const resolvedCategory = resolveListingCategory(category, foodType)
  const option = FILTER_OPTIONS.find((item) => item.value === resolvedCategory)
  return t(`dashboard.tabs.${option?.key || 'other'}`, resolvedCategory)
}

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

const normalizeDietaryTag = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '-')

const resolveDietaryTranslationKey = (value) => {
  const normalized = normalizeDietaryTag(value)
  if (normalized === 'non-vegetarian') return 'nonVegetarian'
  if (normalized === 'dairy-free' || normalized === 'lactose-free') return 'dairyFree'
  if (normalized === 'gluten-free') return 'glutenFree'
  return normalized
}

const matchesDietaryFilter = (tags, filterValue) => {
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

const tokenizeSearch = (value) => {
  return String(value || '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/gu)
    .filter(Boolean)
}

const matchesSearchFields = (fields, term) => {
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

const getSearchableFields = (listing, term) => {
  const normalizedTerm = String(term || '').trim().toLowerCase()
  const primaryFields = [listing.foodType, listing.description]

  if (!normalizedTerm) {
    return primaryFields
  }

  const secondaryFields = [listing.orgCode]

  if (normalizedTerm.length >= 2) {
    secondaryFields.push(listing.sizeCue)
  }

  if (/\d/.test(normalizedTerm)) {
    secondaryFields.push(listing.postcode)
  }

  if (normalizedTerm.length >= 3 && Array.isArray(listing.dietary_tags)) {
    secondaryFields.push(listing.dietary_tags.join(' '))
  }

  return [...primaryFields, ...secondaryFields]
}

const getListingViewState = (listing, orgCode) => {
  const ownerCode = String(listing?.orgCode || '').trim().toUpperCase()
  const currentOrgCode = String(orgCode || '').trim().toUpperCase()
  const isOwnOrgListing = ownerCode !== '' && ownerCode === currentOrgCode
  const isClaimedByCurrentOrg =
    listing?.status === 'claimed' &&
    String(listing?.claimedBy || '').trim().toUpperCase() === currentOrgCode

  if (isOwnOrgListing) return 'posted'
  if (isClaimedByCurrentOrg) return 'claimed'
  return 'available'
}

const VIEW_STATE_PRIORITY = {
  posted: 0,
  available: 1,
  claimed: 2,
}

const STATUS_OPTIONS = [
  { value: 'all', key: 'all', summaryKey: 'total', className: 'org-summary-card--all' },
  { value: 'available', key: 'available', summaryKey: 'available', className: 'org-summary-card--available' },
  { value: 'posted', key: 'posted', summaryKey: 'posted', className: 'org-summary-card--posted' },
  { value: 'claimed', key: 'claimed', summaryKey: 'claimed', className: 'org-summary-card--claimed' },
]

const parseClaimQuantityValue = (value) => {
  const parsed = Number.parseFloat(String(value ?? '').replace(',', '.').trim())
  if (Number.isFinite(parsed) === false) return null
  return parsed
}

const formatQuantityValue = (value) => {
  const numeric = Number(value)
  if (Number.isFinite(numeric) === false) return String(value ?? '')
  return Number.isInteger(numeric) ? String(numeric) : String(numeric.toFixed(2)).replace(/\.00$/, '')
}

const formatSourceLabel = (listing, orgCode, t) => {
  const ownerCode = String(listing?.orgCode || '').trim()
  const currentOrgCode = String(orgCode || '').trim()

  if (ownerCode && ownerCode.toUpperCase() === currentOrgCode.toUpperCase()) {
    return t('dashboard.statusTabs.posted', 'Posted by us')
  }

  if (ownerCode.toUpperCase().startsWith('DONOR-')) {
    return t('listing.fromDonorCode', { code: ownerCode })
  }

  return t('listing.fromOrganizationCode', {
    code: ownerCode || t('dashboard.communityFallback', 'Community'),
  })
}

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
  const [claimQuantity, setClaimQuantity] = useState('1')
  const [claimError, setClaimError] = useState('')
  const [pickingUpId, setPickingUpId] = useState(null)

  const savedOrgSession = (() => {
    try {
      return JSON.parse(window.localStorage.getItem('crisislink-org-session') || '{}')
    } catch (error) {
      return {}
    }
  })()

  const orgCode = location.state?.orgCode || savedOrgSession.orgCode || 'HCFB-2841'

  useEffect(() => {
    window.localStorage.setItem('crisislink-org-session', JSON.stringify({ orgCode }))
    loadListings()
  }, [orgCode])

  useEffect(() => {
    filterAndDisplayListings()
  }, [listings, searchTerm, filterCategory, filterFoodType, filterStatus, orgCode])

  const loadListings = async () => {
    setLoading(true)
    setError('')
    try {
      const [availableData, claimedData] = await Promise.all([
        getAvailableListings({ status: 'available' }),
        getAvailableListings({ status: 'claimed' }),
      ])
      const mergedData = [
        ...availableData,
        ...claimedData.filter(
          (listing) =>
            String(listing.claimedBy || '').trim().toUpperCase() === String(orgCode || '').trim().toUpperCase(),
        ),
      ]
      const formatted = mergedData.map(listing => ({
        ...listing,
        category: resolveListingCategory(listing.category, listing.foodType),
      }))
      setListings(formatted)
    } catch (err) {
      setError(t('feed.noListings'))
      setListings([])
    } finally {
      setLoading(false)
    }
  }

  const filterAndDisplayListings = () => {
    let filtered = listings

    if (filterCategory !== 'All') {
      filtered = filtered.filter(l => resolveListingCategory(l.category, l.foodType) === filterCategory)
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((listing) => getListingViewState(listing, orgCode) === filterStatus)
    }

    if (filterFoodType !== 'all') {
      filtered = filtered.filter((listing) => matchesDietaryFilter(listing.dietary_tags, filterFoodType))
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter((listing) =>
        matchesSearchFields(getSearchableFields(listing, term), term),
      )
    }

    filtered = [...filtered].sort((a, b) => {
      const stateA = getListingViewState(a, orgCode)
      const stateB = getListingViewState(b, orgCode)
      return (VIEW_STATE_PRIORITY[stateA] ?? 99) - (VIEW_STATE_PRIORITY[stateB] ?? 99)
    })
    
    setFilteredListings(filtered)
  }

  const handleClaim = async (listingId) => {
    setClaimingId(listingId)
    setError('')
    setSuccess('')
    
    try {
      await claimListing(listingId, { orgId: orgCode })
      setSuccess('Listing claimed successfully.')
      await loadListings()
      setTimeout(() => setSuccess(''), 1500)
    } catch (err) {
      setError(t('feed.noListings'))
      setTimeout(() => setError(''), 3000)
    } finally {
      setClaimingId(null)
    }
  }

  const handleRemoveClaim = async (listingId) => {
    setRemovingId(listingId)
    setError('')
    setSuccess('')

    try {
      await unclaimListing(listingId, { orgId: orgCode })
      setSuccess('Claim removed successfully.')
      await loadListings()
      setTimeout(() => setSuccess(''), 1500)
    } catch (err) {
      setError('Unable to remove this claim right now.')
      setTimeout(() => setError(''), 3000)
    } finally {
      setRemovingId(null)
    }
  }

  const handlePickupConfirm = async (listingId) => {
    setPickingUpId(listingId)
    setError('')
    setSuccess('')
    try {
      await confirmPickup(listingId, { orgId: orgCode })
      setSuccess('Pickup confirmed! This listing is now marked as collected.')
      await loadListings()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Unable to confirm pickup right now.')
      setTimeout(() => setError(''), 3000)
    } finally {
      setPickingUpId(null)
    }
  }

  const handlePostExcess = () => {
    navigate('/form', {
      state: {
        orgMode: true,
        orgCode,
        orgName: `Organisation ${orgCode}`,
      },
    })
  }

  const handleEditListing = (listing) => {
    navigate('/form', {
      state: {
        editMode: true,
        listing,
        orgMode: true,
        orgCode,
        orgName: `Organisation ${orgCode}`,
      },
    })
  }

  const handleRemoveListing = async (listing) => {
    setRemovingId(listing.id)
    setError('')
    setSuccess('')

    try {
      await deleteListing(listing.id, listing.orgCode || orgCode)
      setSuccess(t('donation.actions.removeListing', 'Remove this listing'))
      await loadListings()
      setTimeout(() => setSuccess(''), 1200)
    } catch (err) {
      setError('Unable to remove this listing right now.')
      setTimeout(() => setError(''), 3000)
    } finally {
      setRemovingId(null)
    }
  }

  const maxClaimQuantity = useMemo(() => {
    if (!claimDialogListing) return 0
    return Number(claimDialogListing.quantity || 0)
  }, [claimDialogListing])

  const hasActiveSearch = searchTerm.trim() !== ''
  const hasActiveCategoryFilter = filterCategory !== 'All'
  const hasActiveFoodTypeFilter = filterFoodType !== 'all'
  const hasActiveStatusFilter = filterStatus !== 'all'
  const hasActiveControls = hasActiveSearch || hasActiveCategoryFilter || hasActiveFoodTypeFilter || hasActiveStatusFilter
  const isBaseEmpty = listings.length === 0
  const isFilteredEmpty = !loading && !isBaseEmpty && filteredListings.length === 0

  const clearFilters = () => {
    setSearchTerm('')
    setFilterCategory('All')
    setFilterFoodType('all')
    setFilterStatus('all')
  }

  const listingSummary = useMemo(() => {
    return listings.reduce((acc, listing) => {
      const state = getListingViewState(listing, orgCode)
      acc.total += 1
      acc[state] = (acc[state] || 0) + 1
      return acc
    }, { total: 0, available: 0, posted: 0, claimed: 0 })
  }, [listings, orgCode])

  const openClaimDialog = (listing) => {
    setClaimDialogListing(listing)
    setClaimQuantity('1')
    setClaimError('')
    setError('')
    setSuccess('')
  }

  const closeClaimDialog = () => {
    if (claimingId) return
    setClaimDialogListing(null)
    setClaimQuantity('1')
    setClaimError('')
  }

  const handleClaimQuantityAdjust = (delta) => {
    setClaimQuantity((prev) => {
      const current = parseClaimQuantityValue(prev) ?? 0
      const next = Math.max(1, Math.min(maxClaimQuantity, current + delta))
      return formatQuantityValue(next)
    })
  }

  const handleClaimAll = () => {
    if (!claimDialogListing) return
    setClaimQuantity(formatQuantityValue(claimDialogListing.quantity))
    setClaimError('')
  }

  const submitClaimQuantity = async () => {
    if (!claimDialogListing) return

    const requestedQuantity = parseClaimQuantityValue(claimQuantity)
    if (requestedQuantity === null || requestedQuantity <= 0) {
      setClaimError(t('dashboard.claimDialog.invalidQuantity'))
      return
    }
    if (requestedQuantity > maxClaimQuantity) {
      setClaimError(t('dashboard.claimDialog.exceedsQuantity', { quantity: formatQuantityValue(maxClaimQuantity) }))
      return
    }

    setClaimingId(claimDialogListing.id)
    setClaimError('')
    setError('')
    setSuccess('')

    try {
      await claimListing(claimDialogListing.id, { orgId: orgCode, quantity: requestedQuantity })
      setSuccess(t('dashboard.claimDialog.success', { quantity: formatQuantityValue(requestedQuantity) }))
      setClaimDialogListing(null)
      setClaimQuantity('1')
      await loadListings()
      setTimeout(() => setSuccess(''), 1200)
    } catch (err) {
      const detail = err?.response?.data?.detail
      setClaimError(typeof detail === 'string' ? detail : t('dashboard.claimDialog.failed'))
    } finally {
      setClaimingId(null)
    }
  }

  return (
    <div className="live-listing-board org-role-board org-role-page">
      <WorkspaceHeader
        role="org"
        onBackClick={() => navigate('/roles')}
        onBrandClick={() => navigate('/roles')}
      />

      <main className="feed-content org-feed-content">
        <div className="workspace-nav-row org-area-nav-row">
          <OrgFeatureNav active="listings" orgCode={orgCode} />
        </div>

        <WorkspaceSummaryCard
          role="org"
          className="workspace-listings-summary workspace-listings-summary--org"
          title={t('dashboard.title')}
          subtitle={t('dashboard.subtitle', 'Claim available food, post your own listings, and monitor local demand signals.')}
          action={(
            <button className="workspace-primary-action workspace-summary-card__cta org-page-action" onClick={handlePostExcess} title={t('dashboard.shareButton')}>
              <span className="material-symbols-outlined">add</span>
              {t('dashboard.shareButton')}
            </button>
          )}
          context={(
            <WorkspaceContextCard
              label={t('dashboard.organizationCodeLabel', 'Organisation code')}
              value={orgCode}
              supportingText={t('dashboard.orgCodeHint', 'Workspace identity for live listings and collection tools.')}
              icon="groups"
            />
          )}
        >
          <div className="org-summary-grid" role="tablist" aria-label={t('dashboard.filterLabels.status')}>
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={filterStatus === option.value}
                className={`org-summary-card ${option.className} ${filterStatus === option.value ? 'active' : ''}`}
                onClick={() => setFilterStatus(option.value)}
              >
                <span className="org-summary-label">{t(`dashboard.statusTabs.${option.key}`)}</span>
                <strong>{listingSummary[option.summaryKey] || 0}</strong>
              </button>
            ))}
          </div>
        </WorkspaceSummaryCard>

        <HowItWorksStrip role="org" onNavigate={navigate} />

        <WorkspaceFilterPanel role="org" className="filter-section workspace-listings-filters workspace-listings-filters--org org-filter-section">
          <div className={hasActiveSearch ? 'search-wrapper org-search-wrapper org-search-wrapper--active' : 'search-wrapper org-search-wrapper'}>
            <span className="material-symbols-outlined search-icon">search</span>
            <input
              type="text"
              placeholder={t('feed.search')}
              className={hasActiveSearch ? 'search-input search-input--active' : 'search-input'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {hasActiveSearch ? (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchTerm('')}
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
            <div className="filter-chips org-filter-chips">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`filter-chip category-chip ${filterCategory === option.value ? 'active' : ''}`}
                onClick={() => setFilterCategory(option.value)}
                type="button"
              >
                {option.value === 'All'
                  ? t('dashboard.filterLabels.allCategories')
                  : t(`dashboard.tabs.${option.key}`, option.value)}
              </button>
            ))}
            </div>
          </div>

          <div className="filter-group filter-panel-group">
            <div className="filter-group-heading">
              <div className="filter-group-label">{t('dashboard.filterLabels.foodType', 'Food type')}</div>
            </div>
            <div className="filter-chips org-filter-chips">
              {DIETARY_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`filter-chip dietary-chip ${filterFoodType === option.value ? 'active' : ''}`}
                  onClick={() => setFilterFoodType(option.value)}
                  type="button"
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
                    {t('feed.searchingFor', 'Searching for')} “{searchTerm.trim()}”
                  </span>
                ) : null}
                {hasActiveFoodTypeFilter ? (
                  <span className="filter-feedback-pill">
                    {t('dashboard.filterLabels.foodType', 'Food type')} · {t(`listing.dietary.${resolveDietaryTranslationKey(filterFoodType)}`, filterFoodType)}
                  </span>
                ) : null}
              </div>
              <button type="button" className="filter-clear-btn" onClick={clearFilters}>
                {t('feed.clearFilters', 'Clear filters')}
              </button>
            </div>
          ) : (
            <p className="filter-feedback-hint">{t('feed.filterHint', 'Search by food name, notes, size, or postcode.')}</p>
          )}

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {isFilteredEmpty ? null : (
            <div className="feed-meta-row">
              <span className={hasActiveControls ? 'feed-count feed-count--filtered' : 'feed-count'}>
                {hasActiveControls
                  ? t('dashboard.showingMatches', { count: filteredListings.length, defaultValue: `Showing ${filteredListings.length} matching listings` })
                  : t('listing.itemsAvailable', { count: filteredListings.length })}
              </span>
            </div>
          )}
        </WorkspaceFilterPanel>

        <div className="food-grid org-food-grid">
          {loading ? (
            <div className="loading-state empty-state--rich">
              <p>{t('common.loading')}</p>
            </div>
          ) : isBaseEmpty ? (
            <div className="empty-state empty-state--rich">
              <span className="material-symbols-outlined empty-state-icon">inventory_2</span>
              <h3 className="empty-state-title">{t('dashboard.emptyTitle', 'No listings yet')}</h3>
              <p className="empty-state-subtitle">{t('dashboard.emptyHint', 'Listings from donors and organizations will appear here as soon as they are posted.')}</p>
            </div>
          ) : isFilteredEmpty ? (
            <div className="empty-state empty-state--rich">
              <span className="material-symbols-outlined empty-state-icon">search_off</span>
              <h3 className="empty-state-title">{t('dashboard.emptySearchTitle', 'No matching listings')}</h3>
              <p className="empty-state-subtitle">{t('dashboard.emptySearchHint', 'Try another search term or clear the active category and status filters.')}</p>
              <button type="button" className="empty-state-action" onClick={clearFilters}>
                {t('feed.clearFilters', 'Clear filters')}
              </button>
            </div>
          ) : (
            filteredListings.map(listing => {
              const viewState = getListingViewState(listing, orgCode)
              const isOwnOrgListing = viewState === 'posted'
              const isClaimedByCurrentOrg = viewState === 'claimed'
              const bestBefore = formatBestBeforeLabel(listing.expiryDate, i18n.language === 'zh' ? 'zh-CN' : 'en-AU')
              const dietaryTags = Array.isArray(listing.dietary_tags) ? listing.dietary_tags : []
              return (
              <article key={listing.id} className={`food-card org-card org-card--${viewState} ${isOwnOrgListing ? 'org-card--own' : ''} ${isClaimedByCurrentOrg ? 'food-card--claimed org-card--claimed' : ''} ${viewState === 'available' ? 'org-card--available' : ''}`.trim()}>
                {listing.photoUrl ? <img className="food-card-image" src={listing.photoUrl} alt={listing.foodType} /> : null}

                <div className="food-card-header org-card-header">
                  <div className="org-card-heading-stack">
                    <h3 className="food-card-title org-card-title">{listing.foodType}</h3>
                    <div className="org-card-meta-row">
                      <p className="food-card-source org-card-source">
                        {formatSourceLabel(listing, orgCode, t)}
                      </p>
                      <span className="listing-time org-card-time">{getRelativeTime(listing.createdAt, t)}</span>
                    </div>
                    <div className="org-card-category-row">
                      <span className="food-card-category org-card-category">
                        {getTranslatedCategory(listing.category, listing.foodType, t)}
                      </span>
                    </div>
                  </div>
                </div>

                {isClaimedByCurrentOrg && !isOwnOrgListing && (
                  <div className="listing-status-pill listing-status-pill--claimed">
                    {t('dashboard.statusPills.claimed', { quantity: Number.isInteger(Number(listing.quantity)) ? Number(listing.quantity) : listing.quantity })}
                  </div>
                )}

                {viewState === 'available' && (
                  <div className="listing-status-pill listing-status-pill--available">{t('dashboard.statusPills.available')}</div>
                )}

                <div className="food-card-details org-card-details">
                  <div className="food-card-detail-row org-card-detail-row">
                    <span className="material-symbols-outlined">inventory_2</span>
                    <span>{t('listing.approxQuantity', { quantity: listing.quantity, unit: t(`listing.units.${listing.unit}`, listing.unit) })}</span>
                  </div>
                  {listing.sizeCue ? (
                    <div className="food-card-detail-row org-card-detail-row">
                      <span className="material-symbols-outlined">straighten</span>
                      <span>{listing.sizeCue}</span>
                    </div>
                  ) : null}
                  <div className="food-card-detail-row org-card-detail-row">
                    <span className="material-symbols-outlined">location_on</span>
                    <span>{t('listing.postcode')} {listing.postcode}</span>
                  </div>
                  {bestBefore ? (
                    <div className="food-card-detail-row org-card-detail-row">
                      <span className="material-symbols-outlined">schedule</span>
                      <span>{t('listing.bestBefore', 'Best before')} {bestBefore}</span>
                    </div>
                  ) : null}
                </div>

                {(listing.description || dietaryTags.length > 0) ? (
                  <div className="card-supporting-stack org-supporting-stack">
                    {dietaryTags.length > 0 && (
                      <div className="supporting-panel org-dietary-panel">
                        <strong className="supporting-panel-label">{t('donation.dietary', 'Dietary tag')}</strong>
                        <div className="tags-row org-tag-row supporting-tag-list">
                          {dietaryTags.map((tag, i) => (
                            <span key={i} className="tag-chip">{t(`listing.dietary.${resolveDietaryTranslationKey(tag)}`, tag)}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {listing.description ? (
                      <div className="org-extra-notes supporting-panel">
                        <strong className="supporting-panel-label">{t('donation.extraNotes', 'Extra notes')}</strong>
                        <p>{listing.description}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {isOwnOrgListing ? (
                  <div className="food-card-actions donor-card-actions">
                    <button
                      className="card-action-btn primary"
                      onClick={() => handleEditListing(listing)}
                      disabled={removingId === listing.id}
                      type="button"
                    >
                      {t('donation.actions.editListing', 'Edit this listing')}
                    </button>
                    <button
                      className="card-action-btn"
                      onClick={() => handleRemoveListing(listing)}
                      disabled={removingId === listing.id}
                      type="button"
                    >
                      {removingId === listing.id ? 'Removing...' : t('donation.actions.removeListing', 'Remove this listing')}
                    </button>
                  </div>
                ) : isClaimedByCurrentOrg ? (
                  <div className="food-card-actions donor-card-actions">
                    <button
                      className="card-action-btn primary"
                      onClick={() => handlePickupConfirm(listing.id)}
                      disabled={pickingUpId === listing.id || removingId === listing.id}
                      type="button"
                    >
                      {pickingUpId === listing.id ? 'Confirming...' : '✓ Confirm pickup'}
                    </button>
                    <button
                      className="card-action-btn claim-btn--remove"
                      onClick={() => handleRemoveClaim(listing.id)}
                      disabled={removingId === listing.id || pickingUpId === listing.id}
                      type="button"
                    >
                      {removingId === listing.id ? 'Removing...' : 'Remove claim'}
                    </button>
                  </div>
                ) : (
                  <button
                    className="card-action-btn primary"
                    onClick={() => openClaimDialog(listing)}
                    disabled={claimingId === listing.id}
                    type="button"
                  >
                    {claimingId === listing.id ? t('listing.claimingButton') : t('listing.claimThisButton')} →
                  </button>
                )}
              </article>
            )})
          )}
        </div>

        {claimDialogListing ? (
          <div className="claim-dialog-backdrop" onClick={closeClaimDialog}>
            <div className="claim-dialog" onClick={(event) => event.stopPropagation()}>
              <div className="claim-dialog-header">
                <h2>{t('dashboard.claimDialog.title')}</h2>
                <button type="button" className="claim-dialog-close" onClick={closeClaimDialog}>×</button>
              </div>
              <p className="claim-dialog-subtitle">
                {t('dashboard.claimDialog.available', {
                  quantity: formatQuantityValue(claimDialogListing.quantity),
                  unit: t(`listing.units.${claimDialogListing.unit || 'portions'}`, claimDialogListing.unit || 'portions'),
                })}
              </p>
              <div className="claim-dialog-card">
                <strong>{claimDialogListing.foodType}</strong>
                <span>{formatSourceLabel(claimDialogListing, orgCode, t)}</span>
              </div>
              <div className="claim-quantity-control">
                <button
                  type="button"
                  className="claim-step-btn"
                  onClick={() => handleClaimQuantityAdjust(-1)}
                  disabled={claimingId === claimDialogListing.id}
                >
                  −
                </button>
                <input
                  type="text"
                  inputMode="decimal"
                  className="claim-quantity-input"
                  value={claimQuantity}
                  onChange={(event) => {
                    setClaimQuantity(event.target.value.replace(/[^0-9.]/g, ''))
                    if (claimError) setClaimError('')
                  }}
                />
                <button
                  type="button"
                  className="claim-step-btn"
                  onClick={() => handleClaimQuantityAdjust(1)}
                  disabled={claimingId === claimDialogListing.id}
                >
                  +
                </button>
              </div>
              <div className="claim-dialog-actions">
                <button type="button" className="claim-all-btn" onClick={handleClaimAll} disabled={claimingId === claimDialogListing.id}>
                  {t('dashboard.claimDialog.claimAll')}
                </button>
              </div>
              {claimError ? <div className="alert alert-error claim-dialog-error">{claimError}</div> : null}
              <div className="claim-dialog-footer">
                <button type="button" className="card-action-btn" onClick={closeClaimDialog} disabled={claimingId === claimDialogListing.id}>
                  {t('common.cancel', 'Cancel')}
                </button>
                <button type="button" className="card-action-btn primary" onClick={submitClaimQuantity} disabled={claimingId === claimDialogListing.id}>
                  {claimingId === claimDialogListing.id ? t('listing.claimingButton') : t('dashboard.claimDialog.confirm')}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}

export default LiveListingBoard
