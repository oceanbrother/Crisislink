import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAvailableListings, claimListing, getClaimedListings } from '../services/api'
import ChatModal from '../components/ChatModal'
import '../styles/LiveListingBoard.css'

const categoryOptions = ['All', 'Bakery', 'Produce', 'Prepared', 'Grocery']

const inferCategory = (foodType = '') => {
  const value = foodType.toLowerCase()
  if (value.includes('bread') || value.includes('pastry') || value.includes('bakery')) return 'Bakery'
  if (value.includes('vegetable') || value.includes('fruit') || value.includes('produce')) return 'Produce'
  if (value.includes('pizza') || value.includes('pasta') || value.includes('meal') || value.includes('prepared')) return 'Prepared'
  return 'Grocery'
}

const getCategoryEmoji = (category) => {
  const map = { Bakery: '🥐', Produce: '🥕', Prepared: '🍜', Grocery: '🛒' }
  return map[category] || '📦'
}

const getTranslatedCategory = (category, t) => {
  const map = {
    All:      t('dashboard.tabs.all'),
    Bakery:   t('dashboard.tabs.bakery'),
    Produce:  t('dashboard.tabs.produce'),
    Prepared: t('dashboard.tabs.prepared'),
    Grocery:  t('dashboard.tabs.grocery'),
  }
  return map[category] || category
}

const getRelativeTime = (createdAt, t) => {
  if (!createdAt) return t('listing.justNow')
  const created = new Date(createdAt)
  const diff    = Date.now() - created.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours   = Math.floor(diff / 3600000)
  const days    = Math.floor(diff / 86400000)
  if (minutes < 1)  return t('listing.justNow')
  if (minutes < 60) return t('listing.minutesAgo', { count: minutes })
  if (hours < 24)   return t('listing.hoursAgo',   { count: hours })
  return t('listing.daysAgo', { count: days })
}

