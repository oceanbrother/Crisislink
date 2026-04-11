import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { claimListing, getAvailableListings } from '../services/api'
import '../styles/LiveListingBoard.css'

const categoryOptions = ['All', 'Bakery', 'Produce', 'Prepared', 'Grocery']

const getRelativeTime = (createdAt) => {
  if (!createdAt) return 'Just now'

  const created = new Date(createdAt)
  const diffMinutes = Math.max(0, Math.round((Date.now() - created.getTime()) / 60000))

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes} min ago`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} hr ago`

  const diffDays = Math.round(diffHours / 24)
  return `${diffDays} day ago`
}

const inferCategory = (foodType = '') => {
  const value = foodType.toLowerCase()
  if (value.includes('bread') || value.includes('pastry') || value.includes('bakery')) return 'Bakery'
  if (value.includes('vegetable') || value.includes('fruit') || value.includes('produce')) return 'Produce'
  if (value.includes('pizza') || value.includes('pasta') || value.includes('meal') || value.includes('prepared')) return 'Prepared'
  return 'Grocery'
}

const buildTags = (listing) => {
  const tags = []
  if (listing.foodType) tags.push(listing.foodType.split(',')[0].trim())
  if (listing.unit) tags.push(listing.unit)
  if (listing.status === 'available') tags.push('Available')
  return tags.slice(0, 3)
}

const formatListing = (listing) => {
  const category = inferCategory(listing.foodType)
  return {
    ...listing,
    title: listing.foodType,
    source: listing.orgCode || 'Community donor',
    category,
    quantityLabel: `${listing.quantity} ${listing.unit}`,
    distance: 'Nearby',
    timeLabel: getRelativeTime(listing.createdAt),
    description: listing.description || 'No extra description provided.',
    pickupTime: 'Arrange with donor after claim',
    allergens: 'Not specified',
    matchScore: 90,
    tags: buildTags(listing),
    emoji: category === 'Bakery' ? '🍞' : category === 'Produce' ? '🥕' : category === 'Prepared' ? '🍱' : '📦',
  }
}

