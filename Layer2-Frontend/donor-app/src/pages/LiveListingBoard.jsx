import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../api'
import LanguageSwitcher from '../components/LanguageSwitcher'
import '../styles/LiveListingBoard.css'

const LiveListingBoard = () => {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch listings from API on component mount
  useEffect(() => {
    const fetchListings = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await api.get('/listings')
        
        if (response.data && Array.isArray(response.data)) {
          // Transform API data to display format
          const transformedListings = response.data.map((item, index) => {
            const listing = item.listing || item  // Handle both wrapped and unwrapped formats
            const distanceKm = item.distance_km
            
            return {
              id: listing.id || index + 1,
              emoji: listing.food?.emoji || '📦',
              title: listing.description?.en || listing.source_name || 'Food Listing',
              source: listing.source_name || 'Unknown Donor',
              category: listing.food?.category || 'grocery',
              categoryKey: listing.food?.category || 'grocery',
              quantity: listing.food?.quantity || 'N/A',
              distance: distanceKm ? `${distanceKm} km` : '0.5 km',
              matchScore: listing.matching_metrics?.match_score || 85,
              tags: listing.food?.tags || [],
              time: 'Just now',
              description: listing.description?.en || 'Food donation',
              pickupTime: 'Anytime',
              allergens: listing.food?.allergens || 'Check details',
              posted_at: listing.posted_at,
              translations: {
                'zh-CN': {
                  title: listing.description?.zh_CN || listing.description?.en || 'Food Listing',
                  quantity: listing.food?.quantity || 'N/A',
                  tags: listing.food?.tags || [],
                  time: 'Just now',
                  description: listing.description?.zh_CN || listing.description?.en || 'Food donation',
                  pickupTime: 'Anytime',
                  allergens: listing.food?.allergens || 'Check details'
                },
                vi: {
                  title: listing.description?.vi || listing.description?.en || 'Food Listing',
                  quantity: listing.food?.quantity || 'N/A',
                  tags: listing.food?.tags || [],
                  time: 'Just now',
                  description: listing.description?.vi || listing.description?.en || 'Food donation',
                  pickupTime: 'Anytime',
                  allergens: listing.food?.allergens || 'Check details'
                }
              }
            }
          })
          
          setListings(transformedListings)
        }
      } catch (err) {
        console.error('Failed to fetch listings:', err)
        setError('Failed to load food listings')
      } finally {
        setLoading(false)
      }
    }

    fetchListings()
    
    // Poll for new listings every 5 seconds
    const interval = setInterval(fetchListings, 5000)
    return () => clearInterval(interval)
  }, [])

  const currentLanguage =
    i18n.language.startsWith('zh') ? 'zh-CN' :
    i18n.language.startsWith('vi') ? 'vi' :
    'en'

  const getLocalizedListing = (listing) => {
    const localized = listing.translations?.[currentLanguage]
    if (!localized) return listing

    return {
      ...listing,
      ...localized
    }
  }

  const [filteredListings, setFilteredListings] = useState(listings)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('All')
  const [sortBy, setSortBy] = useState('recent')
  const [selectedListing, setSelectedListing] = useState(null)
  const [claimedListings, setClaimedListings] = useState(new Set())
  const wsRef = useRef(null)

  // Filter and sort logic
  useEffect(() => {
    let results = listings.filter(listing => {
      const matchesSearch = 
        listing.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        listing.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
        listing.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const matchesFilter = filterType === 'All' || listing.category === filterType
      
      return matchesSearch && matchesFilter
    })

    if (sortBy === 'recent') {
      const timeOrder = { 'Just now': 0, '8 min ago': 1, '15 min ago': 2, '22 min ago': 3, '45 min ago': 4 }
      results.sort((a, b) => (timeOrder[a.time] || 99) - (timeOrder[b.time] || 99))
    } else if (sortBy === 'match') {
      results.sort((a, b) => b.matchScore - a.matchScore)
    } else if (sortBy === 'distance') {
      results.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance))
    }

    setFilteredListings(results)
  }, [searchTerm, filterType, sortBy, listings])

  // WebSocket placeholder
  useEffect(() => {
    // TODO: Connect to real WebSocket when backend ready
    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close()
      }
    }
  }, [])

  const handleClaim = (listingId) => {
    setClaimedListings(prev => new Set([...prev, listingId]))
    setTimeout(() => {
      setClaimedListings(prev => {
        const newSet = new Set(prev)
        newSet.delete(listingId)
        return newSet
      })
      setSelectedListing(null)
    }, 1000)
  }

  return (
    <div className="live-listing-board">
      {/* Loading State */}
      {loading && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
          fontSize: '18px'
        }}>
          ⏳ Loading food listings...
        </div>
      )}

      {/* Error State */}
      {error && (
        <div style={{
          padding: '16px',
          marginBlock: '16px',
          backgroundColor: '#fee',
          color: '#c00',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      {/* Normal Content */}
      {!loading && (
      <div className="live-listing-board-content">
      {/* Header */}
      <header className="board-header">
        <button 
          onClick={() => navigate('/')}
          className="back-button"
        >
          ←
        </button>
        <div className="header-content">
          <div className="header-top">
            <div className="header-left">
              <div className="header-title">
                <span className="logo">🥬</span>
                <span className="title-text">{t('common.appName')}</span>
              </div>
            </div>
            <div className="header-actions">
              <LanguageSwitcher />
              <button className="notification-btn">🔔</button>
            </div>
          </div>
          <div className="org-info">
            <h2 className="org-name">Harvest City Food Bank</h2>
            <p className="org-user">Sarah - Coordinator</p>
          </div>
          <div className="org-stats">
            <div className="stat-item">
              <span className="stat-value">3</span>
              <span className="stat-label">{t('listing.available')}</span>
            </div>
            <div className="stat-divider">|</div>
            <div className="stat-item">
              <span className="stat-value">1</span>
              <span className="stat-label">{t('listing.claimed')}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Smart Match Alert */}
      <div className="smart-match-alert">
        <span className="alert-icon">💡</span>
        <div className="alert-content">
          <strong>{t('listingBoard.smartMatch')}</strong>
          <span className="alert-desc">{t('listingBoard.smartMatchDesc')}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="board-content">
        {/* Search Bar */}
        <div className="search-section">
          <input
            type="text"
            placeholder={`🔍 ${t('listingBoard.searchPlaceholder')}`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        {/* Filter Buttons */}
        <div className="filter-section">
          {['All', 'Bakery', 'Produce', 'Prepared', 'Grocery'].map(category => (
            <button
              key={category}
              onClick={() => setFilterType(category)}
              className={`filter-btn ${filterType === category ? 'active' : ''}`}
            >
              {category === 'All' && t('listingBoard.filters.all')}
              {category === 'Bakery' && t('listingBoard.filters.bakery')}
              {category === 'Produce' && t('listingBoard.filters.produce')}
              {category === 'Prepared' && t('listingBoard.filters.prepared')}
              {category === 'Grocery' && t('listingBoard.filters.grocery')}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <div className="sort-section">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-dropdown"
          >
            <option value="recent">📍 {t('listingBoard.sortOptions.recent')}</option>
            <option value="match">⭐ {t('listingBoard.sortOptions.match')}</option>
            <option value="distance">📏 {t('listingBoard.sortOptions.distance')}</option>
          </select>
        </div>

        {/* Listings Grid */}
        {filteredListings.length === 0 ? (
          <div className="empty-state">
            <p>{t('feed.noListings')}</p>
            <small>{t('feed.tryAdjust')}</small>
          </div>
        ) : (
          <div className="listings-grid">
            {filteredListings.map(listing => {
              const localizedListing = getLocalizedListing(listing)

              return (
              <div
                key={listing.id}
                className={`listing-card ${claimedListings.has(listing.id) ? 'claimed' : ''}`}
                onClick={() => !claimedListings.has(listing.id) && setSelectedListing(listing)}
              >
                {/* Image Section with Badges */}
                <div className="card-image">
                  <div className="image-placeholder">{listing.emoji}</div>
                  <div className="match-badge">
                    <span className="badge-icon">⭐</span>
                    <span className="badge-text">{listing.matchScore}% match</span>
                  </div>
                  {claimedListings.has(listing.id) && (
                    <div className="claimed-badge">
                      <span className="badge-icon">✓</span>
                      <span className="badge-text">{t('listing.claimed')}</span>
                    </div>
                  )}
                </div>

                {/* Card Content */}
                <div className="card-content">
                  <h3 className="card-title">{localizedListing.title}</h3>
                  <p className="card-source">{localizedListing.source}</p>

                  <div className="card-meta">
                    <span className="meta-item">
                      <span className="meta-icon">📦</span>
                      <span className="meta-text">{localizedListing.quantity}</span>
                    </span>
                    <span className="meta-item">
                      <span className="meta-icon">📍</span>
                      <span className="meta-text">{localizedListing.distance}</span>
                    </span>
                    <span className="meta-item">
                      <span className="meta-icon">⏱️</span>
                      <span className="meta-text">{localizedListing.time}</span>
                    </span>
                  </div>

                  <div className="card-tags">
                    {localizedListing.tags.map(tag => (
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                  </div>

                  {claimedListings.has(listing.id) && (
                    <div className="claimed-notice">{t('listing.pickupArrangement')}</div>
                  )}
                </div>
              </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
      )}

      {/* Detail Modal */}
      {selectedListing && (
        <div className="modal-overlay" onClick={() => setSelectedListing(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setSelectedListing(null)}
            >
              ✕
            </button>

            <div className="modal-header">
              <span className="modal-emoji">{selectedListing.emoji}</span>
              <h2 className="modal-title">{getLocalizedListing(selectedListing).title}</h2>
              <p className="modal-source">{getLocalizedListing(selectedListing).source}</p>
            </div>

            <div className="modal-details">
              <div className="detail-row">
                <span className="label">{t('listing.category')}</span>
                <span className="value">{t(`categories.${selectedListing.categoryKey}`)}</span>
              </div>
              <div className="detail-row">
                <span className="label">{t('listing.quantity')}</span>
                <span className="value">{getLocalizedListing(selectedListing).quantity}</span>
              </div>
              <div className="detail-row">
                <span className="label">{t('listing.distance')}</span>
                <span className="value">{selectedListing.distance}</span>
              </div>
              <div className="detail-row">
                <span className="label">{t('listing.pickupTime')}</span>
                <span className="value">{getLocalizedListing(selectedListing).pickupTime}</span>
              </div>
              <div className="detail-row">
                <span className="label">{t('listing.allergens')}</span>
                <span className="value">{getLocalizedListing(selectedListing).allergens}</span>
              </div>
            </div>

            <div className="modal-description">
              <p>{getLocalizedListing(selectedListing).description}</p>
            </div>

            <div className="match-score-section">
              <div className="score-label">{t('listing.matchScore')}</div>
              <div className="score-bar">
                <div
                  className="score-fill"
                  style={{ width: `${selectedListing.matchScore}%` }}
                ></div>
              </div>
              <div className="score-value">{selectedListing.matchScore}% {t('listingBoard.sortOptions.match')}</div>
            </div>

            <button
              className="claim-btn"
              onClick={() => handleClaim(selectedListing.id)}
            >
              ✓ {t('listingBoard.claimButton')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default LiveListingBoard