const LiveListingBoard = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { t }    = useTranslation()

  const orgCode = location.state?.orgCode || 'HCFB-2841'
  const postcode = location.state?.postcode || '3000'

  // ── Available listings state ───────────────────────────────────
  const [listings,         setListings]         = useState([])
  const [filteredListings, setFilteredListings] = useState([])
  const [loading,          setLoading]          = useState(true)
  const [claimingId,       setClaimingId]       = useState(null)
  const [error,            setError]            = useState('')
  const [success,          setSuccess]          = useState('')
  const [searchTerm,       setSearchTerm]       = useState('')
  const [filterCategory,   setFilterCategory]   = useState('All')

  // ── My Claims state ────────────────────────────────────────────
  const [claimedListings, setClaimedListings] = useState([])
  const [claimsLoading,   setClaimsLoading]   = useState(true)

  // ── Chat modal state ───────────────────────────────────────────
  const [chatListing, setChatListing] = useState(null)
  // null | { id, foodType }

  // ── Load data on mount ─────────────────────────────────────────
  useEffect(() => {
    loadListings()
    loadClaimedListings()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    filterAndDisplayListings()
  }, [listings, searchTerm, filterCategory]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadListings = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getAvailableListings({ postcode, status: 'available' })
      const formatted = data.map(listing => ({
        ...listing,
        category: inferCategory(listing.foodType),
        emoji:    getCategoryEmoji(inferCategory(listing.foodType)),
      }))
      setListings(formatted)
    } catch {
      setError(t('feed.noListings'))
      setListings([])
    } finally {
      setLoading(false)
    }
  }

  const loadClaimedListings = async () => {
    setClaimsLoading(true)
    try {
      const data = await getClaimedListings(orgCode)
      setClaimedListings(data)
    } catch {
      setClaimedListings([])
    } finally {
      setClaimsLoading(false)
    }
  }

  const filterAndDisplayListings = () => {
    let filtered = listings
    if (filterCategory !== 'All' && filterCategory !== t('dashboard.tabs.all')) {
      const englishCategory = Object.keys(categoryOptions).find(
        key => getTranslatedCategory(categoryOptions[key], t) === filterCategory
      ) || filterCategory
      filtered = filtered.filter(l => l.category === englishCategory)
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(l =>
        l.foodType.toLowerCase().includes(term) ||
        (l.description || '').toLowerCase().includes(term) ||
        (l.orgCode || '').toLowerCase().includes(term)
      )
    }
    setFilteredListings(filtered)
  }

  // ── Claim a listing ────────────────────────────────────────────
  const handleClaim = async (listingId) => {
    setClaimingId(listingId)
    setError('')
    setSuccess('')
    try {
      await claimListing(listingId, { orgId: orgCode })
      setSuccess(t('feed.claimButton'))
      setTimeout(() => {
        setSuccess('')
        loadListings()
        loadClaimedListings()
      }, 1500)
    } catch {
      setError(t('feed.noListings'))
      setTimeout(() => setError(''), 3000)
    } finally {
      setClaimingId(null)
    }
  }

  // ── Chat modal handlers ────────────────────────────────────────
  const openChat = (listing) => setChatListing(listing)
  const closeChat = () => setChatListing(null)

  const handleFoodCollected = (listingId) => {
    // Remove the collected listing from My Claims without reloading
    setClaimedListings(prev => prev.filter(l => l.id !== listingId))
  }

  const handlePostExcess = () => {
    navigate('/form', {
      state: { orgMode: true, orgCode, orgName: `Organization ${orgCode}`, postcode },
    })
  }

  return (
    <div className="live-listing-board">
      <header className="board-header">
        <button onClick={() => navigate('/')} className="back-btn">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>

        <div className="header-info">
          <h1 className="board-title">
            <span className="material-symbols-outlined">inventory_2</span>
            {t('dashboard.title')}
          </h1>
          <p className="org-code-display">Code: {orgCode} | Postcode: {postcode}</p>
        </div>

        <button className="post-excess-btn" onClick={handlePostExcess} title={t('dashboard.shareButton')}>
          <span className="material-symbols-outlined">add</span>
          {t('dashboard.shareButton')}
        </button>
      </header>

      <div className="board-container">

        {/* ── My Active Claims ─────────────────────────────────── */}
        {(claimedListings.length > 0 || claimsLoading) && (
          <section className="my-claims-section">
            <h2 className="my-claims-title">
              <span className="material-symbols-outlined">inventory</span>
              My Active Claims
              {claimedListings.length > 0 && (
                <span className="claims-badge">{claimedListings.length}</span>
              )}
            </h2>

            {claimsLoading ? (
              <p className="claims-loading">{t('common.loading')}</p>
            ) : (
              <div className="claims-list">
                {claimedListings.map(listing => (
                  <div key={listing.id} className="claim-card">
                    <div className="claim-card-info">
                      <span className="claim-card-emoji">
                        {getCategoryEmoji(inferCategory(listing.foodType))}
                      </span>
                      <div>
                        <p className="claim-card-food">{listing.foodType}</p>
                        <p className="claim-card-meta">
                          {listing.quantity} {listing.unit} · from {listing.orgCode}
                        </p>
                        <p className="claim-card-time">
                          Claimed {getRelativeTime(listing.claimedAt, t)}
                        </p>
                      </div>
                    </div>
                    <div className="claim-card-actions">
                      <button
                        className="chat-open-btn"
                        onClick={() => openChat(listing)}
                      >
                        <span className="material-symbols-outlined">forum</span>
                        Chat
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Search & Filter Bar ──────────────────────────────── */}
        <div className="search-filter-bar">
          <input
            type="text"
            placeholder={t('feed.search')}
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <div className="filter-tabs">
            {categoryOptions.map(cat => (
              <button
                key={cat}
                className={`filter-tab ${filterCategory === cat ? 'active' : ''}`}
                onClick={() => setFilterCategory(cat)}
              >
                {getTranslatedCategory(cat, t)}
              </button>
            ))}
          </div>
        </div>

        {/* ── Status Messages ──────────────────────────────────── */}
        {error   && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {/* ── Listings Count ────────────────────────────────────── */}
        <div className="listings-info">
          <p className="listings-count">
            {t('listing.itemsAvailable', { count: filteredListings.length })}
          </p>
        </div>

        {/* ── Available Listings Grid ───────────────────────────── */}
        <div className="listings-grid">
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
            filteredListings.map(listing => (
              <div key={listing.id} className="listing-card">
                <div className="listing-header">
                  <span className="listing-emoji">{listing.emoji}</span>
                  <div className="listing-meta">
                    <h3 className="listing-food">{listing.foodType}</h3>
                    <p className="listing-donor">{t('listing.from')}: {listing.orgCode || 'Community'}</p>
                  </div>
                  <span className="listing-time">{getRelativeTime(listing.createdAt, t)}</span>
                </div>

                <div className="listing-details">
                  <div className="detail-item">
                    <span className="material-symbols-outlined">straighten</span>
                    <span>{listing.quantity} {listing.unit}</span>
                  </div>
                  <div className="detail-item">
                    <span className="material-symbols-outlined">location_on</span>
                    <span>{t('listing.postcode')} {listing.postcode}</span>
                  </div>
                </div>

                {listing.description && (
                  <p className="listing-description">{listing.description}</p>
                )}

                {listing.dietary_tags && listing.dietary_tags.length > 0 && (
                  <div className="listing-tags">
                    {listing.dietary_tags.map((tag, i) => (
                      <span key={i} className="tag">{tag}</span>
                    ))}
                  </div>
                )}

                <button
                  className="claim-btn"
                  onClick={() => handleClaim(listing.id)}
                  disabled={claimingId === listing.id}
                >
                  {claimingId === listing.id ? t('listing.claimingButton') : t('listing.claimThisButton')} →
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Chat Modal ──────────────────────────────────────────── */}
      {chatListing && (
        <ChatModal
          listingId={chatListing.id}
          listingTitle={chatListing.foodType}
          myOrgCode={orgCode}
          onClose={closeChat}
          onFoodCollected={handleFoodCollected}
        />
      )}
    </div>
  )
}

export default LiveListingBoard
