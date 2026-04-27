import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { deleteListing, getAvailableListings } from '../services/api'
import { FILTER_OPTIONS, formatBestBeforeLabel, resolveListingCategory } from '../constants/listings'
import DonorFeatureNav from '../components/DonorFeatureNav'
import { forgetDonorListing, getOrCreateDonorCode, isRememberedDonorListing } from '../utils/donorIdentity'
import { resolveImageUrl } from '../utils/imageUrl'
import { getSavedDonorPostcode, saveDonorPostcode } from '../utils/donorPostcode'
import '../styles/PostFeedPage.css'

function getDietaryClass(tag) {
  if (!tag) return ''
  return String(tag).toLowerCase().replace(/\s+/g, '-')
}

function isLegacyDonorListing(listing, currentPostcode) {
  const listingOrgCode = String(listing?.orgCode || '').trim().toUpperCase()
  const postcode = String(currentPostcode || '').trim()
  return postcode !== '' && listingOrgCode === ('DONOR-' + postcode).toUpperCase()
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
  const [search, setSearch] = useState('')
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
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
      const ownListing =
        listing.orgCode === donorCode ||
        isRememberedDonorListing(listing.id) ||
        isLegacyDonorListing(listing, postcode)

      if (!ownListing) return false

      const matchesFilter = activeFilter === 'All' || category === activeFilter
      if (!matchesFilter) return false

      return matchesSearchFields(getSearchableFields(listing, term), term)
    })
  }, [activeFilter, donorCode, listings, postcode, search])

  const hasActiveSearch = search.trim() !== ''
  const hasActiveFilter = activeFilter !== 'All'
  const hasActiveControls = hasActiveSearch || hasActiveFilter
  const isBaseEmpty = listings.length === 0
  const isFilteredEmpty = !loading && !isBaseEmpty && filteredListings.length === 0

  const clearFilters = () => {
    setSearch('')
    setActiveFilter('All')
  }

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang)
    localStorage.setItem('preferredLanguage', lang)
    setShowLanguageMenu(false)
  }

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
      <header className="navbar donor-navbar">
        <div className="navbar-inner donor-navbar-inner">
          <button
            className="brand-home-btn"
            type="button"
            onClick={() => navigate('/donor', { state: { postcode } })}
          >
            <span className="brand-home-title">{t('appName')}</span>
          </button>

          <div className="nav-actions donor-nav-actions">
            <div className="language-btn-wrapper">
              <button className="nav-icon-btn" type="button" onClick={() => setShowLanguageMenu((prev) => !prev)}>
                <span className="material-symbols-outlined">language</span>
              </button>
              {showLanguageMenu ? (
                <div className="language-menu">
                  <button type="button" onClick={() => handleLanguageChange('en')}>English</button>
                  <button type="button" onClick={() => handleLanguageChange('zh')}>中文</button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="navbar-divider" />
      </header>

      <main className="feed-content donor-feed-content">
        <div className="donor-area-nav-row">
          <DonorFeatureNav active="listings" postcode={postcode} />
        </div>

        <section className="donor-page-intro donor-page-intro--listings">
          <div className="donor-page-heading">
            <h1 className="board-title donor-page-title">{t('feed.pageTitle', 'Your donor listings')}</h1>
            <div
              className="donor-page-location-card donor-page-location-card--compact"
              role="group"
              aria-label={t('listing.postcode', 'Postcode')}
            >
              <div className="donor-page-location-badge">
                <span className="material-symbols-outlined donor-page-location-icon">location_on</span>
              </div>
              <div className="donor-page-location-copy">
                <span className="donor-page-location-label">{t('listing.postcode', 'Postcode')}</span>
                <span className="donor-page-location-value">{postcode || 'Saved on next post'}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="filter-section donor-filter-section">
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
          <div className="filter-chips donor-filter-chips">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={activeFilter === option.value ? 'filter-chip active' : 'filter-chip'}
                onClick={() => setActiveFilter(option.value)}
              >
                {t('dashboard.tabs.' + option.key, option.value)}
              </button>
            ))}
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
        </section>

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
              const ownListing =
                listing.orgCode === donorCode ||
                isRememberedDonorListing(listing.id) ||
                isLegacyDonorListing(listing, postcode)
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
