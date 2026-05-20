import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ChoroplethMap from '../components/ChoroplethMap'
import { predictionApiClient } from '../services/api'
import suburbLookup from '../data/vic_postcode_suburbs.json'
import logoUrl from '../assets/outbackshare-logo.png'
import textureImg from '../assets/post-food-texture.jpg'
import LanguageSwitcher from '../components/LanguageSwitcher'

// Matches backend _risk_label() thresholds
const RISK_COLORS = {
  critical:      '#e53030',
  high:          '#e53030',
  'medium-high': '#e8711a',
  'medium-low':  '#d69e2e',
  low:           '#1a9c67',
  none:          '#94a3b8',
}

function riskColorFromLabel(label) {
  return RISK_COLORS[label] || RISK_COLORS.none
}

function toneFromLabel(label) {
  if (!label) return 'watch'
  if (label === 'high')        return 'critical'
  if (label === 'medium-high') return 'high'
  if (label === 'medium-low')  return 'watch'
  return 'healthy'
}

const LEGEND = [
  { label: 'High (≥0.75)',         color: RISK_COLORS.high          },
  { label: 'Medium-high (≥0.50)',  color: RISK_COLORS['medium-high'] },
  { label: 'Medium-low (≥0.25)',   color: RISK_COLORS['medium-low']  },
  { label: 'Low (<0.25)',          color: RISK_COLORS.low            },
  { label: 'No score yet',         color: RISK_COLORS.none           },
]

const ORG_NAV = [
  { label: 'Listings',          path: '/org/listings'     },
  { label: 'Area Intelligence', path: '/org/intelligence' },
  { label: 'Around Me',         path: '/org/coverage-map', active: true },
]

