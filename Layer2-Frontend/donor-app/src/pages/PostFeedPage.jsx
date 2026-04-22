import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { deleteListing, getAvailableListings } from '../services/api'
import { FILTER_OPTIONS, formatBestBeforeLabel, normalizeCategory } from '../constants/listings'
import { forgetDonorListing, getOrCreateDonorCode, isRememberedDonorListing } from '../utils/donorIdentity'
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

const PostFeedPage = () => {
  const { postcode } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()

  const [activeFilter, setActiveFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)

  const donorCode = useMemo(() => getOrCreateDonorCode(), [])

  const fetchListings = async () => {
    try {
      setLoading(true)
      const data = await getAvailableListings({ postcode, status: 'available' })
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
    fetchListings()
  }, [postcode])

  const filteredListings = useMemo(() => {
    const term = search.trim().toLowerCase()
    return listings.filter((listing) => {
      const category = normalizeCategory(listing.category || listing.foodType)
      const ownListing =
        listing.orgCode === donorCode ||
        isRememberedDonorListing(listing.id) ||
        isLegacyDonorListing(listing, postcode)

      if (!ownListing) return false

      const matchesFilter = activeFilter === 'All' || category === activeFilter
      if (!matchesFilter) return false

      if (term === '') return true
      const haystacks = [listing.foodType, listing.category, listing.description, listing.sizeCue]
      return haystacks.some((value) => String(value || '').toLowerCase().includes(term))
    })
  }, [activeFilter, listings, search])

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang)
    localStorage.setItem('preferredLanguage', lang)
    setShowLanguageMenu(false)
  }

  const handleEdit = (listing) => {
    navigate('/form/' + listing.postcode, {
      state: {
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

  return (
    <div className="post-feed-page donor-role-page">
      <header className="navbar donor-navbar">
        <div className="navbar-inner donor-navbar-inner">
          <button className="brand-home-btn" type="button" onClick={() => navigate('/')}>
            <span className="brand-home-title">{t('appName')}</span>
          </button>

          <div className="nav-actions donor-nav-actions">
            <button className="post-action-btn" type="button" onClick={() => navigate('/form/' + postcode)}>
              <span className="material-symbols-outlined">add</span>
              {t('feed.shareButton', 'Post surplus')}
            </button>
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
        <section className="donor-page-intro">
          <div className="donor-page-heading">
            <h1 className="board-title donor-page-title">{t('feed.pageTitle', 'Your donor listings')}</h1>
            <div className="donor-page-meta">
              <span className="material-symbols-outlined">location_on</span>
              <span>{t('listing.postcode', 'Postcode')} {postcode}</span>
            </div>
          </div>
        </section>

        <section className="filter-section donor-filter-section">
          <div className="search-wrapper donor-search-wrapper">
            <span className="material-symbols-outlined search-icon">search</span>
            <input
              className="search-input"
              type="text"
              placeholder={t('feed.search', 'Search listings')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
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
          <div className="feed-meta-row">
            <span className="feed-count">{t('listing.itemsAvailable', { count: filteredListings.length })}</span>
          </div>
        </section>

        {error ? <div className="error-message board-error">{error}</div> : null}

        {loading ? (
          <div className="empty-state"><p>{t('common.loading')}</p></div>
        ) : filteredListings.length === 0 ? (
          <div className="empty-state">
            <p>{t('feed.noListings', 'No listings available in your area yet')}</p>
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
              const category = normalizeCategory(listing.category || listing.foodType)
              const categoryOption = FILTER_OPTIONS.find((option) => option.value === category)

              return (
                <article key={listing.id} className={ownListing ? 'food-card own-listing-card donor-card' : 'food-card donor-card'}>
                  {listing.photoUrl ? <img className="food-card-image" src={listing.photoUrl} alt={listing.foodType} /> : null}

                  <div className="food-card-header donor-card-header">
                    <div>
                      <h3 className="food-card-title donor-card-title">{listing.foodType}</h3>
                      <p className="food-card-source donor-card-source">
                        {ownListing
                          ? t('feed.postedByYou', 'Posted by you')
                          : t('feed.availableForGroups', 'Available to community groups')}
                      </p>
                    </div>
                    <span className="food-card-category donor-card-category">
                      {t('dashboard.tabs.' + (categoryOption?.key || 'other'), category)}
                    </span>
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

                  {dietaryTag ? (
                    <div className="tags-row tags-row-spaced donor-tag-row">
                      <span className={'tag-chip tag-' + getDietaryClass(dietaryTag)}>
                        {t('listing.dietary.' + getDietaryClass(dietaryTag), dietaryTag)}
                      </span>
                    </div>
                  ) : null}

                  {listing.description ? (
                    <div className="donor-extra-notes">
                      <strong>{t('donation.extraNotes', 'Extra notes')}</strong>
                      <p>{listing.description}</p>
                    </div>
                  ) : null}

                  <div className="food-card-actions donor-card-actions">
                    {ownListing ? (
                      <>
                        <button type="button" className="card-action-btn primary" onClick={() => handleEdit(listing)}>
                          {t('donation.actions.editListing', 'Edit this listing')}
                        </button>
                        <button type="button" className="card-action-btn" onClick={() => handleRemove(listing)}>
                          {t('donation.actions.removeListing', 'Remove this listing')}
                        </button>
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
