import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAvailableListings } from '../services/api'
import '../styles/PostFeedPage.css'

const ICON_MAP = {
  bread: 'bakery_dining', bakery: 'bakery_dining', sourdough: 'bakery_dining',
  curry: 'restaurant', meal: 'restaurant', food: 'restaurant',
  egg: 'egg', eggs: 'egg',
  veg: 'nutrition', vegetable: 'nutrition', produce: 'nutrition', salad: 'salad',
  fruit: 'nutrition', rice: 'restaurant', soup: 'soup_kitchen',
  yogurt: 'icecream', dairy: 'icecream', milk: 'icecream',
  oil: 'grocery', salt: 'grocery', sauce: 'grocery', vinegar: 'grocery', spice: 'grocery',
  sandwich: 'lunch_dining', burger: 'lunch_dining',
  pizza: 'local_pizza',
}

const getIcon = (name = '') => {
  const lower = name.toLowerCase()
  for (const [key, val] of Object.entries(ICON_MAP)) {
    if (lower.includes(key)) return val
  }
  return 'restaurant'
}

const FILTER_CATEGORIES = ['all', 'bakedGoods', 'produce', 'dairy', 'pantry', 'preparedMeals', 'other']

const inferCategory = (foodType = '') => {
  const value = foodType.toLowerCase()
  if (value.includes('bread') || value.includes('cake') || value.includes('pastry') || value.includes('macaron') || value.includes('bakery')) return 'bakedGoods'
  if (value.includes('vegetable') || value.includes('fruit') || value.includes('produce') || value.includes('salad') || value.includes('melon')) return 'produce'
  if (value.includes('milk') || value.includes('yogurt') || value.includes('cheese') || value.includes('egg') || value.includes('dairy')) return 'dairy'
  if (value.includes('oil') || value.includes('salt') || value.includes('sauce') || value.includes('vinegar') || value.includes('seasoning') || value.includes('spice')) return 'pantry'
  if (value.includes('meal') || value.includes('rice') || value.includes('curry') || value.includes('sandwich') || value.includes('pizza') || value.includes('prepared')) return 'preparedMeals'
  return 'other'
}

const normalizeCategory = (value = '') => {
  const lower = String(value).toLowerCase()
  if (['bakedgoods', 'baked goods', 'bakery & grains', 'bakery'].includes(lower)) return 'bakedGoods'
  if (['produce', 'fresh produce'].includes(lower)) return 'produce'
  if (['dairy', 'dairy & eggs'].includes(lower)) return 'dairy'
  if (['pantry', 'canned goods'].includes(lower)) return 'pantry'
  if (['preparedmeals', 'prepared meals', 'prepared'].includes(lower)) return 'preparedMeals'
  if (lower === 'other') return 'other'
  return ''
}

const getListingCategory = (listing) => normalizeCategory(listing.category) || inferCategory(listing.foodType)

