import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { claimListing, expireListing, getAvailableListings } from '../services/api'
import LanguageSwitcher from '../components/LanguageSwitcher'
import '../styles/LiveListingBoard.css'

const FILTER_CATEGORIES = ['all', 'bakedGoods', 'produce', 'dairy', 'pantry', 'preparedMeals', 'other']

const ICON_MAP = {
  bread: 'bakery_dining', bakery: 'bakery_dining', sourdough: 'bakery_dining',
  curry: 'restaurant', meal: 'restaurant', food: 'restaurant', rice: 'restaurant',
  egg: 'egg', eggs: 'egg', dairy: 'egg', milk: 'egg', yogurt: 'egg', cheese: 'egg',
  veg: 'nutrition', vegetable: 'nutrition', produce: 'nutrition', salad: 'nutrition', fruit: 'nutrition', melon: 'nutrition',
  oil: 'grocery', salt: 'grocery', sauce: 'grocery', vinegar: 'grocery', spice: 'grocery', seasoning: 'grocery',
  sandwich: 'lunch_dining', burger: 'lunch_dining', pizza: 'local_pizza',
}

const getIcon = (name = '') => {
  const lower = name.toLowerCase()
  for (const [key, val] of Object.entries(ICON_MAP)) {
    if (lower.includes(key)) return val
  }
  return 'restaurant'
}

const inferCategory = (foodType = '') => {
  const value = foodType.toLowerCase()
  if (value.includes('bread') || value.includes('cake') || value.includes('pastry') || value.includes('bakery') || value.includes('macaron')) return 'bakedGoods'
  if (value.includes('vegetable') || value.includes('fruit') || value.includes('produce') || value.includes('salad') || value.includes('melon')) return 'produce'
  if (value.includes('milk') || value.includes('yogurt') || value.includes('cheese') || value.includes('egg') || value.includes('dairy')) return 'dairy'
  if (value.includes('oil') || value.includes('salt') || value.includes('sauce') || value.includes('vinegar') || value.includes('seasoning') || value.includes('spice')) return 'pantry'
  if (value.includes('meal') || value.includes('rice') || value.includes('curry') || value.includes('sandwich') || value.includes('pizza') || value.includes('prepared')) return 'preparedMeals'
  return 'other'
}

const normalizeCategory = (value = '') => {
  const lower = String(value).toLowerCase()
  if (['bakedgoods', 'baked goods', 'bakery & grains', 'bakery'].includes(lower)) return 'bakedGoods'
  if (['produce', 'fresh produce', 'fruit & veg'].includes(lower)) return 'produce'
  if (['dairy', 'dairy & eggs', 'dairy, eggs & fridge'].includes(lower)) return 'dairy'
  if (['pantry', 'canned goods', 'grocery'].includes(lower)) return 'pantry'
  if (['preparedmeals', 'prepared meals', 'prepared'].includes(lower)) return 'preparedMeals'
  if (lower === 'other') return 'other'
  return ''
}

const getListingCategory = (listing) => normalizeCategory(listing.category) || inferCategory(listing.foodType)

