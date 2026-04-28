import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { deleteListing, getAvailableListings } from '../services/api'
import { DIETARY_FILTER_OPTIONS, FILTER_OPTIONS, formatBestBeforeLabel, resolveListingCategory } from '../constants/listings'
import DonorFeatureNav from '../components/DonorFeatureNav'
import WorkspaceContextCard from '../components/WorkspaceContextCard'
import WorkspaceFilterPanel from '../components/WorkspaceFilterPanel'
import WorkspaceHeader from '../components/WorkspaceHeader'
import WorkspaceSummaryCard from '../components/WorkspaceSummaryCard'
import { forgetDonorListing, getOrCreateDonorCode, isRememberedDonorListing } from '../utils/donorIdentity'
import { resolveImageUrl } from '../utils/imageUrl'
import { getSavedDonorPostcode, saveDonorPostcode } from '../utils/donorPostcode'
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
      const filters = { status: 'available' }
      if (postcode) {
        filters.postcode = postcode
      }
      const data = await getAvailableListings(filters)
      setListings(Array.isArray(data) ? data : [])
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

      const matchesFilter = activeFilter === 'All' || category === activeFilter
      if (!matchesFilter) return false

      const matchesFoodType = matchesDietaryFilter(listing.dietary_tags, activeFoodType)
      if (!matchesFoodType) return false

      return matchesSearchFields(getSearchableFields(listing, term), term)
    })
  }, [activeFilter, activeFoodType, donorCode, listings, postcode, search])

  const hasActiveSearch = search.trim() !== ''
  const hasActiveFilter = activeFilter !== 'All'
  const hasActiveFoodTypeFilter = activeFoodType !== 'all'
  const hasActiveControls = hasActiveSearch || hasActiveFilter || hasActiveFoodTypeFilter
  const isBaseEmpty = listings.length === 0
  const isFilteredEmpty = !loading && !isBaseEmpty && filteredListings.length === 0

  const clearFilters = () => {
    setSearch('')
    setActiveFilter('All')
    setActiveFoodType('all')
  }

  const donorSummary = useMemo(() => {
    return listings.reduce((acc, listing) => {
      if (!isOwnedDonorListing(listing, donorCode, postcode)) return acc
      acc.total += 1
      if (!listing.hasClaims) {
        acc.editable += 1
      }
      return acc
    }, { total: 0, editable: 0 })
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
            <div className="workspace-summary-metric">
              <span className="workspace-summary-metric__label">{t('dashboard.statusTabs.all', 'All listings')}</span>
              <strong className="workspace-summary-metric__value">{donorSummary.total}</strong>
            </div>
            <div className="workspace-summary-metric workspace-summary-metric--soft">
              <span className="workspace-summary-metric__label">{t('feed.editableListings', 'Editable listings')}</span>
              <strong className="workspace-summary-metric__value">{donorSummary.editable}</strong>
            </div>
          </div>
        </WorkspaceSummaryCard>

        <WorkspaceFilterPanel role="donor" className="filter-section workspace-listings-filters workspace-listings-filters--donor donor-filter-section">
          <div className={hasActiveSearch ? 'search-wrapper donor-search-wrapper donor-search-wrapper--active' : 'search-wrapper donor-search-wrapper'}>
            <span className="material-symbols-outlined search-icon">search</span>
            <input
              className={hasActiveSearch ? 'search-input search-input--active' : 'search-input'}
              type="text"
              placeholder={t('feed.search', 'Search listings')}
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
            <div className="filter-feedback-row" aria-live="polite">
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
              </div>
              <button type="button" className="filter-clear-btn" onClick={clearFilters}>
                {t('feed.clearFilters', 'Clear filters')}
              </button>
            </div>
          ) : (
            <p className="filter-feedback-hint">{t('feed.filterHint', 'Search by food name, notes, size, or postcode.')}</p>
          )}

          {isFilteredEmpty ? null : (
            <div className="feed-meta-row">
              <span className={hasActiveControls ? 'feed-count feed-count--filtered' : 'feed-count'}>
                {hasActiveControls
                  ? t('feed.showingMatches', { count: filteredListings.length, defaultValue: `Showing ${filteredListings.length} matching listings` })
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
              const bestBefore = formatBestBeforeLabel(listing.expiryDate, i18n.language === 'zh' ? 'zh-CN' : 'en-AU')
              const category = resolveListingCategory(listing.category, listing.foodType)
              const categoryOption = FILTER_OPTIONS.find((option) => option.value === category)
              const listingLocked = ownListing && listing.hasClaims
              const relativeTime = getRelativeTime(listing.createdAt, t)
              const imageUrl = resolveImageUrl(listing.photoUrl)
              const shouldShowImage = imageUrl && !brokenImageIds.includes(listing.id)

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
                    </div>
                  </div>

                  <div className="food-card-details donor-card-details">
                    <div className="food-card-detail-row donor-card-detail-row">
                      <span className="material-symbols-outlined">inventory_2</span>
                      <span>{t('listing.approxQuantity', { quantity: listing.quantity, unit: t('listing.units.portions', 'portions') })}</span>
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
                        <span>{t('listing.bestBefore', 'Best before')} {bestBefore}</span>
                      </div>
                    ) : null}
                  </div>

                  {(dietaryTag || listing.description) ? (
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

                      {listing.description ? (
                        <div className="donor-extra-notes supporting-panel">
                          <strong className="supporting-panel-label">{t('donation.extraNotes', 'Extra notes')}</strong>
                          <p>{listing.description}</p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="food-card-actions donor-card-actions">
                    {ownListing ? (
                      <>
                        <button
                          type="button"
                          className={listingLocked ? 'card-action-btn primary disabled' : 'card-action-btn primary'}
                          onClick={() => handleEdit(listing)}
                          disabled={listingLocked}
                          title={listingLocked ? t('feed.editLockedTooltip', 'This listing has already been claimed and can no longer be edited or removed.') : ''}
                        >
                          {t('donation.actions.editListing', 'Edit this listing')}
                        </button>
                        <button
                          type="button"
                          className={listingLocked ? 'card-action-btn disabled' : 'card-action-btn'}
                          onClick={() => handleRemove(listing)}
                          disabled={listingLocked}
                          title={listingLocked ? t('feed.editLockedTooltip', 'This listing has already been claimed and can no longer be edited or removed.') : ''}
                        >
                          {t('donation.actions.removeListing', 'Remove this listing')}
                        </button>
                        {listingLocked ? (
                          <div className="donor-edit-lock-note">
                            {t('feed.editLockedNote', 'A community group has already claimed part of this listing, so editing and removal are now locked.')}
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