export default function CoverageGapMap() {
  const navigate = useNavigate()
  const location = useLocation()

  // Capture donor context on first render — persists across tab/filter changes within page
  const fromDonor      = useRef(location.state?.fromDonor || false)
  const donorReturn    = useRef(location.state?.returnPath || '/donor/listings')

  const [riskData, setRiskData]         = useState([])   // raw API rows
  const [selected, setSelected]         = useState(null) // postcode string
  const [loading, setLoading]           = useState(true)
  const [showInfo, setShowInfo]         = useState(false)
  const [showMenu, setShowMenu]         = useState(false)
  const menuRef = useRef(null)

  const savedOrgSession = (() => {
    if (fromDonor.current) return {}
    try { return JSON.parse(window.localStorage.getItem('crisislink-org-session') || '{}') }
    catch { return {} }
  })()
  const orgCode = fromDonor.current ? null : (location.state?.orgCode || savedOrgSession.orgCode || 'HCFB-2841')

  // /predictions/all-risk-scores returns ALL postcodes across all risk bands
  // (unlike /intelligence/supply-gaps which filters HAVING risk > 0.5)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    predictionApiClient.get('/predictions/all-risk-scores')
      .then(res => { if (!cancelled) setRiskData(res.data || []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Build lookup: postcode → row
  const riskMap = useMemo(() => {
    const m = {}
    for (const row of riskData) m[String(row.postcode)] = row
    return m
  }, [riskData])

  // Map zones — all rows, colour by risk_label from backend
  const mapZones = useMemo(() =>
    riskData.map(item => ({
      postcode: String(item.postcode),
      suburb:   suburbLookup[String(item.postcode)] || String(item.postcode),
      tone:     toneFromLabel(item.risk_label),
      metric:   `${item.risk_label ? item.risk_label.charAt(0).toUpperCase() + item.risk_label.slice(1) : 'No score'} risk — ${(item.demand_risk_score * 100).toFixed(0)}%`,
    }))
  , [riskData])

  // Derived counts
  const atRiskCount = useMemo(() => riskData.filter(d => d.demand_risk_score >= 0.5).length, [riskData])
  const totalCount  = riskData.length
  const selectedRow = selected ? riskMap[selected] : null

  // closes the dropdown if user clicks anywhere outside the menu
  useEffect(() => {
    if (!showMenu) return
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  // navigates back to listings or to the donor return path depending on context
  function goBack() {
    if (fromDonor.current) navigate(donorReturn.current)
    else navigate('/org/listings', { state: { orgCode } })
  }

  // clears session and sends user to the right login page
  function handleLogout() {
    setShowMenu(false)
    if (fromDonor.current) {
      navigate('/')
    } else {
      window.localStorage.removeItem('crisislink-org-session')
      navigate('/org/code')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1b4332', fontFamily: 'Inter, system-ui, sans-serif', position: 'relative', overflow: 'hidden' }}>

      {/* Bloom layers */}
      <div style={{ position: 'fixed', top: '10%', left: '15%', width: 520, height: 520, borderRadius: '50%', background: 'rgba(45,106,79,0.28)', filter: 'blur(90px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '15%', right: '10%', width: 420, height: 420, borderRadius: '50%', background: 'rgba(45,106,79,0.22)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', width: 360, height: 360, borderRadius: '50%', background: 'rgba(26,156,103,0.12)', filter: 'blur(100px)', transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Texture overlay */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `url(${textureImg})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.05, pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(27,67,50,0.84)', backdropFilter: 'blur(18px)', borderBottom: '1px solid rgba(149,212,179,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px', height: 68 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button type="button" onClick={goBack}
              style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.75)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>arrow_back</span>
            </button>
            {/* Logo with profile dropdown */}
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button type="button" onClick={() => setShowMenu(v => !v)}
                style={{ border: 'none', background: 'transparent', padding: '4px 8px', cursor: 'pointer', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <img src={logoUrl} alt="OutBackShare" style={{ height: 30, width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.9 }} />
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', transition: 'transform 0.2s', transform: showMenu ? 'rotate(180deg)' : 'none' }}>expand_more</span>
              </button>

              {showMenu && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: 228, background: 'rgba(15,42,30,0.97)', border: '1px solid rgba(149,212,179,0.22)', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', zIndex: 200, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 16px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(149,212,179,0.15)', border: '1px solid rgba(149,212,179,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#95d4b3' }}>{fromDonor.current ? 'volunteer_activism' : 'groups'}</span>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fromDonor.current ? 'Donor' : (orgCode || 'Organisation')}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>{fromDonor.current ? 'Browsing as donor' : 'Community workspace'}</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ height: 1, background: 'rgba(149,212,179,0.12)', margin: '0 12px' }} />
                  <div style={{ padding: '8px' }}>
                    <button type="button" onClick={handleLogout}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(252,145,116,0.12)'; e.currentTarget.style.color = '#fc9174' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
                      {fromDonor.current ? 'Back to donor login' : 'Log out of workspace'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {ORG_NAV.map(tab => (
              <button key={tab.label} type="button"
                onClick={() => navigate(tab.path, { state: { orgCode, fromDonor: fromDonor.current, returnPath: donorReturn.current } })}
                style={{
                  padding: '7px 18px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: tab.active ? 'rgba(149,212,179,0.22)' : 'transparent',
                  color: tab.active ? '#95d4b3' : 'rgba(255,255,255,0.6)',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!tab.active) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff' } }}
                onMouseLeave={e => { if (!tab.active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' } }}
              >{tab.label}</button>
            ))}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LanguageSwitcher dark />
            {fromDonor.current ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(149,212,179,0.12)', border: '1px solid rgba(149,212,179,0.3)', borderRadius: 999, padding: '5px 14px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#95d4b3' }}>volunteer_activism</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#95d4b3' }}>Donor view</span>
              </div>
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: '4px 12px', fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                {orgCode}
              </div>
            )}
          </div>
        </header>

        {/* Page heading */}
        <div style={{ padding: '40px 48px 20px' }}>
          <h1 style={{ fontSize: 36, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', margin: '0 0 6px 0' }}>Around Me</h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', margin: 0 }}>
            Live demand risk signals for all scored postcodes · {totalCount} areas loaded
          </p>
        </div>

        {/* Info banner */}
        <div style={{ margin: '0 48px 20px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(149,212,179,0.2)', borderRadius: 12, padding: '12px 18px' }}>
          <button
            onClick={() => setShowInfo(!showInfo)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#95d4b3', fontWeight: 600, fontSize: '0.88rem', width: '100%', textAlign: 'left', padding: 0 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>info</span>
            <span>Around me – what this shows</span>
            <span className="material-symbols-outlined" style={{ fontSize: '1rem', marginLeft: 'auto', color: 'rgba(255,255,255,0.4)' }}>{showInfo ? 'expand_less' : 'expand_more'}</span>
          </button>
          {showInfo && (
            <p style={{ marginTop: 10, fontSize: '0.83rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
              Shows demand risk across all scored postcodes — from high risk (red) to low risk (green). Use it to identify where food supply is needed and where you can avoid duplicating existing supply.
            </p>
          )}
        </div>

        {/* Map and side panel */}
        <div style={{ display: 'flex', margin: '0 48px 48px', gap: 0, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(149,212,179,0.15)', height: '62vh', minHeight: 480 }}>

          {/* Map */}
          <div style={{ flex: 1, position: 'relative' }}>
            {loading && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, background: 'rgba(27,67,50,0.85)' }}>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Loading all risk zones…</p>
              </div>
            )}
            <ChoroplethMap
              zones={mapZones}
              selectedPostcode={selected || ''}
              onSelect={setSelected}
              height="100%"
              defaultCenter={[-36.8, 144.9]}
              defaultZoom={7}
            />
          </div>

          {/* Side panel */}
          <div style={{ width: 280, background: 'rgba(27,67,50,0.92)', borderLeft: '1px solid rgba(149,212,179,0.15)', overflowY: 'auto', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Legend — colours match ChoroplethMap TONE_FILL exactly */}
            <div>
              <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                Risk level
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {LEGEND.map(({ label, color }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 14, height: 14, borderRadius: 3, background: color, flexShrink: 0, opacity: 0.9 }} />
                    <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 16px' }}>
              <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                Coverage summary
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <p style={{ fontSize: '2rem', fontWeight: 700, color: '#fc9174', lineHeight: 1 }}>{atRiskCount}</p>
                  <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>at-risk zones (≥0.50)</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '1.2rem', fontWeight: 700, color: '#95d4b3', lineHeight: 1 }}>{totalCount}</p>
                  <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>total zones</p>
                </div>
              </div>
            </div>

            {/* Selected postcode detail */}
            {selectedRow ? (
              <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(149,212,179,0.2)', borderRadius: 10, padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', margin: 0 }}>
                      {suburbLookup[String(selectedRow.postcode)] || `Postcode ${selectedRow.postcode}`}
                    </p>
                    <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', margin: '2px 0 0' }}>{selectedRow.postcode}</p>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', lineHeight: 1, padding: 4, flexShrink: 0 }}
                  >✕</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <Row label="Demand risk">
                    <span style={{ color: riskColorFromLabel(selectedRow.risk_label || toneFromLabel(selectedRow.risk_label)), fontWeight: 700, fontSize: '0.82rem' }}>
                      {(selectedRow.demand_risk_score * 100).toFixed(0)}%
                      {' — '}
                      {selectedRow.risk_label
                        ? selectedRow.risk_label.charAt(0).toUpperCase() + selectedRow.risk_label.slice(1)
                        : 'No score'}
                    </span>
                  </Row>
                  {selectedRow.irsd_score != null && (
                    <Row label="SEIFA IRSD">
                      <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.82rem' }}>{selectedRow.irsd_score}</span>
                    </Row>
                  )}
                  <Row label="Active listings">
                    <span style={{ fontWeight: 700, color: selectedRow.active_listings === 0 ? '#fc9174' : '#95d4b3', fontSize: '0.82rem' }}>
                      {selectedRow.active_listings}
                    </span>
                  </Row>
                  <Row label="Total supply">
                    <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.8)', fontSize: '0.82rem' }}>
                      {selectedRow.total_supply} portions
                    </span>
                  </Row>
                  {selectedRow.regional_category && (
                    <Row label="Region">
                      <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)' }}>{selectedRow.regional_category}</span>
                    </Row>
                  )}
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', textAlign: 'center', marginTop: 8 }}>
                Click any postcode on the map to see its details
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', gap: 8 }}>
      <span style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  )
}