const getSizeCueLabel = (sizeCue, t) => {
  if (!sizeCue) return ''
  const normalized = String(sizeCue).trim()
  const keyMap = {
    small: 'small',
    medium: 'medium',
    large: 'large',
    heavy: 'heavy',
    extraheavy: 'extraHeavy',
    'extra heavy': 'extraHeavy',
    小: 'small',
    中: 'medium',
    大: 'large',
    重: 'heavy',
    超重: 'extraHeavy',
  }
  const mapped = keyMap[normalized.toLowerCase?.() ? normalized.toLowerCase() : normalized] || keyMap[normalized] || null
  return mapped ? t(`donation.sizeCueOptions.${mapped}`) : normalized
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

const buildItemsAvailableLabel = (count, t, locale) => {
  if (locale?.startsWith('zh')) return `${count} ${t('listing.itemsAvailableZhSuffix', '件物品可用')}`
  return `${count} item${count === 1 ? '' : 's'} available`
}

const LiveListingBoard = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { t, i18n } = useTranslation()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [claimingId, setClaimingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [claimedListings, setClaimedListings] = useState([])
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')

  const rawOrgCode = location.state?.orgCode || '1'
  const orgCode = String(rawOrgCode).trim() || '1'

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const [availableData, claimedData] = await Promise.all([
          getAvailableListings({ status: 'available' }),
          getAvailableListings({ status: 'claimed', claimedBy: orgCode }),
        ])
        setListings(Array.isArray(availableData) ? availableData : [])
        setClaimedListings(Array.isArray(claimedData) ? claimedData : [])
      } catch (err) {
        console.error(err)
        setListings([])
        setClaimedListings([])
        setError(t('dashboard.noListings'))
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [orgCode, t])

  const filtered = useMemo(() => {
    let next = Array.isArray(listings) ? [...listings] : []
    if (activeFilter !== 'all') {
      next = next.filter((listing) => getListingCategory(listing) === activeFilter)
    }
    if (search) {
      const term = search.toLowerCase()
      next = next.filter((listing) =>
        (listing.foodType || '').toLowerCase().includes(term) ||
        (listing.orgCode || '').toLowerCase().includes(term) ||
        String(listing.postcode || '').includes(term)
      )
    }
    return next
  }, [activeFilter, listings, search])

  const handleClaim = async (listingId) => {
    setClaimingId(listingId)
    setError('')
    setSuccess('')
    try {
      const claimedListing = listings.find((listing) => listing.id === listingId)
      await claimListing(listingId, { orgId: orgCode })
      if (claimedListing) {
        setClaimedListings((current) => [
          { ...claimedListing, claimedByOrgId: orgCode, claimedAt: new Date().toISOString() },
          ...(Array.isArray(current) ? current : []).filter((listing) => listing.id !== listingId),
        ])
      }
      setSuccess(t('listing.claimMovedOut', 'Claimed successfully. This item has been moved out of the available board.'))
      setListings((current) => (Array.isArray(current) ? current : []).filter((listing) => listing.id !== listingId))
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error(err)
      setError(t('dashboard.noListings'))
      setTimeout(() => setError(''), 3000)
    } finally {
      setClaimingId(null)
    }
  }

  const handleRemoveListing = async (listingId) => {
    setClaimingId(listingId)
    setError('')
    setSuccess('')
    try {
      await expireListing(listingId)
      setSuccess(t('donation.success.deleteListing'))
      setListings((current) => (Array.isArray(current) ? current : []).filter((listing) => listing.id !== listingId))
      setTimeout(() => setSuccess(''), 1500)
    } catch (err) {
      console.error(err)
      setError(t('donation.errors.deleteFailed'))
      setTimeout(() => setError(''), 3000)
    } finally {
      setClaimingId(null)
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
        orgMode: true,
        orgCode,
        orgName: `Organization ${orgCode}`,
        draftListing: listing,
        replaceListingId: listing.id,
      },
    })
  }

  const itemsAvailableLabel = buildItemsAvailableLabel(filtered.length, t, i18n.language)

  return (
    <div className="live-listing-board">
      <header className="org-navbar">
        <div className="org-navbar-inner">
          <button className="nav-brand-btn" onClick={() => navigate('/')}>
            <div className="nav-brand">{t('appName')}</div>
          </button>
          <div className="nav-center">{t('dashboard.allServiceAreas', 'All service areas')}</div>
          <div className="nav-actions">
            <button className="nav-home-btn" onClick={() => navigate('/')}>
              {t('common.home')}
            </button>
            <LanguageSwitcher />
          </div>
        </div>
        <div className="navbar-divider" />
      </header>

      <main className="feed-content org-feed-content">
        <div className="board-header board-header--org">
          <div>
            <h1 className="board-title">{t('dashboard.title')}</h1>
            <p className="org-board-meta">{t('orgCode.current', 'Current organization code')}: {orgCode}</p>
          </div>
        </div>

        <section className="filter-section">
          <div className="search-wrapper">
            <span className="material-symbols-outlined search-icon">search</span>
            <input
              className={`search-input${search ? ' search-input--active' : ''}`}
              type="text"
              placeholder={t('feed.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="filter-chips">
            {FILTER_CATEGORIES.map((filterKey) => (
              <button
                key={filterKey}
                className={`filter-chip${activeFilter === filterKey ? ' active' : ''}`}
                onClick={() => setActiveFilter(filterKey)}
              >
                {t(`dashboard.tabs.${filterKey}`, filterKey)}
              </button>
            ))}
          </div>

          {(search || activeFilter !== 'all') && (
            <p className="results-feedback">
              {search
                ? t('feed.searchResults', { count: filtered.length, term: search })
                : t('feed.filterResults', { count: filtered.length, filter: t(`dashboard.tabs.${activeFilter}`, activeFilter) })}
            </p>
          )}

          {!search && activeFilter === 'all' && (
            <p className="results-feedback">{itemsAvailableLabel}</p>
          )}
        </section>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {Array.isArray(claimedListings) && claimedListings.length > 0 && (
          <section className="claimed-section">
            <h2 className="claimed-section-title">{t('listing.claimedByYou', 'Claimed by you')}</h2>
            <div className="food-grid org-food-grid claimed-food-grid">
              {claimedListings.map((listing) => {
                const sizeLabel = getSizeCueLabel(listing.sizeCue, t)
                return (
                  <div key={`claimed-${listing.id}`} className="food-card food-card--claimed">
                    {listing.photoUrl ? (
                      <div className="food-card-hero">
                        <img src={listing.photoUrl} alt={listing.foodType} className="food-card-hero-img" />
                        <div className="food-card-hero-fade" />
                        <span className="food-qty-badge food-qty-badge--on-hero claimed">
                          ~{listing.quantity} {t(`listing.units.${listing.unit}`, listing.unit)}
                        </span>
                        <div className="food-card-hero-icon">
                          <span className="material-symbols-outlined">{getIcon(listing.foodType)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="food-card-media food-card-media--simple">
                        <span className="material-symbols-outlined food-card-icon">{getIcon(listing.foodType)}</span>
                        <span className="food-qty-badge claimed">~{listing.quantity} {t(`listing.units.${listing.unit}`, listing.unit)}</span>
                      </div>
                    )}

                    <div className="food-card-body">
                      <h3 className="food-card-name claimed">{listing.foodType}</h3>
                      <p className="food-card-source claimed">{t('listing.from')}: {listing.orgCode || 'Community'}</p>

                      {sizeLabel ? (
                        <p className="food-card-size">
                          {t('donation.sizeCue')}: {sizeLabel}
                        </p>
                      ) : null}

                      <div className="food-card-meta">
                        <div className="food-meta-row claimed-by">
                          <span>{t('listing.claimedByYou', 'Claimed by you')}</span>
                        </div>
                        <div className="food-meta-row location">
                          <span className="material-symbols-outlined">location_on</span>
                          <span>{listing.postcode}</span>
                        </div>
                        <div className="food-meta-row">
                          <span>{getRelativeTime(listing.claimedAt || listing.createdAt, t)}</span>
                        </div>
                      </div>

                      <button className="claim-btn claim-btn--disabled" type="button" disabled>
                        {t('listing.claimedStatus', 'Claimed')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <div className="food-grid org-food-grid">
          {loading ? (
            <div className="empty-state">
              <div className="empty-state-icon">⏳</div>
              <p>{t('common.loading')}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📦</div>
              <h3>{t('feed.noListings')}</h3>
            </div>
          ) : (
            filtered.map((listing) => {
              const sizeLabel = getSizeCueLabel(listing.sizeCue, t)
              const isOwnedByCurrentOrg = String(listing.orgCode || '').trim() === orgCode
              return (
                <div key={listing.id} className={['food-card', listing.photoUrl ? 'food-card--has-photo' : ''].join(' ')}>
                  {listing.photoUrl ? (
                    <div className="food-card-hero">
                      <img src={listing.photoUrl} alt={listing.foodType} className="food-card-hero-img" />
                      <div className="food-card-hero-fade" />
                      <span className="food-qty-badge food-qty-badge--on-hero">
                        ~{listing.quantity} {t(`listing.units.${listing.unit}`, listing.unit)}
                      </span>
                      <div className="food-card-hero-icon">
                        <span className="material-symbols-outlined">{getIcon(listing.foodType)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="food-card-media food-card-media--simple">
                      <span className="material-symbols-outlined food-card-icon">{getIcon(listing.foodType)}</span>
                      <span className="food-qty-badge">~{listing.quantity} {t(`listing.units.${listing.unit}`, listing.unit)}</span>
                    </div>
                  )}

                  <div className="food-card-body">
                    <h3 className="food-card-name">{listing.foodType}</h3>
                    <p className="food-card-source">{t('listing.from')}: {listing.orgCode || 'Community'}</p>

                    {sizeLabel ? (
                      <p className="food-card-size">
                        {t('donation.sizeCue')}: {sizeLabel}
                      </p>
                    ) : null}

                    <div className="food-card-meta">
                      <div className="food-meta-row location">
                        <span className="material-symbols-outlined">location_on</span>
                        <span>{listing.postcode}</span>
                      </div>
                      <div className="food-meta-row">
                        <span>{getRelativeTime(listing.createdAt, t)}</span>
                      </div>
                    </div>

                    {Array.isArray(listing.dietary_tags) && listing.dietary_tags.length > 0 ? (
                      <div className="listing-tags">
                        {listing.dietary_tags.map((tag) => (
                          <span key={tag} className="tag">
                            {t(`listing.dietary.${tag.replace(/-/g, '')}`, tag)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {isOwnedByCurrentOrg ? (
                    <div className="food-card-actions food-card-actions--owned">
                      <button className="claim-btn claim-btn--secondary" onClick={() => handleEditListing(listing)}>
                        {t('donation.success.editListing')}
                      </button>
                      <button
                        className="claim-btn claim-btn--danger"
                        onClick={() => handleRemoveListing(listing.id)}
                        disabled={claimingId === listing.id}
                      >
                        {claimingId === listing.id ? t('common.loading') : t('donation.success.deleteListing')}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="claim-btn"
                      onClick={() => handleClaim(listing.id)}
                      disabled={claimingId === listing.id}
                    >
                      {claimingId === listing.id ? t('listing.claimingButton') : t('listing.claimThisButton')}
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>

        <button className="fab" type="button" onClick={handlePostExcess}>
          <span className="material-symbols-outlined">add</span>
        </button>

        <nav className="bottom-nav" aria-label="Organization navigation">
          <button type="button" className="nav-tab active">
            <span className="material-symbols-outlined">grid_view</span>
            <span className="nav-tab-label">{t('feed.title')}</span>
          </button>
          <button type="button" className="nav-tab" onClick={handlePostExcess}>
            <span className="material-symbols-outlined">add_circle</span>
            <span className="nav-tab-label">{t('home.donor.button')}</span>
          </button>
        </nav>
      </main>
    </div>
  )
}

export default LiveListingBoard