const LiveListingBoard = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [listings, setListings] = useState([])
  const [claimedListings, setClaimedListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [claimingId, setClaimingId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('All')
  const [sortBy, setSortBy] = useState('recent')
  const [selectedListing, setSelectedListing] = useState(null)

  const orgCode = location.state?.orgCode || 'HCFB-2841'
  const orgName = location.state?.orgName || 'Harvest City Food Bank'
  const userName = location.state?.userName || 'Sarah'
  const searchPostcode = location.state?.postcode || '3000'

  const loadListings = async () => {
    setLoading(true)
    setError('')

    try {
      const [available, claimed] = await Promise.all([
        getAvailableListings({ postcode: searchPostcode, status: 'available' }),
        getAvailableListings({ postcode: searchPostcode, status: 'claimed' }),
      ])

      setListings(available.map(formatListing))
      setClaimedListings(claimed)
    } catch (err) {
      setError('Unable to load live listings right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadListings()
  }, [])

  const filteredListings = useMemo(() => {
    const results = listings.filter((listing) => {
      const matchesSearch =
        listing.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        listing.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
        listing.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesFilter = filterType === 'All' || listing.category === filterType
      return matchesSearch && matchesFilter
    })

    const sorted = [...results]
    if (sortBy === 'match') {
      sorted.sort((a, b) => b.matchScore - a.matchScore)
    } else if (sortBy === 'distance') {
      sorted.sort((a, b) => a.distance.localeCompare(b.distance))
    } else {
      sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    }

    return sorted
  }, [filterType, listings, searchTerm, sortBy])

  const handleClaim = async (listingId) => {
    setClaimingId(listingId)
    setError('')
    setNotice('')

    try {
      await claimListing(listingId, { orgId: orgCode, orgName })
      setNotice('Listing claimed successfully. The board has been refreshed.')
      setSelectedListing(null)
      await loadListings()
    } catch (err) {
      const detail = err?.response?.data?.detail || ''
      if (detail.toLowerCase().includes('already')) {
        setError('This listing was just claimed by another organisation. Please choose another item.')
      } else {
        setError('Claim failed. Please try again.')
      }
      await loadListings()
    } finally {
      setClaimingId(null)
    }
  }

  const handlePostExcess = () => {
    navigate(`/form/${searchPostcode}`, {
      state: {
        orgMode: true,
        orgCode,
        orgName,
        userName,
        postcode: searchPostcode,
      },
    })
  }

  return (
    <div className="live-listing-board">
      <header className="board-header">
        <button onClick={() => navigate('/')} className="back-button">
          ←
        </button>
        <div className="header-content">
          <div className="header-top">
            <div className="header-left">
              <div className="header-title">
                <span className="logo">🥬</span>
                <span className="title-text">CrisisLink</span>
              </div>
            </div>
            <button className="notification-btn">🔔</button>
          </div>
          <div className="org-info">
            <h2 className="org-name">{orgName}</h2>
            <p className="org-user">{userName} - Coordinator</p>
          </div>
          <div className="org-stats">
            <div className="stat-item">
              <span className="stat-value">{listings.length}</span>
              <span className="stat-label">available</span>
            </div>
            <div className="stat-divider">|</div>
            <div className="stat-item">
              <span className="stat-value">{claimedListings.length}</span>
              <span className="stat-label">claimed</span>
            </div>
          </div>
        </div>
      </header>

      <div className="smart-match-alert">
        <span className="alert-icon">💡</span>
        <div className="alert-content">
          <strong>Smart Match active</strong>
          <span className="alert-desc">Live listings for postcode {searchPostcode} • Claim status updates after each action</span>
        </div>
      </div>

      <div className="board-content">
        <div className="board-actions">
          <button className="post-excess-btn" onClick={handlePostExcess}>
            + Post excess food
          </button>
          <span className="board-actions-hint">Use this when your organisation has surplus to share with other centres.</span>
        </div>

        <div className="search-section">
          <input
            type="text"
            placeholder="🔍 Search food, source, tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-section">
          {categoryOptions.map((category) => (
            <button
              key={category}
              onClick={() => setFilterType(category)}
              className={`filter-btn ${filterType === category ? 'active' : ''}`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="sort-section">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-dropdown">
            <option value="recent">📍 Most Recent</option>
            <option value="match">⭐ Best Match</option>
            <option value="distance">📏 Closest</option>
          </select>
        </div>

        {notice && (
          <div className="smart-match-alert">
            <div className="alert-content">
              <strong>{notice}</strong>
            </div>
          </div>
        )}
        {error && (
          <div className="empty-state">
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="empty-state">
            <p>Loading live listings...</p>
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="empty-state">
            <p>No active listings found for postcode {searchPostcode}</p>
            <small>You can post a new donor listing or use the organisation posting button above.</small>
            <button className="empty-state-action" onClick={() => navigate('/postcode')}>
              Post surplus now
            </button>
          </div>
        ) : (
          <div className="listings-grid">
            {filteredListings.map((listing) => (
              <div key={listing.id} className="listing-card" onClick={() => setSelectedListing(listing)}>
                <div className="card-image">
                  <div className="image-placeholder">{listing.emoji}</div>
                  <div className="match-badge">
                    <span className="badge-icon">⭐</span>
                    <span className="badge-text">{listing.matchScore}% match</span>
                  </div>
                </div>

                <div className="card-content">
                  <h3 className="card-title">{listing.title}</h3>
                  <p className="card-source">{listing.source}</p>

                  <div className="card-meta">
                    <span className="meta-item">
                      <span className="meta-icon">📦</span>
                      <span className="meta-text">{listing.quantityLabel}</span>
                    </span>
                    <span className="meta-item">
                      <span className="meta-icon">📍</span>
                      <span className="meta-text">{listing.distance}</span>
                    </span>
                    <span className="meta-item">
                      <span className="meta-icon">⏱️</span>
                      <span className="meta-text">{listing.timeLabel}</span>
                    </span>
                  </div>

                  <div className="card-tags">
                    {listing.tags.map((tag) => (
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedListing && (
        <div className="modal-overlay" onClick={() => setSelectedListing(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedListing(null)}>
              ✕
            </button>

            <div className="modal-header">
              <span className="modal-emoji">{selectedListing.emoji}</span>
              <h2 className="modal-title">{selectedListing.title}</h2>
              <p className="modal-source">{selectedListing.source}</p>
            </div>

            <div className="modal-details">
              <div className="detail-row">
                <span className="label">Category</span>
                <span className="value">{selectedListing.category}</span>
              </div>
              <div className="detail-row">
                <span className="label">Quantity</span>
                <span className="value">{selectedListing.quantityLabel}</span>
              </div>
              <div className="detail-row">
                <span className="label">Distance</span>
                <span className="value">{selectedListing.distance}</span>
              </div>
              <div className="detail-row">
                <span className="label">Pickup Time</span>
                <span className="value">{selectedListing.pickupTime}</span>
              </div>
              <div className="detail-row">
                <span className="label">Allergens</span>
                <span className="value">{selectedListing.allergens}</span>
              </div>
            </div>

            <div className="modal-description">
              <p>{selectedListing.description}</p>
            </div>

            <div className="match-score-section">
              <div className="score-label">Match Score</div>
              <div className="score-bar">
                <div className="score-fill" style={{ width: `${selectedListing.matchScore}%` }}></div>
              </div>
              <div className="score-value">{selectedListing.matchScore}% Match</div>
            </div>

            <button className="claim-btn" onClick={() => handleClaim(selectedListing.id)} disabled={claimingId === selectedListing.id}>
              {claimingId === selectedListing.id ? 'Claiming...' : '✓ Claim This Listing'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default LiveListingBoard
