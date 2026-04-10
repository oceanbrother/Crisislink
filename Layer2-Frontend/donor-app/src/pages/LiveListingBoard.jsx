import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../components/LanguageSwitcher'
import '../styles/LiveListingBoard.css'

const LiveListingBoard = () => {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [listings] = useState([
    {
      id: 1,
      emoji: '🍞',
      title: 'Artisan Sourdough Loaves',
      source: 'Bourke St Bakehouse',
      category: 'Bakery',
      categoryKey: 'bakery',
      quantity: '18 loaves',
      distance: '0.4 km',
      matchScore: 94,
      tags: ['Vegan', 'Fresh baked'],
      time: '8 min ago',
      description: 'High-quality sourdough loaves from this morning\'s batch.',
      pickupTime: 'Anytime today',
      allergens: 'May contain gluten, sesame',
      translations: {
        'zh-CN': {
          title: '手工酸面包',
          quantity: '18 条面包',
          tags: ['纯素友好', '新鲜烘焙'],
          time: '8 分钟前',
          description: '今天早晨新鲜出炉的高品质酸面包。',
          pickupTime: '今天任意时间',
          allergens: '可能含有麸质、芝麻'
        },
        vi: {
          title: 'Ổ bánh mì chua thủ công',
          quantity: '18 ổ bánh',
          tags: ['Phù hợp ăn chay', 'Mới nướng'],
          time: '8 phút trước',
          description: 'Những ổ bánh mì chua chất lượng cao vừa ra lò sáng nay.',
          pickupTime: 'Bất kỳ lúc nào hôm nay',
          allergens: 'Có thể chứa gluten, mè'
        }
      }
    },
    {
      id: 2,
      emoji: '🥕',
      title: 'Mixed Seasonal Vegetables',
      source: 'Richmond Farmers Market',
      category: 'Produce',
      categoryKey: 'produce',
      quantity: '~30 kg',
      distance: '0.8 km',
      matchScore: 91,
      tags: ['Organic', 'Fresh', 'Seasonal'],
      time: 'Just now',
      description: 'Fresh seasonal vegetables including carrots, zucchini, capsicum.',
      pickupTime: 'Before 4 PM',
      allergens: 'None',
      translations: {
        'zh-CN': {
          title: '当季混合蔬菜',
          quantity: '约 30 公斤',
          tags: ['有机', '新鲜', '当季'],
          time: '刚刚',
          description: '新鲜当季蔬菜，包括胡萝卜、西葫芦和甜椒。',
          pickupTime: '下午 4 点前',
          allergens: '无'
        },
        vi: {
          title: 'Rau củ theo mùa hỗn hợp',
          quantity: 'khoảng 30 kg',
          tags: ['Hữu cơ', 'Tươi', 'Theo mùa'],
          time: 'Vừa xong',
          description: 'Rau củ theo mùa tươi mới gồm cà rốt, bí ngòi và ớt chuông.',
          pickupTime: 'Trước 4 giờ chiều',
          allergens: 'Không có'
        }
      }
    },
    {
      id: 3,
      emoji: '🍕',
      title: 'Prepared Pizza & Pasta',
      source: 'River Cafe',
      category: 'Prepared',
      categoryKey: 'prepared',
      quantity: '6 boxes',
      distance: '1.2 km',
      matchScore: 87,
      tags: ['Ready to serve', 'Hot meals'],
      time: '15 min ago',
      description: 'Surplus from catering event. Mix of pizzas and pasta.',
      pickupTime: 'Within 2 hours',
      allergens: 'Contains gluten, dairy, sesame',
      translations: {
        'zh-CN': {
          title: '熟食披萨和意面',
          quantity: '6 盒',
          tags: ['可即食', '热餐'],
          time: '15 分钟前',
          description: '来自餐饮活动的剩余食物，包含披萨和意面。',
          pickupTime: '两小时内',
          allergens: '含有麸质、乳制品、芝麻'
        },
        vi: {
          title: 'Pizza và mì Ý nấu sẵn',
          quantity: '6 hộp',
          tags: ['Sẵn sàng phục vụ', 'Bữa ăn nóng'],
          time: '15 phút trước',
          description: 'Phần thực phẩm dư từ sự kiện phục vụ ăn uống, gồm pizza và mì Ý.',
          pickupTime: 'Trong vòng 2 giờ',
          allergens: 'Chứa gluten, sữa, mè'
        }
      }
    },
    {
      id: 4,
      emoji: '🥛',
      title: 'Dairy Products Bundle',
      source: 'Spencer St Groceries',
      category: 'Grocery',
      categoryKey: 'grocery',
      quantity: '12 units',
      distance: '0.6 km',
      matchScore: 85,
      tags: ['Refrigerated', 'Expiring soon'],
      time: '22 min ago',
      description: 'Yogurt, cheese blocks, and milk approaching best-by dates.',
      pickupTime: 'ASAP',
      allergens: 'Contains dairy',
      translations: {
        'zh-CN': {
          title: '乳制品组合包',
          quantity: '12 件',
          tags: ['需冷藏', '即将到期'],
          time: '22 分钟前',
          description: '酸奶、奶酪和牛奶，临近最佳食用日期。',
          pickupTime: '尽快',
          allergens: '含有乳制品'
        },
        vi: {
          title: 'Gói sản phẩm sữa',
          quantity: '12 phần',
          tags: ['Bảo quản lạnh', 'Sắp hết hạn'],
          time: '22 phút trước',
          description: 'Sữa chua, phô mai và sữa tươi gần đến hạn dùng tốt nhất.',
          pickupTime: 'Càng sớm càng tốt',
          allergens: 'Chứa sữa'
        }
      }
    },
    {
      id: 5,
      emoji: '🍎',
      title: 'Apples & Citrus Bulk',
      source: 'Collingwood Orchard Co',
      category: 'Produce',
      categoryKey: 'produce',
      quantity: '~50 kg',
      distance: '2.1 km',
      matchScore: 92,
      tags: ['Bulk', 'Organic'],
      time: '45 min ago',
      description: 'Mixed apples and oranges from this week\'s harvest.',
      pickupTime: 'Anytime',
      allergens: 'None',
      translations: {
        'zh-CN': {
          title: '苹果与柑橘大宗水果',
          quantity: '约 50 公斤',
          tags: ['大宗', '有机'],
          time: '45 分钟前',
          description: '本周采收的混合苹果和橙子。',
          pickupTime: '任意时间',
          allergens: '无'
        },
        vi: {
          title: 'Táo và cam quýt số lượng lớn',
          quantity: 'khoảng 50 kg',
          tags: ['Số lượng lớn', 'Hữu cơ'],
          time: '45 phút trước',
          description: 'Táo và cam hỗn hợp từ đợt thu hoạch tuần này.',
          pickupTime: 'Bất kỳ lúc nào',
          allergens: 'Không có'
        }
      }
    }
  ])

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
