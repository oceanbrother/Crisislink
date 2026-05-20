import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { deleteListing, getAvailableListings } from '../services/api'
import ChatModal from '../components/ChatModal'
import { DIETARY_FILTER_OPTIONS, FILTER_OPTIONS, formatBestBeforeLabel, resolveListingCategory } from '../constants/listings'
import { forgetDonorListing, getOrCreateDonorCode, isRememberedDonorListing } from '../utils/donorIdentity'
import { getStoredDonorName } from '../utils/codeGeneration'
import { resolveImageUrl } from '../utils/imageUrl'
import { getSavedDonorPostcode, saveDonorPostcode } from '../utils/donorPostcode'
import { mergeListingSafetyFallback } from '../utils/listingSafety'
import logoUrl from '../assets/outbackshare-logo.png'
import mapPreviewImg from '../assets/donor-map-preview.jpg'
import textureImg from '../assets/post-food-texture.jpg'
import LanguageSwitcher from '../components/LanguageSwitcher'

// helpers

// normalise dietary tag to a consistent lowercase slug
function normalizeDietaryTag(value) { return String(value || '').trim().toLowerCase().replace(/\s+/g, '-') }

// map a dietary tag slug to the i18n translation key
function resolveDietaryTranslationKey(value) {
  const n = normalizeDietaryTag(value)
  if (n === 'non-vegetarian') return 'nonVegetarian'
  if (n === 'dairy-free' || n === 'lactose-free') return 'dairyFree'
  if (n === 'gluten-free') return 'glutenFree'
  return n
}

// check if a listing matches the selected dietary filter
function matchesDietaryFilter(tags, filterValue) {
  if (filterValue === 'all') return true
  if (!Array.isArray(tags) || tags.length === 0) return false
  return tags.some((rawTag) => {
    const n = normalizeDietaryTag(rawTag)
    if (filterValue === 'dairy-free') return n === 'dairy-free' || n === 'lactose-free'
    return n === filterValue
  })
}

// translate the storage condition string using i18n
function formatStorageCondition(storageCondition, t) {
  const value = String(storageCondition || '').trim()
  if (!value) return t('listing.storage.unknown', 'Not provided')
  return t(`listing.storage.${value}`, value)
}

// normalise an allergen tag to lowercase
function normalizeAllergenTag(tag) { return String(tag || '').trim().toLowerCase() }

// read allergen tags from either field name variant
function getAllergenTags(listing) {
  if (Array.isArray(listing?.allergenTags)) return listing.allergenTags
  if (Array.isArray(listing?.allergen_tags)) return listing.allergen_tags
  return []
}

// read storage condition from either field name variant
function getStorageCondition(listing) { return String(listing?.storageCondition || listing?.storage_condition || '').trim() }

// parse a date string to midnight local time, return null if invalid
function normalizeDateOnly(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  parsed.setHours(0, 0, 0, 0)
  return parsed
}

// return flags for whether the expiry date is today or already passed
function getExpiryMeta(expiryDate) {
  const parsed = normalizeDateOnly(expiryDate)
  if (!parsed) return { hasDate: false, isToday: false, isExpired: false }
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const deltaDays = Math.round((parsed.getTime() - today.getTime()) / 86400000)
  return { hasDate: true, isToday: deltaDays === 0, isExpired: deltaDays < 0 }
}

// translate a single allergen tag using i18n
function formatAllergenTag(tag, t) {
  const n = normalizeAllergenTag(tag)
  if (!n) return ''
  if (n === 'no known allergens') return t('listing.allergens.noknownallergens', 'No known allergens')
  return t(`listing.allergens.${n.replace(/\s+/g, '')}`, tag)
}

// detect old-style listings created using a donor postcode as the org code
function isLegacyDonorListing(listing, currentPostcode) {
  const listingOrgCode = String(listing?.orgCode || '').trim().toUpperCase()
  const postcode = String(currentPostcode || '').trim()
  return postcode !== '' && listingOrgCode === ('DONOR-' + postcode).toUpperCase()
}

// return true if the current donor owns this listing
function isOwnedDonorListing(listing, donorCode, postcode) {
  return listing.orgCode === donorCode || isRememberedDonorListing(listing.id) || isLegacyDonorListing(listing, postcode)
}

// return a human-readable relative time string for a listing
function getRelativeTime(createdAt, t) {
  if (!createdAt) return t('listing.justNow')
  const diff = Date.now() - new Date(createdAt).getTime()
  const minutes = Math.floor(diff / 60000), hours = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000)
  if (minutes < 1) return t('listing.justNow')
  if (minutes < 60) return t('listing.minutesAgo', { count: minutes })
  if (hours < 24) return t('listing.hoursAgo', { count: hours })
  return t('listing.daysAgo', { count: days })
}

// format the collected-at timestamp for display
function formatCollectedAtLabel(collectedAt, locale) {
  if (!collectedAt) return ''
  const date = new Date(collectedAt)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(locale || 'en-AU', { hour: 'numeric', minute: '2-digit', day: '2-digit', month: 'short' })
}

