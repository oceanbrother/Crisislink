import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/LiveListingBoard.css'

const LiveListingBoard = () => {
  const navigate = useNavigate()
  const [listings] = useState([
    {
      id: 1,
      emoji: '🍞',
      title: 'Artisan Sourdough Loaves',
      source: 'Bourke St Bakehouse',
      category: 'Bakery',
      quantity: '18 loaves',
      distance: '0.4 km',
      matchScore: 94,
      tags: ['Vegan', 'Fresh baked'],
      time: '8 min ago',
      description: 'High-quality sourdough loaves from this morning\'s batch.',
      pickupTime: 'Anytime today',
      allergens: 'May contain gluten, sesame'
    },
    {
      id: 2,
      emoji: '🥕',
      title: 'Mixed Seasonal Vegetables',
      source: 'Richmond Farmers Market',
      category: 'Produce',
      quantity: '~30 kg',
      distance: '0.8 km',
      matchScore: 91,
      tags: ['Organic', 'Fresh', 'Seasonal'],
      time: 'Just now',
      description: 'Fresh seasonal vegetables including carrots, zucchini, capsicum.',
      pickupTime: 'Before 4 PM',
      allergens: 'None'
    },
    {
      id: 3,
      emoji: '🍕',
      title: 'Prepared Pizza & Pasta',
      source: 'River Cafe',
      category: 'Prepared',
      quantity: '6 boxes',
      distance: '1.2 km',
      matchScore: 87,
      tags: ['Ready to serve', 'Hot meals'],
      time: '15 min ago',
      description: 'Surplus from catering event. Mix of pizzas and pasta.',
      pickupTime: 'Within 2 hours',
      allergens: 'Contains gluten, dairy, sesame'
    },
    {
      id: 4,
      emoji: '🥛',
      title: 'Dairy Products Bundle',
      source: 'Spencer St Groceries',
      category: 'Grocery',
      quantity: '12 units',
      distance: '0.6 km',
      matchScore: 85,
      tags: ['Refrigerated', 'Expiring soon'],
      time: '22 min ago',
      description: 'Yogurt, cheese blocks, and milk approaching best-by dates.',
      pickupTime: 'ASAP',
      allergens: 'Contains dairy'
    },
    {
      id: 5,
      emoji: '🍎',
      title: 'Apples & Citrus Bulk',
      source: 'Collingwood Orchard Co',
      category: 'Produce',
      quantity: '~50 kg',
      distance: '2.1 km',
      matchScore: 92,
      tags: ['Bulk', 'Organic'],
      time: '45 min ago',
      description: 'Mixed apples and oranges from this week\'s harvest.',
      pickupTime: 'Anytime',
      allergens: 'None'
    }
  ])

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
                <span className="title-text">CrisisLink</span>
              </div>
            </div>
            <button className="notification-btn">🔔</button>
          </div>
          <div className="org-info">
            <h2 className="org-name">Harvest City Food Bank</h2>
            <p className="org-user">Sarah - Coordinator</p>
          </div>
          <div className="org-stats">
            <div className="stat-item">
              <span className="stat-value">3</span>
              <span className="stat-label">available</span>
            </div>
            <div className="stat-divider">|</div>
            <div className="stat-item">
              <span className="stat-value">1</span>
              <span className="stat-label">claimed</span>
            </div>
          </div>
        </div>
      </header>

      {/* Smart Match Alert */}
      <div className="smart-match-alert">
        <span className="alert-icon">💡</span>
        <div className="alert-content">
          <strong>Smart Match active</strong>
          <span className="alert-desc">NLP-ranked for your dietary requirements • Sorted by fit score</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="board-content">
        {/* Search Bar */}
        <div className="search-section">
          <input
            type="text"
            placeholder="🔍 Search food, source, tags..."
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
              {category}
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
            <option value="recent">📍 Most Recent</option>
            <option value="match">⭐ Best Match</option>
            <option value="distance">📏 Closest</option>
          </select>
        </div>

        {/* Listings Grid */}
        {filteredListings.length === 0 ? (
          <div className="empty-state">
            <p>No listings found matching your search</p>
            <small>Try adjusting your filters</small>
          </div>
        ) : (
          <div className="listings-grid">
            {filteredListings.map(listing => (
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
                      <span className="badge-text">Claimed</span>
                    </div>
                  )}
                </div>

                {/* Card Content */}
                <div className="card-content">
                  <h3 className="card-title">{listing.title}</h3>
                  <p className="card-source">{listing.source}</p>

                  <div className="card-meta">
                    <span className="meta-item">
                      <span className="meta-icon">📦</span>
                      <span className="meta-text">{listing.quantity}</span>
                    </span>
                    <span className="meta-item">
                      <span className="meta-icon">📍</span>
                      <span className="meta-text">{listing.distance}</span>
                    </span>
                    <span className="meta-item">
                      <span className="meta-icon">⏱️</span>
                      <span className="meta-text">{listing.time}</span>
                    </span>
                  </div>

                  <div className="card-tags">
                    {listing.tags.map(tag => (
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                  </div>

                  {claimedListings.has(listing.id) && (
                    <div className="claimed-notice">You claimed this: Pickup arrangement needed</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
                <span className="value">{selectedListing.quantity}</span>
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
                <div
                  className="score-fill"
                  style={{ width: `${selectedListing.matchScore}%` }}
                ></div>
              </div>
              <div className="score-value">{selectedListing.matchScore}% Match</div>
            </div>

            <button
              className="claim-btn"
              onClick={() => handleClaim(selectedListing.id)}
            >
              ✓ Claim This Listing
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default LiveListingBoard