const getSizeCueLabel = (sizeCue, t) => {
  if (!sizeCue) return ''
  return t(`donation.sizeCueOptions.${sizeCue}`, sizeCue)
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

const PostFeedPage = () => {
  const { postcode } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { t, i18n } = useTranslation()
  const [activeFilter, setActiveFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
  const normalizedPostcode = String(postcode || '').replace(/[^0-9]/g, '').slice(0, 4)
  const donorCode = `DONOR-${String(normalizedPostcode || 'GUEST').toUpperCase()}`

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang)
    localStorage.setItem('preferredLanguage', lang)
    setShowLanguageMenu(false)
  }

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const data = await getAvailableListings({ postcode: normalizedPostcode, status: 'available', _ts: Date.now() })
        const nextListings = Array.isArray(data) ? data : []
        const postedListing = location.state?.postedListing

        if (
          postedListing &&
          String(postedListing.postcode || '') === normalizedPostcode &&
          String(postedListing.status || 'available') === 'available'
        ) {
          const withoutDuplicate = nextListings.filter((item) => item.id !== postedListing.id)
          setListings([postedListing, ...withoutDuplicate])
        } else {
          setListings(nextListings)
        }
      } catch {
        setListings([])
      } finally {
        setLoading(false)
      }
    }
    fetchListings()
  }, [normalizedPostcode, location.key, location.state?.refreshAt])

  const filtered = (Array.isArray(listings) ? listings : []).filter((l) => {
    const searchLower = search.toLowerCase()
    const matchesSearch =
      !searchLower ||
      (l.foodType || '').toLowerCase().includes(searchLower) ||
      (l.orgCode || '').toLowerCase().includes(searchLower) ||
      String(l.postcode || '').includes(searchLower) ||
      String(l.location || '').toLowerCase().includes(searchLower)

    if (!matchesSearch) return false
    if (activeFilter === 'all') return true
    return getListingCategory(l) === activeFilter
  })

  return (
    <div className="post-feed-page">
      {/* Top Navbar */}
      <header className="navbar">
        <div className="navbar-inner">
          <button className="nav-brand-btn" onClick={() => navigate('/')}>
            <div className="nav-brand">{t('appName')}</div>
          </button>
          <div className="nav-center">{t('listing.location', 'Location:')} {postcode}</div>
          <div className="nav-actions">
            <button className="nav-home-btn" onClick={() => navigate('/')}>
              {t('common.home')}
            </button>
            <div className="language-btn-wrapper" style={{ position: 'relative' }}>
              <button 
                className="nav-icon-btn" 
                title="Change language"
                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
              >
                <span className="material-symbols-outlined">language</span>
              </button>
              {showLanguageMenu && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  minWidth: '120px',
                  marginTop: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  zIndex: 1000
                }}>
                  <button 
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '12px 16px',
                      border: 'none',
                      background: i18n.language === 'en' ? '#f0f0f0' : 'white',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: i18n.language === 'en' ? '600' : '400',
                      color: i18n.language === 'en' ? '#006B4C' : '#333',
                      borderBottom: '1px solid #eee'
                    }}
                    onClick={() => handleLanguageChange('en')}
                  >
                    English
                  </button>
                  <button 
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '12px 16px',
                      border: 'none',
                      background: i18n.language === 'zh' ? '#f0f0f0' : 'white',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: i18n.language === 'zh' ? '600' : '400',
                      color: i18n.language === 'zh' ? '#006B4C' : '#333'
                    }}
                    onClick={() => handleLanguageChange('zh')}
                  >
                    中文
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="navbar-divider" />
      </header>

      <main className="feed-content">
        {/* Board heading */}
        <div className="board-header">
          <h1 className="board-title">{t('feed.title')}</h1>
        </div>

        {/* Filters */}
        <section className="filter-section">
          <div className="search-wrapper">
            <span className="material-symbols-outlined search-icon">search</span>
            <input
              className={`search-input${search ? ' search-input--active' : ''}`}
              type="text"
              placeholder={t('feed.search')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="filter-chips">
            {FILTER_CATEGORIES.map(f => {
              return (
                <button
                  key={f}
                  className={`filter-chip${activeFilter === f ? ' active' : ''}`}
                  onClick={() => setActiveFilter(f)}
                >
                  {t(`dashboard.tabs.${f}`, f)}
                </button>
              );
            })}
          </div>
          {(search || activeFilter !== 'all') && (
            <p className="results-feedback">
              {search
                ? t('feed.searchResults', { count: filtered.length, term: search })
                : t('feed.filterResults', { count: filtered.length, filter: t(`dashboard.tabs.${activeFilter}`, activeFilter) })}
            </p>
          )}
          <p className="results-feedback results-feedback--secondary">
            {t('feed.referenceOnly')}
          </p>
        </section>

        {/* Cards grid */}
        <div className="food-grid">
          {loading ? (
            <div className="empty-state">
              <div className="empty-state-icon">⏳</div>
              <p>{t('common.loading')}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🍽️</div>
              <h3>{t('feed.noListings')}</h3>
              <p>Be the first to post surplus food in {postcode}.</p>
            </div>
          ) : (
            filtered.map(l => {
              const isClaimed = l.status === 'claimed'
              const isOwnDonorListing = l.orgCode === donorCode
              return (
                <div
                  key={l.id}
                  className={[
                    'food-card',
                    isClaimed ? 'food-card--claimed' : '',
                    l.photoUrl ? 'food-card--has-photo' : '',
                  ].join(' ')}
                >
                  {l.photoUrl ? (
                    /* ── Hero photo layout ─────────────────────────── */
                    <div className="food-card-hero">
                      <img
                        src={l.photoUrl}
                        alt={l.foodType}
                        className="food-card-hero-img"
                      />
                      {/* Frosted glass blur fade transitioning into card body */}
                      <div className="food-card-hero-fade" />
                      {/* Qty badge pinned to top-right of image */}
                      <span className={`food-qty-badge food-qty-badge--on-hero${isClaimed ? ' claimed' : ''}`}>
                        ~{l.quantity} {t(`listing.units.${l.unit}`, l.unit)}
                      </span>
                      {/* Category icon bottom-left of image */}
                      <div className="food-card-hero-icon">
                        <span className="material-symbols-outlined">{getIcon(l.foodType)}</span>
                      </div>
                    </div>
                  ) : (
                    /* ── No photo: classic top row ─────────────────── */
                    <div className="food-card-top">
                      <div className={`food-icon-circle${isClaimed ? ' claimed' : ''}`}>
                        <span className="material-symbols-outlined">{getIcon(l.foodType)}</span>
                      </div>
                      <span className={`food-qty-badge${isClaimed ? ' claimed' : ''}`}>
                        ~{l.quantity} {t(`listing.units.${l.unit}`, l.unit)}
                      </span>
                    </div>
                  )}

                  {/* ── Card body ───────────────────────────────────── */}
                  <div className="food-card-body">
                    <h3 className={`food-card-name${isClaimed ? ' claimed' : ''}`}>
                      {l.foodType}
                    </h3>
                    <p className={`food-card-source${isClaimed ? ' claimed' : ''}`}>
                      {l.orgCode}
                    </p>

                    {l.sizeCue && (
                      <div className="food-card-size">
                        {t('donation.sizeCue')}: {getSizeCueLabel(l.sizeCue, t)}
                      </div>
                    )}

                    <div className="food-card-meta">
                      {isClaimed ? (
                        <div className="food-meta-row claimed-by">
                          <span className="material-symbols-outlined">check_circle</span>
                          {t('feed.claimedBy', 'Claimed')}{l.claimedBy ? ` ${l.claimedBy}` : ''}
                        </div>
                      ) : (
                        l.expiresIn ? (
                        <div className="food-meta-row expiry">
                          <span className="material-symbols-outlined">schedule</span>
                          {t('listing.expiresIn', { time: l.expiresIn })}
                        </div>
                        ) : null
                      )}
                      <div className="food-meta-row location">
                        <span className="material-symbols-outlined">location_on</span>
                        {l.location || l.postcode}
                      </div>
                    </div>
                  </div>

                  {/* ── Claim button ─────────────────────────────────── */}
                  <div className="food-card-actions">
                    {isOwnDonorListing ? (
                      <button
                        className="claim-btn claim-btn--secondary"
                        onClick={() => navigate(`/form/${postcode}`, {
                          state: {
                            draftListing: {
                              ...l,
                              category: getListingCategory(l),
                            },
                            replaceListingId: l.id,
                            postcode,
                          },
                        })}
                      >
                        {t('feed.editButton')}
                      </button>
                    ) : isClaimed ? (
                      <button className="claim-btn claim-btn--disabled" disabled>
                        {t('common.success')}
                      </button>
                    ) : (
                      <button className="claim-btn claim-btn--secondary" disabled>
                        {t('feed.availableToGroups')}
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </main>

      {/* FAB — Post surplus */}
      <button className="fab" onClick={() => navigate(`/form/${postcode}`)} aria-label="Post food">
        <span className="material-symbols-outlined">add</span>
      </button>

      {/* Bottom Nav */}
      <nav className="bottom-nav">
        <button className="nav-tab active">
          <span className="material-symbols-outlined"
            style={{ fontVariationSettings: "'FILL' 1" }}>grid_view</span>
          <span className="nav-tab-label">{t('feed.title')}</span>
        </button>
        <button className="nav-tab" onClick={() => navigate(`/form/${postcode}`)}>
          <span className="material-symbols-outlined">add_circle</span>
          <span className="nav-tab-label">{t('home.donor.button')}</span>
        </button>
      </nav>
    </div>
  )
}

export default PostFeedPage