// format quantity as integer or up to 2 decimal places
function formatQuantityValue(value) {
  const numeric = Number(value)
  if (Number.isFinite(numeric) === false) return String(value ?? '')
  return Number.isInteger(numeric) ? String(numeric) : String(numeric.toFixed(2)).replace(/\.00$/, '')
}

// build the approximate quantity string shown on a listing card
function formatApproxQuantityLabel(listing, t) {
  const quantity = Number(listing?.quantity)
  const formattedQuantity = formatQuantityValue(quantity)
  const unit = String(listing?.unit || 'portions').trim().toLowerCase()
  let displayUnit = t(`listing.units.${unit}`, unit)
  if (Number.isFinite(quantity) && Math.abs(quantity - 1) < 0.00001) {
    if (unit === 'portions') displayUnit = t('listing.units.portion', 'portion')
    if (unit === 'meals') displayUnit = t('listing.units.meal', 'meal')
    if (unit === 'items') displayUnit = t('listing.units.item', 'item')
    if (unit === 'boxes') displayUnit = t('listing.units.box', 'box')
  }
  return t('listing.approxQuantity', { quantity: formattedQuantity, unit: displayUnit })
}

// split a search string into individual word tokens
function tokenizeSearch(value) { return String(value || '').toLowerCase().split(/[^\p{L}\p{N}]+/gu).filter(Boolean) }

// return true if any field contains the search term
function matchesSearchFields(fields, term) {
  const normalizedTerm = String(term || '').trim().toLowerCase()
  if (!normalizedTerm) return true
  return fields.some((value) => {
    const text = String(value || '').toLowerCase().trim()
    if (!text) return false
    const tokens = tokenizeSearch(text)
    if (normalizedTerm.length === 1) return tokens.some((token) => token.startsWith(normalizedTerm))
    return text.includes(normalizedTerm) || tokens.some((token) => token.startsWith(normalizedTerm))
  })
}

// collect the listing fields that should be matched against the search term
function getSearchableFields(listing, term) {
  const normalizedTerm = String(term || '').trim().toLowerCase()
  const primary = [listing.foodType, listing.description]
  if (!normalizedTerm) return primary
  const secondary = []
  if (normalizedTerm.length >= 2) secondary.push(listing.sizeCue)
  if (/\d/.test(normalizedTerm)) secondary.push(listing.postcode)
  return [...primary, ...secondary]
}

// style constants

