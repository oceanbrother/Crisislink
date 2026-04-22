import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAvailableListings, claimListing, unclaimListing, deleteListing } from '../services/api'
import { FILTER_OPTIONS, formatBestBeforeLabel, normalizeCategory } from '../constants/listings'
import '../styles/LiveListingBoard.css'

const getTranslatedCategory = (category, t) => {
  const option = FILTER_OPTIONS.find((item) => item.value === category)
  return t(`dashboard.tabs.${option?.key || 'other'}`, category)
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

const getListingViewState = (listing, orgCode) => {
  const ownerCode = String(listing?.orgCode || '')
  const currentOrgCode = String(orgCode || '')
  const isOwnOrgListing = ownerCode !== '' && ownerCode === currentOrgCode
  const isClaimedByCurrentOrg = listing?.status === 'claimed' && listing?.claimedBy === orgCode

  if (isOwnOrgListing) return 'posted'
  if (isClaimedByCurrentOrg) return 'claimed'
  return 'available'
}

const VIEW_STATE_PRIORITY = {
  posted: 0,
  available: 1,
  claimed: 2,
}

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
  const [filterStatus, setFilterStatus] = useState('all')
  const [claimDialogListing, setClaimDialogListing] = useState(null)
  const [claimQuantity, setClaimQuantity] = useState('1')
  const [claimError, setClaimError] = useState('')

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
  }, [listings, searchTerm, filterCategory, filterStatus, orgCode])

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
        ...claimedData.filter(listing => (listing.claimedBy || '') === orgCode),
      ]
      const formatted = mergedData.map(listing => ({
        ...listing,
        category: normalizeCategory(listing.category || listing.foodType),
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
      filtered = filtered.filter(l => normalizeCategory(l.category || l.foodType) === filterCategory)
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((listing) => getListingViewState(listing, orgCode) === filterStatus)
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(l =>
        l.foodType.toLowerCase().includes(term) ||
        (l.description || '').toLowerCase().includes(term) ||
        (l.orgCode || '').toLowerCase().includes(term) ||
        (Array.isArray(l.dietary_tags) ? l.dietary_tags.join(' ') : '').toLowerCase().includes(term)
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
      setTimeout(() => {
        setSuccess('')
        loadListings()
      }, 1500)
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
      setTimeout(() => {
        setSuccess('')
        loadListings()
      }, 1500)
    } catch (err) {
      setError('Unable to remove this claim right now.')
      setTimeout(() => setError(''), 3000)
    } finally {
      setRemovingId(null)
    }
  }

  const handlePostExcess = () => {
    navigate('/form', {
      state: {
        orgMode: true,
        orgCode,
        orgName: `Organization ${orgCode}`,
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
        orgName: `Organization ${orgCode}`,
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
      setTimeout(() => {
        setSuccess('')
        loadListings()
      }, 1200)
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
      setTimeout(() => {
        setSuccess('')
        loadListings()
      }, 1200)
    } catch (err) {
      const detail = err?.response?.data?.detail
      setClaimError(typeof detail === 'string' ? detail : t('dashboard.claimDialog.failed'))
    } finally {
      setClaimingId(null)
    }
  }

  return (
    <div className="live-listing-board org-role-board">
      <header className="navbar org-navbar">
        <div className="navbar-inner org-navbar-inner">
          <button className="brand-home-btn org-brand-btn" type="button" onClick={() => navigate('/')}>
            <span className="brand-home-title">{t('appName')}</span>
          </button>

          <button className="post-action-btn" onClick={handlePostExcess} title={t('dashboard.shareButton')}>
            <span className="material-symbols-outlined">add</span>
            {t('dashboard.shareButton')}
          </button>
        </div>
        <div className="navbar-divider" />
      </header>

      <main className="feed-content org-feed-content">
        <section className="org-page-intro org-hero-card">
          <div className="org-page-heading">
            <h1 className="board-title org-page-title">{t('dashboard.title')}</h1>
            <div className="org-page-meta">
              <span>{t('dashboard.orgCodeLabel', 'Org code')}: {orgCode}</span>
            </div>
          </div>

          <div className="org-summary-grid">
            <div className="org-summary-card org-summary-card--all">
              <span className="org-summary-label">{t('dashboard.statusTabs.all')}</span>
              <strong>{listingSummary.total}</strong>
            </div>
            <div className="org-summary-card org-summary-card--available">
              <span className="org-summary-label">{t('dashboard.statusTabs.available')}</span>
              <strong>{listingSummary.available}</strong>
            </div>
            <div className="org-summary-card org-summary-card--posted">
              <span className="org-summary-label">{t('dashboard.statusTabs.posted')}</span>
              <strong>{listingSummary.posted}</strong>
            </div>
            <div className="org-summary-card org-summary-card--claimed">
              <span className="org-summary-label">{t('dashboard.statusTabs.claimed')}</span>
              <strong>{listingSummary.claimed}</strong>
            </div>
          </div>
        </section>

        <section className="filter-section org-filter-section org-filter-panel">
          <div className="search-wrapper org-search-wrapper">
            <span className="material-symbols-outlined search-icon">search</span>
            <input
              type="text"
              placeholder={t('feed.search')}
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-group filter-panel-group">
            <div className="filter-group-heading">
              <div className="filter-group-label">{t('dashboard.filterLabels.category')}</div>
              <p className="filter-group-help">{t('dashboard.filterLabels.allCategories')}</p>
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

          <div className="filter-group filter-panel-group filter-panel-group--status">
            <div className="filter-group-heading">
              <div className="filter-group-label">{t('dashboard.filterLabels.status')}</div>
              <p className="filter-group-help">{t(`dashboard.statusTabs.${filterStatus}`)}</p>
            </div>
            <div className="filter-chips org-status-chips">
            {[
              { value: 'all', key: 'all' },
              { value: 'available', key: 'available' },
              { value: 'posted', key: 'posted' },
              { value: 'claimed', key: 'claimed' },
            ].map((option) => (
              <button
                key={option.value}
                className={`filter-chip status-chip status-chip--${option.value} ${filterStatus === option.value ? 'active' : ''}`}
                onClick={() => setFilterStatus(option.value)}
                type="button"
              >
                {t(`dashboard.statusTabs.${option.key}`)}
              </button>
            ))}
            </div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div className="feed-meta-row">
            <span className="feed-count">{t('listing.itemsAvailable', { count: filteredListings.length })}</span>
          </div>
        </section>

        <div className="food-grid org-food-grid">
          {loading ? (
            <div className="loading-state">
              <p>{t('common.loading')}</p>
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="empty-state">
              <span className="material-symbols-outlined">inbox</span>
              <p>{t('feed.noListings')}</p>
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
                  <div>
                    <h3 className="food-card-title org-card-title">{listing.foodType}</h3>
                    <p className="food-card-source org-card-source">
                      {isOwnOrgListing
                        ? t('feed.postedByYou', 'Posted by you')
                        : `${t('dashboard.donorCodeLabel', 'Donor code')}: ${listing.orgCode || 'Community'}`}
                    </p>
                  </div>
                  <div className="org-card-side">
                    <span className="food-card-category org-card-category">
                      {getTranslatedCategory(listing.category, t)}
                    </span>
                    <span className="listing-time org-card-time">{getRelativeTime(listing.createdAt, t)}</span>
                  </div>
                </div>

                {isOwnOrgListing && (
                  <div className="listing-status-pill listing-status-pill--posted">{t('dashboard.statusPills.posted')}</div>
                )}

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

                {listing.description ? (
                  <div className="org-extra-notes">
                    <strong>{t('donation.extraNotes', 'Extra notes')}</strong>
                    <p>{listing.description}</p>
                  </div>
                ) : null}

                {dietaryTags.length > 0 && (
                  <div className="tags-row org-tag-row">
                    {dietaryTags.map((tag, i) => (
                      <span key={i} className="tag-chip">{t(`listing.dietary.${tag}`, tag)}</span>
                    ))}
                  </div>
                )}

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
                  <button
                    className="card-action-btn claim-btn--remove"
                    onClick={() => handleRemoveClaim(listing.id)}
                    disabled={removingId === listing.id}
                    type="button"
                  >
                    {removingId === listing.id ? 'Removing...' : 'Remove Claim'}
                  </button>
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
                {t('dashboard.claimDialog.available', { quantity: formatQuantityValue(claimDialogListing.quantity) })}
              </p>
              <div className="claim-dialog-card">
                <strong>{claimDialogListing.foodType}</strong>
                <span>{t('dashboard.donorCodeLabel', 'Donor code')}: {claimDialogListing.orgCode || 'Community'}</span>
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
                  type="number"
                  min="1"
                  max={maxClaimQuantity}
                  step="1"
                  className="claim-quantity-input"
                  value={claimQuantity}
                  onChange={(event) => {
                    setClaimQuantity(event.target.value)
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