const CHIP_ACTIVE   = { background: '#9a442d', color: '#fff', border: '1px solid rgba(154,68,45,0.5)', borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s', fontFamily: 'inherit' }
const CHIP_INACTIVE = { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s', fontFamily: 'inherit' }
const BTN_PRIMARY_TERRACOTTA = { background: '#9a442d', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px', width: '100%', fontFamily: 'inherit', transition: 'opacity 0.15s' }
const BTN_OUTLINE_TERRACOTTA = { background: 'transparent', color: '#9a442d', border: '1px solid #9a442d', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px', width: '100%', fontFamily: 'inherit', transition: 'background 0.15s' }
const BTN_MUTED = { background: 'transparent', color: '#707973', border: '1px solid #bfc9c1', borderRadius: 12, fontWeight: 500, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px', width: '100%', fontFamily: 'inherit' }
const DETAIL_ROW = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#404943' }

// main component

const PostFeedPage = () => {
  const { postcode: routePostcode } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { t, i18n } = useTranslation()

  const [activeFilter, setActiveFilter] = useState('All')
  const [activeFoodType, setActiveFoodType] = useState('all')
  const [listingScope, setListingScope] = useState('all')
  const [search, setSearch] = useState('')
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [brokenImageIds, setBrokenImageIds] = useState([])
  const [chatClaim, setChatClaim] = useState(null)

  // ref for scrolling to the listings section from the action cards
  const listingsSectionRef = useRef(null)

  const donorCode = useMemo(() => getOrCreateDonorCode(), [])
  const donorName = getStoredDonorName()
  const postcode = String(routePostcode || location.state?.postcode || getSavedDonorPostcode() || '').trim()

  // fetch available, claimed, and collected listings then merge by id
  const fetchListings = async () => {
    try {
      setLoading(true)
      const buildFilters = (status) => {
        const filters = { status }
        if (postcode) filters.postcode = postcode
        return filters
      }
      const [availableData, claimedData, collectedData] = await Promise.all([
        getAvailableListings(buildFilters('available')).catch(() => []),
        getAvailableListings(buildFilters('claimed')).catch(() => []),
        getAvailableListings(buildFilters('collected')).catch(() => []),
      ])
      const mergedById = new Map()
      ;[availableData, claimedData, collectedData].forEach((bucket) => {
        ;(Array.isArray(bucket) ? bucket : []).forEach((listing) => { mergedById.set(listing.id, listing) })
      })
      const safeListings = Array.from(mergedById.values()).map((listing) => mergeListingSafetyFallback(listing))
      setListings(safeListings); setError('')
    } catch {
      setListings([]); setError(t('feed.loadError', 'Unable to load listings right now.'))
    } finally { setLoading(false) }
  }

  useEffect(() => { saveDonorPostcode(postcode); fetchListings() }, [postcode])

  // filter listings by ownership, scope, category, dietary type, and search term
  const filteredListings = useMemo(() => {
    const term = search.trim().toLowerCase()
    return listings.filter((listing) => {
      const category = resolveListingCategory(listing.category, listing.foodType)
      const ownListing = isOwnedDonorListing(listing, donorCode, postcode)
      if (!ownListing) return false
      const statusValue = String(listing.status || '').toLowerCase()
      const normalizedStatus = statusValue === 'picked_up' ? 'collected' : statusValue
      if (listingScope !== 'all' && normalizedStatus !== listingScope) return false
      if (activeFilter !== 'All' && category !== activeFilter) return false
      if (!matchesDietaryFilter(listing.dietary_tags, activeFoodType)) return false
      return matchesSearchFields(getSearchableFields(listing, term), term)
    })
  }, [activeFilter, activeFoodType, donorCode, listingScope, listings, postcode, search])

  const hasActiveSearch = search.trim() !== ''
  const hasActiveFilter = activeFilter !== 'All'
  const hasActiveFoodTypeFilter = activeFoodType !== 'all'
  const hasActiveScopeFilter = listingScope !== 'all'
  const hasActiveControls = hasActiveSearch || hasActiveFilter || hasActiveFoodTypeFilter || hasActiveScopeFilter
  const isBaseEmpty = listings.length === 0
  const isFilteredEmpty = !loading && !isBaseEmpty && filteredListings.length === 0

  // reset all active filters at once
  const clearFilters = () => { setSearch(''); setActiveFilter('All'); setActiveFoodType('all'); setListingScope('all') }

  // count donor listings by status for the summary strip
  const donorSummary = useMemo(() =>
    listings.reduce((acc, listing) => {
      if (!isOwnedDonorListing(listing, donorCode, postcode)) return acc
      acc.total += 1
      const statusValue = String(listing.status || '').toLowerCase()
      const ns = statusValue === 'picked_up' ? 'collected' : statusValue
      if (ns === 'available') acc.available += 1
      if (ns === 'claimed') acc.claimed += 1
      if (ns === 'collected') acc.collected += 1
      return acc
    }, { total: 0, available: 0, claimed: 0, collected: 0 }),
    [donorCode, listings, postcode]
  )

  // navigate to the post form in edit mode for an existing listing
  const handleEdit = (listing) => navigate('/donor/post', { state: { postcode: listing.postcode, editMode: true, listing, orgMode: false } })

  // navigate to the post form to create a new listing
  const handleCreatePost = () => navigate('/donor/post', { state: { postcode, orgMode: false } })

  // delete a listing and refresh the feed
  const handleRemove = async (listing) => {
    try {
      await deleteListing(listing.id, listing.orgCode || donorCode)
      forgetDonorListing(listing.id)
      await fetchListings()
    } catch { setError(t('feed.removeError', 'Unable to remove this listing right now.')) }
  }

  // mark an image as broken so the fallback placeholder is shown instead
  const markImageBroken = (listingId) => setBrokenImageIds((prev) => prev.includes(listingId) ? prev : [...prev, listingId])

  // donor state passed to map pages so the back button returns to this feed
  const donorNavState = { fromDonor: true, returnPath: location.pathname }

  // nav items for the left sidebar
  const NAV = [
    { icon: 'list_alt',       label: 'My Listings',       active: true,  onClick: () => {} },
    { icon: 'travel_explore', label: 'Area Intelligence', active: false, onClick: () => navigate('/org/intelligence', { state: donorNavState }) },
    { icon: 'near_me',        label: 'Around Me',         active: false, onClick: () => navigate('/org/coverage-map', { state: donorNavState }) },
    { icon: 'location_on',    label: 'Change Location',   active: false, onClick: () => navigate('/postcode') },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#1b4332', fontFamily: 'Inter, system-ui, sans-serif', position: 'relative' }}>

      {/* Bloom effects */}
      <div style={{ position: 'fixed', top: '5%', left: '12%', width: 500, height: 500, borderRadius: '50%', background: 'rgba(45,106,79,0.28)', filter: 'blur(90px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '10%', right: '8%', width: 400, height: 400, borderRadius: '50%', background: 'rgba(45,106,79,0.22)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', width: 350, height: 350, borderRadius: '50%', background: 'rgba(26,156,103,0.12)', filter: 'blur(100px)', transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Texture overlay */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `url(${textureImg})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.05, pointerEvents: 'none', zIndex: 0 }} />

      {/* Left sidebar */}
      <aside style={{ width: 256, flexShrink: 0, position: 'fixed', top: 0, left: 0, bottom: 0, background: 'rgba(20,52,38,0.97)', borderRight: '1px solid rgba(149,212,179,0.2)', display: 'flex', flexDirection: 'column', zIndex: 50, overflowY: 'auto' }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px 20px' }}>
          <button type="button" onClick={() => navigate('/')} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', marginBottom: 26, width: '100%' }}>
            <img
              src={logoUrl}
              alt="OutBackShare"
              style={{ height: 38, width: 'auto', maxWidth: 192, objectFit: 'contain', objectPosition: 'left center', display: 'block', filter: 'brightness(0) invert(1)' }}
            />
          </button>

          {/* Nav items */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {NAV.map(({ icon, label, active, onClick }) => (
              <button key={label} type="button" onClick={onClick}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 10, border: 'none', background: active ? 'rgba(149,212,179,0.22)' : 'transparent', color: active ? '#95d4b3' : 'rgba(255,255,255,0.7)', fontWeight: active ? 700 : 500, fontSize: 14, cursor: 'pointer', transition: 'background 0.15s', fontFamily: 'inherit', textAlign: 'left' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Bottom section with post button and language switcher */}
        <div style={{ marginTop: 'auto', padding: '16px 20px 24px', borderTop: '1px solid rgba(149,212,179,0.15)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button type="button" onClick={handleCreatePost}
            style={{ width: '100%', background: '#9a442d', color: '#fff', border: 'none', borderRadius: 14, padding: '13px 0', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(154,68,45,0.30)', transition: 'opacity 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Post Food
          </button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Language</span>
            <LanguageSwitcher dark />
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div style={{ marginLeft: 256, flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative', zIndex: 1 }}>

        {/* Top header */}
        <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(27,67,50,0.84)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(149,212,179,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px', height: 68 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" onClick={() => navigate('/roles')}
              style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.75)', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>arrow_back</span>
            </button>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>Donor Dashboard</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {donorName && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{donorName}</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>Verified Donor</div>
              </div>
            )}
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(149,212,179,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(149,212,179,0.25)', flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#95d4b3' }}>storefront</span>
            </div>
          </div>
        </header>

        <main style={{ padding: '40px 48px 80px' }}>

          {/* Welcome section */}
          <section style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
              <div>
                <h2 style={{ fontSize: 'clamp(28px, 3vw, 42px)', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', margin: '0 0 12px' }}>
                  Welcome back, {donorName || 'Food Donor'}
                </h2>
                {postcode && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.12)', padding: '5px 12px', borderRadius: 999 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#95d4b3' }}>location_on</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{postcode} Victoria</span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 14, flexShrink: 0 }}>
                <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(149,212,179,0.2)', borderRadius: 20, padding: '16px 24px', textAlign: 'center', minWidth: 120 }}>
                  <div style={{ fontSize: 30, fontWeight: 700, color: '#95d4b3', lineHeight: 1, marginBottom: 6 }}>{donorSummary.total}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>My Listings</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(252,145,116,0.25)', borderRadius: 20, padding: '16px 24px', textAlign: 'center', minWidth: 120 }}>
                  <div style={{ fontSize: 30, fontWeight: 700, color: '#fc9174', lineHeight: 1, marginBottom: 6 }}>{donorSummary.available}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>Available</div>
                </div>
              </div>
            </div>
          </section>

          {/* Action cards (3-col grid) */}
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 36 }}>
            {[
              {
                icon: 'add_circle', bg: 'rgba(255,219,210,0.15)', iconBg: '#ffdbd2', iconColor: '#9a442d',
                title: 'Post Surplus Food',
                desc: 'List your unsold produce to reach community centres in need instantly.',
                cta: 'Create new listing', ctaColor: '#fc9174',
                onClick: handleCreatePost,
              },
              {
                icon: 'travel_explore', bg: 'rgba(177,240,206,0.12)', iconBg: '#b1f0ce', iconColor: '#0f5238',
                title: 'Area Intelligence',
                desc: 'AI-predicted demand spikes and supply gaps across all postcodes in real-time.',
                cta: 'Explore area intelligence', ctaColor: '#95d4b3',
                onClick: () => navigate('/org/intelligence', { state: donorNavState }),
              },
              {
                icon: 'list_alt', bg: 'rgba(194,196,229,0.12)', iconBg: '#dfe0ff', iconColor: '#424561',
                title: 'Manage My Listings',
                desc: 'Track collections, update quantities, and view your impact history.',
                cta: 'View my listings', ctaColor: '#c2c4e5',
                onClick: () => {
                  setListingScope('all')
                  setTimeout(() => listingsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
                },
              },
            ].map(({ icon, bg, iconBg, iconColor, title, desc, cta, ctaColor, onClick }) => (
              <button key={title} type="button" onClick={onClick}
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: '28px 24px', display: 'flex', flexDirection: 'column', textAlign: 'left', cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.15)', transition: 'box-shadow 0.2s, transform 0.2s, background 0.2s', fontFamily: 'inherit', backdropFilter: 'blur(10px)' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.25)'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.15)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
              >
                <div style={{ width: 56, height: 56, background: iconBg, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 30, color: iconColor }}>{icon}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 10 }}>{title}</div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, flex: 1, marginBottom: 20 }}>{desc}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: ctaColor }}>
                  {cta}
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
                </div>
              </button>
            ))}
          </section>

          {/* Map and analytics asymmetric grid */}
          <section style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20, marginBottom: 40 }}>
            {/* Map preview — links to Area Intelligence */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => navigate('/org/intelligence', { state: donorNavState })}
              onKeyDown={e => e.key === 'Enter' && navigate('/org/intelligence', { state: donorNavState })}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(149,212,179,0.15)', borderRadius: 24, overflow: 'hidden', position: 'relative', minHeight: 260, cursor: 'pointer' }}
            >
              <img src={mapPreviewImg} alt="Active demand near you" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)' }} />
              <div style={{ position: 'absolute', top: 16, left: 20 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: '#e53e3e' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e53e3e', display: 'inline-block' }} />
                  Live demand data
                </div>
              </div>
              <div style={{ position: 'absolute', bottom: 24, left: 24, right: 24, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ color: '#fff' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>Area Intelligence — Your Region</div>
                  <div style={{ fontSize: 14, opacity: 0.9, textShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>Click to explore AI-predicted demand alerts near you.</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', borderRadius: 999, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#1a1c1b', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  Open map <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_full</span>
                </div>
              </div>
            </div>

            {/* Map features panel */}
            <div style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(149,212,179,0.15)', borderRadius: 24, padding: '24px 24px 20px', display: 'flex', flexDirection: 'column', backdropFilter: 'blur(10px)' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Explore the Map Tools</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, marginBottom: 18 }}>Three live views that show exactly where your food is needed most.</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* Area Intelligence button — passes donor context so back button returns here */}
                <button type="button"
                  onClick={() => navigate('/org/intelligence', { state: donorNavState })}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px', borderRadius: 14, border: '1px solid rgba(252,145,116,0.2)', background: 'rgba(252,145,116,0.06)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'background 0.15s, border-color 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(252,145,116,0.12)'; e.currentTarget.style.borderColor = 'rgba(252,145,116,0.35)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(252,145,116,0.06)'; e.currentTarget.style.borderColor = 'rgba(252,145,116,0.2)' }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ffdbd2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#9a442d' }}>travel_explore</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#fc9174' }}>Area Intelligence</span>
                      <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>arrow_forward</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.6 }}>
                      AI-predicted demand spikes and supply gaps across all postcodes.
                    </p>
                  </div>
                </button>

                {/* Around Me button — passes donor context so back button returns here */}
                <button type="button"
                  onClick={() => navigate('/org/coverage-map', { state: donorNavState })}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px', borderRadius: 14, border: '1px solid rgba(194,196,229,0.2)', background: 'rgba(194,196,229,0.06)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'background 0.15s, border-color 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(194,196,229,0.12)'; e.currentTarget.style.borderColor = 'rgba(194,196,229,0.35)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(194,196,229,0.06)'; e.currentTarget.style.borderColor = 'rgba(194,196,229,0.2)' }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#dfe0ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#424561' }}>near_me</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#c2c4e5' }}>Around Me</span>
                      <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>arrow_forward</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.6 }}>
                      Full coverage map — every scored postcode from high to low risk.
                    </p>
                  </div>
                </button>

              </div>
            </div>
          </section>

          {/* Listings section (scroll target for the manage card) */}
          <div ref={listingsSectionRef}>

            {/* Status summary strip */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
              {[
                { scope: 'all',       label: t('feed.statusTabs.all', 'All listings'),    count: donorSummary.total,     accent: '#95d4b3', activeBorder: 'rgba(149,212,179,0.6)' },
                { scope: 'available', label: t('feed.statusTabs.available', 'Available'), count: donorSummary.available, accent: '#fc9174', activeBorder: 'rgba(252,145,116,0.6)' },
                { scope: 'claimed',   label: t('feed.statusTabs.claimed', 'Claimed'),     count: donorSummary.claimed,   accent: '#95d4b3', activeBorder: 'rgba(149,212,179,0.6)' },
                { scope: 'collected', label: t('feed.statusTabs.collected', 'Collected'), count: donorSummary.collected, accent: 'rgba(255,255,255,0.7)', activeBorder: 'rgba(255,255,255,0.3)' },
              ].map(({ scope, label, count, accent, activeBorder }) => {
                const isActive = listingScope === scope
                return (
                  <button key={scope} type="button" onClick={() => setListingScope(scope)}
                    style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 18px', minWidth: 130, borderRadius: 16, border: isActive ? `2px solid ${activeBorder}` : '1px solid rgba(255,255,255,0.12)', background: isActive ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)', cursor: 'pointer', boxShadow: isActive ? '0 4px 20px rgba(0,0,0,0.2)' : '0 1px 4px rgba(0,0,0,0.1)', transition: 'all 0.2s', fontFamily: 'inherit', flexShrink: 0, backdropFilter: 'blur(8px)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent, display: 'block' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: isActive ? accent : '#fff', lineHeight: 1, marginBottom: 4 }}>{count}</div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>{label}</div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Filter panel */}
            <div style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(149,212,179,0.15)', borderRadius: 20, padding: '20px 24px', marginBottom: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.15)', backdropFilter: 'blur(10px)' }}>
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <span className="material-symbols-outlined" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 20, color: 'rgba(255,255,255,0.5)', pointerEvents: 'none' }}>search</span>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={t('feed.searchDonor', 'Search your listings…')}
                  style={{ width: '100%', height: 46, paddingLeft: 44, paddingRight: search ? 40 : 16, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, fontSize: 14, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: 'rgba(255,255,255,0.08)', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(149,212,179,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(149,212,179,0.1)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.15)'; e.target.style.boxShadow = 'none' }}
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                  </button>
                )}
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Category</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {FILTER_OPTIONS.map(option => (
                    <button key={option.value} type="button" onClick={() => setActiveFilter(option.value)}
                      style={activeFilter === option.value ? CHIP_ACTIVE : CHIP_INACTIVE}>
                      {option.value === 'All' ? t('dashboard.filterLabels.allCategories', 'All') : t(`dashboard.tabs.${option.key}`, option.value)}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: hasActiveControls ? 16 : 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Food type</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {DIETARY_FILTER_OPTIONS.map(option => (
                    <button key={option.value} type="button" onClick={() => setActiveFoodType(option.value)}
                      style={activeFoodType === option.value ? CHIP_ACTIVE : CHIP_INACTIVE}>
                      {option.value === 'all' ? t('dashboard.tabs.allTypes', 'All types') : t(`listing.dietary.${option.key}`, option.value)}
                    </button>
                  ))}
                </div>
              </div>

              {hasActiveControls && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  {hasActiveSearch && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(154,68,45,0.3)', color: '#fc9174', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 500 }}><span className="material-symbols-outlined" style={{ fontSize: 14 }}>search</span>"{search.trim()}"</span>}
                  {hasActiveFilter && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(154,68,45,0.3)', color: '#fc9174', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 500 }}>{activeFilter}</span>}
                  {hasActiveFoodTypeFilter && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(154,68,45,0.3)', color: '#fc9174', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 500 }}>{t(`listing.dietary.${resolveDietaryTranslationKey(activeFoodType)}`, activeFoodType)}</span>}
                  {hasActiveScopeFilter && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(154,68,45,0.3)', color: '#fc9174', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 500 }}>{t(`feed.statusTabs.${listingScope}`, listingScope)}</span>}
                  <button type="button" onClick={clearFilters} style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: '#fc9174', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', fontFamily: 'inherit' }}>Clear filters</button>
                </div>
              )}
            </div>

            {/* Result count and error message */}
            {!loading && !isBaseEmpty && !isFilteredEmpty && (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 20, fontWeight: 500 }}>
                {hasActiveControls ? t('feed.showingMatches', { count: filteredListings.length }) : t('listing.itemsAvailable', { count: filteredListings.length })}
              </div>
            )}
            {error && <div style={{ padding: '12px 18px', borderRadius: 12, background: 'rgba(186,26,26,0.25)', color: '#ffb4a1', fontSize: 14, marginBottom: 20 }}>{error}</div>}

            {/* Listing grid and empty states */}
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '60px 0', color: 'rgba(255,255,255,0.5)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'rgba(255,255,255,0.25)' }}>hourglass_empty</span>
                <p style={{ fontSize: 16, margin: 0 }}>{t('common.loading')}</p>
              </div>
            ) : isBaseEmpty ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '60px 0', textAlign: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'rgba(255,255,255,0.3)' }}>inventory_2</span>
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 600, color: '#fff', margin: 0 }}>{t('feed.emptyTitle', 'No listings yet')}</h3>
                <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', margin: 0, maxWidth: 380 }}>{t('feed.emptyHint', 'Once you post surplus food, it will appear here for you to manage.')}</p>
                <button type="button" onClick={handleCreatePost} style={{ ...BTN_PRIMARY_TERRACOTTA, width: 'auto', padding: '12px 28px', marginTop: 8, borderRadius: 14, fontSize: 15 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                  Post your first listing
                </button>
              </div>
            ) : isFilteredEmpty ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '60px 0', textAlign: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'rgba(255,255,255,0.3)' }}>search_off</span>
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 600, color: '#fff', margin: 0 }}>{t('feed.emptySearchTitle', 'No matching listings')}</h3>
                <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', margin: 0, maxWidth: 380 }}>{t('feed.emptySearchHint', 'Try another search term or clear the active filters.')}</p>
                <button type="button" onClick={clearFilters} style={{ ...BTN_OUTLINE_TERRACOTTA, width: 'auto', padding: '10px 24px', marginTop: 8 }}>Clear filters</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                {filteredListings.map((listing) => {
                  const ownListing = isOwnedDonorListing(listing, donorCode, postcode)
                  const dietaryTags = Array.isArray(listing.dietary_tags) ? listing.dietary_tags : []
                  const allergenTags = getAllergenTags(listing).map(tag => String(tag || '').trim()).filter(Boolean)
                  const allergenDisplayTags = allergenTags.length > 0 ? allergenTags : ['no known allergens']
                  const storageLabel = formatStorageCondition(getStorageCondition(listing), t)
                  const bestBefore = formatBestBeforeLabel(listing.expiryDate, i18n.language === 'zh' ? 'zh-CN' : 'en-AU')
                  const category = resolveListingCategory(listing.category, listing.foodType)
                  const categoryOption = FILTER_OPTIONS.find(o => o.value === category)
                  const expiryMeta = getExpiryMeta(listing.expiryDate)
                  const isExpiredListing = ownListing && expiryMeta.isExpired
                  const statusValue = String(listing.status || '').toLowerCase()
                  const isClaimedListing = statusValue === 'claimed'
                  const isCollectedListing = statusValue === 'collected' || statusValue === 'picked_up'
                  const collectedAtLabel = formatCollectedAtLabel(listing.pickedUpAt || listing.picked_up_at, i18n.language === 'zh' ? 'zh-CN' : 'en-AU')
                  const listingLocked = ownListing && (listing.hasClaims || isExpiredListing || isClaimedListing || isCollectedListing)
                  const listingLockReason = listing.hasClaims ? t('feed.editLockedTooltip') : isCollectedListing ? t('feed.editLockedCollectedTooltip') : isClaimedListing ? t('feed.editLockedClaimedTooltip') : isExpiredListing ? t('feed.editLockedExpiredTooltip') : ''
                  const imageUrl = resolveImageUrl(listing.photoUrl)
                  const shouldShowImage = imageUrl && !brokenImageIds.includes(listing.id)
                  const pickupWindow = String(listing.pickupWindow || listing.pickup_window || '').trim()

                  let badgeBg = 'rgba(15,82,56,0.88)', badgeLabel = t('dashboard.statusPills.available', 'Available')
                  if (isCollectedListing) { badgeBg = 'rgba(66,69,97,0.88)'; badgeLabel = t('dashboard.statusPills.collected', 'Collected') }
                  else if (isClaimedListing) { badgeBg = 'rgba(15,82,56,0.88)'; badgeLabel = t('dashboard.statusPills.claimedSimple', 'Claimed') }
                  else if (isExpiredListing) { badgeBg = 'rgba(186,26,26,0.88)'; badgeLabel = t('dashboard.statusPills.expired', 'Expired') }

                  return (
                    <article key={listing.id}
                      style={{ background: '#fff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', transition: 'box-shadow 0.2s, transform 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.3)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)'; e.currentTarget.style.transform = 'translateY(0)' }}
                    >
                      {/* Listing image */}
                      <div style={{ position: 'relative', height: 192, flexShrink: 0, overflow: 'hidden' }}>
                        {shouldShowImage ? (
                          <img src={imageUrl} alt={listing.foodType} onError={() => markImageBroken(listing.id)}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', background: '#ffdbd2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#ffb4a1' }}>restaurant</span>
                          </div>
                        )}
                        <span style={{ position: 'absolute', top: 12, left: 12, background: badgeBg, color: '#fff', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, backdropFilter: 'blur(6px)' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'block', opacity: 0.85 }} />
                          {badgeLabel}
                        </span>
                        <span style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(47,49,47,0.70)', color: '#f1f1ee', padding: '4px 9px', borderRadius: 999, fontSize: 11, fontWeight: 500, backdropFilter: 'blur(6px)' }}>
                          {getRelativeTime(listing.createdAt, t)}
                        </span>
                      </div>

                      {/* Listing body */}
                      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                        <div>
                          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1a1c1b', margin: '0 0 4px', lineHeight: 1.3 }}>{listing.foodType}</h3>
                          <p style={{ fontSize: 13, color: '#9a442d', fontWeight: 500, margin: 0 }}>
                            {ownListing ? t('feed.postedByYou', 'Posted by you') : t('feed.availableForGroups', 'Available to community groups')}
                          </p>
                        </div>

                        <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 500, color: '#404943', background: '#eeeeeb', padding: '3px 10px', borderRadius: 999, alignSelf: 'flex-start' }}>
                          {t('dashboard.tabs.' + (categoryOption?.key || 'other'), category)}
                        </span>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
                          <div style={DETAIL_ROW}><span className="material-symbols-outlined" style={{ fontSize: 15, color: '#707973' }}>inventory_2</span><span>{formatApproxQuantityLabel(listing, t)}</span></div>
                          {bestBefore && <div style={DETAIL_ROW}><span className="material-symbols-outlined" style={{ fontSize: 15, color: expiryMeta.isToday ? '#9a442d' : '#707973' }}>schedule</span><span style={{ color: expiryMeta.isToday ? '#9a442d' : 'inherit', fontWeight: expiryMeta.isToday ? 600 : 400 }}>{expiryMeta.isToday ? t('listing.bestBeforeToday', 'Today') : bestBefore}</span></div>}
                          <div style={DETAIL_ROW}><span className="material-symbols-outlined" style={{ fontSize: 15, color: '#707973' }}>location_on</span><span>{listing.postcode}</span></div>
                          <div style={DETAIL_ROW}><span className="material-symbols-outlined" style={{ fontSize: 15, color: '#707973' }}>kitchen</span><span>{storageLabel}</span></div>
                          {listing.sizeCue && <div style={{ ...DETAIL_ROW, gridColumn: '1 / -1' }}><span className="material-symbols-outlined" style={{ fontSize: 15, color: '#707973' }}>straighten</span><span>{listing.sizeCue}</span></div>}
                          {pickupWindow && <div style={{ ...DETAIL_ROW, gridColumn: '1 / -1' }}><span className="material-symbols-outlined" style={{ fontSize: 15, color: '#707973' }}>calendar_month</span><span>Pickup: {pickupWindow}</span></div>}
                          {isCollectedListing && collectedAtLabel && <div style={{ ...DETAIL_ROW, gridColumn: '1 / -1' }}><span className="material-symbols-outlined" style={{ fontSize: 15, color: '#707973' }}>event_available</span><span>Collected: {collectedAtLabel}</span></div>}
                        </div>

                        {dietaryTags.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {dietaryTags.map((tag, i) => (
                              <span key={i} style={{ fontSize: 11, fontWeight: 600, color: '#7c2e19', background: '#ffdbd2', padding: '3px 9px', borderRadius: 999 }}>
                                {t(`listing.dietary.${normalizeDietaryTag(tag)}`, tag)}
                              </span>
                            ))}
                          </div>
                        )}

                        <div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#707973', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Allergens: </span>
                          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
                            {allergenDisplayTags.map((tag, i) => (
                              <span key={`${tag}-${i}`} style={{ fontSize: 11, fontWeight: 500, color: '#404943', background: '#eeeeeb', padding: '2px 8px', borderRadius: 999 }}>
                                {formatAllergenTag(tag, t)}
                              </span>
                            ))}
                          </span>
                        </div>

                        {listing.description && (
                          <div style={{ background: '#f9f9f6', borderRadius: 10, padding: '8px 12px' }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#707973', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Notes: </span>
                            <p style={{ fontSize: 13, color: '#404943', margin: '4px 0 0', lineHeight: 1.5 }}>{listing.description}</p>
                          </div>
                        )}

                        <div style={{ flex: 1 }} />

                        {ownListing ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                            {isClaimedListing && listing.claimId && (
                              <button type="button" style={BTN_PRIMARY_TERRACOTTA}
                                onClick={() => setChatClaim({ claimId: listing.claimId, title: listing.foodType, orgCode: listing.orgCode })}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>forum</span>
                                {t('chat.openChat', 'Chat with organisation')}
                              </button>
                            )}
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button type="button"
                                style={listingLocked ? { ...BTN_OUTLINE_TERRACOTTA, opacity: 0.4, cursor: 'not-allowed' } : BTN_OUTLINE_TERRACOTTA}
                                onClick={() => handleEdit(listing)} disabled={listingLocked} title={listingLocked ? listingLockReason : ''}>
                                {t('donation.actions.editListing', 'Edit')}
                              </button>
                              <button type="button"
                                style={listingLocked ? { ...BTN_MUTED, opacity: 0.4, cursor: 'not-allowed' } : BTN_MUTED}
                                onClick={() => handleRemove(listing)} disabled={listingLocked} title={listingLocked ? listingLockReason : ''}>
                                {t('donation.actions.removeListing', 'Remove')}
                              </button>
                            </div>
                            {listingLocked && (
                              <p style={{ fontSize: 12, color: '#707973', margin: 0, lineHeight: 1.4, background: '#f4f4f1', borderRadius: 8, padding: '8px 10px' }}>
                                {listing.hasClaims ? t('feed.editLockedNote') : isCollectedListing ? t('feed.editLockedCollectedNote') : isClaimedListing ? t('feed.editLockedClaimedNote') : t('feed.editLockedExpiredNote')}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div style={{ background: '#f4f4f1', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#707973', textAlign: 'center', marginTop: 4 }}>
                            {t('feed.groupClaimNote', 'Community groups can claim this item from their board.')}
                          </div>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Chat modal */}
      {chatClaim && (
        <ChatModal claimId={chatClaim.claimId} listingTitle={chatClaim.title} orgCode={chatClaim.orgCode} onClose={() => setChatClaim(null)} />
      )}
    </div>
  )
}

export default PostFeedPage
