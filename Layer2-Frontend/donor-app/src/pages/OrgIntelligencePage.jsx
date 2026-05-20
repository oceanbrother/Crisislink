import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ChoroplethMap from '../components/ChoroplethMap'
import { predictionApiClient } from '../services/api'
import suburbLookup from '../data/vic_postcode_suburbs.json'
import '../styles/LiveListingBoard.css'
import logoUrl from '../assets/outbackshare-logo.png'
import textureImg from '../assets/post-food-texture.jpg'
import LanguageSwitcher from '../components/LanguageSwitcher'

function suburbName(postcode) {
  return suburbLookup[String(postcode)] || `Postcode ${postcode}`
}

const HIGH_CONF = 80
const MED_CONF  = 70

export default function OrgIntelligencePage() {
  const navigate = useNavigate()
  const location = useLocation()

  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')
  const [apiRows, setApiRows]           = useState([])
  const [activeView, setActiveView]     = useState('spikes')
  const [selectedPostcode, setSelectedPostcode] = useState('')
  const [alertToneFilter, setAlertToneFilter]   = useState('all')
  const [coverageFilter, setCoverageFilter]     = useState('all')

  const fromDonor = useRef(location.state?.fromDonor || false)
  const donorReturnPath = useRef(location.state?.returnPath || '/donor/listings')

  const savedOrgSession = (() => {
    if (fromDonor.current) return {}
    try { return JSON.parse(window.localStorage.getItem('crisislink-org-session') || '{}') }
    catch { return {} }
  })()
  const orgCode = fromDonor.current ? null : (location.state?.orgCode || savedOrgSession.orgCode || 'HCFB-2841')

  useEffect(() => {
    if (!fromDonor.current && orgCode) {
      window.localStorage.setItem('crisislink-org-session', JSON.stringify({ orgCode }))
    }
  }, [orgCode])

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    predictionApiClient.get('/intelligence/supply-gaps')
      .then(res => { if (!cancelled) setApiRows(res.data || []) })
      .catch(() => setError('load-failed'))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Alerts transform
  const alertsList = useMemo(() => apiRows
    .filter(item => item.demand_risk_score >= 0.5)
    .map(item => {
      const score = item.demand_risk_score
      return {
        postcode:       item.postcode,
        suburb:         suburbName(item.postcode),
        council:        item.regional_category || 'Service area',
        demandLift:     Math.max(0, Math.round((score - 0.4) * 75)),
        confidence:     Math.round(60 + score * 30),
        pressureScore:  Math.round(score * 100),
        householdsAtRisk: Math.round(score * 400),
        activePortions: item.total_supply || 0,
        alertReason:    `Risk score ${(score * 100).toFixed(0)}/100 · SEIFA ${Math.round(item.irsd_score || 950)}`,
        predictedWindow:'Next 7 days',
      }
    })
    .sort((a, b) => b.demandLift - a.demandLift),
  [apiRows])

  // Zones transform
  const zonesList = useMemo(() => apiRows.map(item => {
    const score          = item.demand_risk_score
    const supply         = item.total_supply || 0
    const estimatedDemand = Math.max(1, Math.round(score * 500))
    const shortfall       = Math.max(0, estimatedDemand - supply)
    const coverageRate    = Math.min(100, Math.round((supply / estimatedDemand) * 100))
    const coverageLevel   = supply > 0
      ? (coverageRate < 30 ? 'none' : coverageRate < 60 ? 'low' : coverageRate < 85 ? 'watch' : 'healthy')
      : (score >= 0.75 ? 'none' : score >= 0.5 ? 'low' : score >= 0.25 ? 'watch' : 'healthy')
    return {
      postcode:           item.postcode,
      suburb:             suburbName(item.postcode),
      council:            item.regional_category || 'Service area',
      estimatedDemand,
      activePortions:     supply,
      shortfallPortions:  shortfall,
      coverageRatePercent: coverageRate,
      coverageLevel,
      gapScore:           shortfall + (100 - coverageRate),
    }
  }).sort((a, b) => b.gapScore - a.gapScore), [apiRows])

  // Derived counts
  const spikeCount         = useMemo(() => alertsList.filter(a => a.pressureScore >= 75).length, [alertsList])
  const totalAtRisk        = useMemo(() => alertsList.reduce((s, a) => s + a.householdsAtRisk, 0), [alertsList])
  const avgConfidence      = useMemo(() => alertsList.length ? Math.round(alertsList.reduce((s, a) => s + a.confidence, 0) / alertsList.length) : 0, [alertsList])
  const hotspotZones       = useMemo(() => zonesList.filter(z => z.coverageLevel === 'none'), [zonesList])
  const atRiskZones        = useMemo(() => zonesList.filter(z => z.coverageLevel === 'low' || z.coverageLevel === 'watch'), [zonesList])
  const totalShortfall     = useMemo(() => zonesList.reduce((s, z) => s + z.shortfallPortions, 0), [zonesList])
  const avgCoverage        = useMemo(() => zonesList.length ? Math.round(zonesList.reduce((s, z) => s + z.coverageRatePercent, 0) / zonesList.length) : 0, [zonesList])
  const totalEstimatedNeed = useMemo(() => zonesList.reduce((s, z) => s + z.estimatedDemand, 0), [zonesList])

  // Filtered lists
  const filteredAlerts = useMemo(() => {
    if (alertToneFilter === 'spike') return alertsList.filter(a => a.pressureScore >= 75)
    if (alertToneFilter === 'watch') return alertsList.filter(a => a.pressureScore < 75)
    return alertsList
  }, [alertToneFilter, alertsList])

  const filteredZones = useMemo(() => {
    if (coverageFilter === 'critical') return zonesList.filter(z => z.coverageLevel === 'none')
    if (coverageFilter === 'low')      return zonesList.filter(z => z.coverageLevel === 'low')
    if (coverageFilter === 'watch')    return zonesList.filter(z => z.coverageLevel === 'watch')
    return zonesList
  }, [coverageFilter, zonesList])

  // Sync selectedPostcode
  const currentList = activeView === 'spikes' ? filteredAlerts : filteredZones
  useEffect(() => {
    setSelectedPostcode(cur =>
      currentList.some(i => i.postcode === cur) ? cur : currentList[0]?.postcode || ''
    )
  }, [currentList])

  // Map zones
  const mapZones = useMemo(() => {
    if (activeView === 'spikes') {
      return filteredAlerts.map(a => ({
        ...a,
        tone:   a.pressureScore >= 75 ? 'critical' : 'high',
        metric: `+${a.demandLift}% demand lift`,
      }))
    }
    return filteredZones.map(z => ({
      ...z,
      tone: z.coverageLevel === 'none' ? 'critical'
          : z.coverageLevel === 'low'  ? 'high'
          : z.coverageLevel === 'watch' ? 'watch'
          : 'healthy',
      metric: `${z.shortfallPortions} portions short`,
    }))
  }, [activeView, filteredAlerts, filteredZones])

  // Helpers
  // returns badge colour and label based on how urgent a demand alert is
  function getAlertToneMeta(pressureScore, demandLift) {
    if (pressureScore >= 75 || demandLift >= 30)
      return { tone: 'critical', badge: 'High priority', badgeColor: '#7c2e19', badgeBg: '#ffdbd2' }
    if (demandLift >= 20)
      return { tone: 'high',     badge: 'Spike risk',    badgeColor: '#9a442d', badgeBg: '#ffe8e1' }
    return { tone: 'watch',    badge: 'Watch item',    badgeColor: '#5a4500', badgeBg: '#fff3c4' }
  }

  // returns badge colour and label based on supply coverage level of a zone
  function getCoverageMeta(coverageLevel) {
    if (coverageLevel === 'none')  return { badge: 'No supply',    badgeColor: '#7c2e19', badgeBg: '#ffdbd2' }
    if (coverageLevel === 'low')   return { badge: 'Low coverage', badgeColor: '#9a442d', badgeBg: '#ffe8e1' }
    if (coverageLevel === 'watch') return { badge: 'Watch',        badgeColor: '#5a4500', badgeBg: '#fff3c4' }
    return                                { badge: 'Healthy',      badgeColor: '#0f5238', badgeBg: '#dcf5e7' }
  }

  // converts a numeric confidence score to a short text label
  function confLabel(c) {
    return c >= HIGH_CONF ? 'High conf' : c >= MED_CONF ? 'Med conf' : 'Low conf'
  }

  // navigates to the post food form with the selected postcode pre-filled
  const handlePost = (postcode) =>
    navigate('/form', { state: { orgMode: true, orgCode, orgName: `Organisation ${orgCode}`, focusPostcode: postcode || '' } })

  const ORG_NAV = [
    { label: 'Listings',          path: '/org/listings',     active: false },
    { label: 'Area Intelligence', path: '/org/intelligence', active: true  },
    { label: 'Around Me',         path: '/org/coverage-map', active: false },
  ]

  const metricCards = activeView === 'spikes' ? [
    { icon: 'warning',    label: 'Spike Alerts',       value: spikeCount,                              sub: `${alertsList.length} total flagged areas`,    accent: '#fc9174', prog: null },
    { icon: 'groups',     label: 'Households at Risk',  value: totalAtRisk.toLocaleString(),            sub: 'Across all flagged postcodes',               accent: '#95d4b3', prog: null },
    { icon: 'monitoring', label: 'Avg Confidence',      value: `${avgConfidence}%`,                    sub: 'Model prediction accuracy',                  accent: '#c2c4e5', prog: avgConfidence },
  ] : [
    { icon: 'warning',    label: 'Critical Shortfall',  value: `${totalShortfall.toLocaleString()} pt`, sub: 'Total unmet need across all zones',           accent: '#fc9174', prog: null },
    { icon: 'home',       label: 'Estimated Need',      value: totalEstimatedNeed.toLocaleString(),     sub: `${hotspotZones.length} zero-supply · ${atRiskZones.length} at risk`, accent: '#95d4b3', prog: null },
    { icon: 'monitoring', label: 'Avg Coverage',        value: `${avgCoverage}%`,                      sub: 'Supply vs estimated demand',                 accent: '#c2c4e5', prog: avgCoverage },
  ]

  const SPIKE_FILTERS = [{ key:'all', label:'All' }, { key:'spike', label:'Spike alerts' }, { key:'watch', label:'Watch items' }]
  const GAP_FILTERS   = [{ key:'all', label:'All' }, { key:'critical', label:'Critical gap' }, { key:'low', label:'Low coverage' }, { key:'watch', label:'Watch' }]
  const activeFilters = activeView === 'spikes' ? SPIKE_FILTERS : GAP_FILTERS
  const activeFilterVal = activeView === 'spikes' ? alertToneFilter : coverageFilter
  const setActiveFilter = activeView === 'spikes' ? setAlertToneFilter : setCoverageFilter

  // legend colours
  const spikeLegend = [{ color:'#e53030', label:'High demand' }, { color:'#e8711a', label:'Spike risk' }]
  const gapLegend   = [{ color:'#e53030', label:'No supply' }, { color:'#e8711a', label:'Low coverage' }, { color:'#d69e2e', label:'Watch' }, { color:'#1a9c67', label:'Healthy' }]
  const legend      = activeView === 'spikes' ? spikeLegend : gapLegend

  return (
    <div style={{ minHeight: '100vh', background: '#1b4332', fontFamily: 'Inter, system-ui, sans-serif', position: 'relative', overflowX: 'hidden' }}>

      {/* Organic bloom effects */}
      <div style={{ position: 'fixed', width: 800, height: 800, background: 'radial-gradient(circle, rgba(45,106,79,0.28) 0%, transparent 70%)', filter: 'blur(90px)', top: -300, left: -300, zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', width: 800, height: 800, background: 'radial-gradient(circle, rgba(45,106,79,0.28) 0%, transparent 70%)', filter: 'blur(90px)', bottom: -300, right: -300, zIndex: 0, pointerEvents: 'none' }} />

      {/* Texture overlay */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `url(${textureImg})`, backgroundSize: 'cover', opacity: 0.05, zIndex: 0, pointerEvents: 'none' }} />

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(27,67,50,0.84)', backdropFilter: 'blur(18px)', borderBottom: '1px solid rgba(149,212,179,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px', height: 68 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button type="button" onClick={() => fromDonor.current ? navigate(donorReturnPath.current) : navigate('/org/listings', { state: { orgCode } })}
            style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.75)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>arrow_back</span>
          </button>
          <button type="button" onClick={() => fromDonor.current ? navigate(donorReturnPath.current) : navigate('/org/listings', { state: { orgCode } })} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
            <img src={logoUrl} alt="OutBackShare" style={{ height: 30, width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.9 }} />
          </button>
        </div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {ORG_NAV.map(tab => (
            <button key={tab.label} type="button" onClick={() => navigate(tab.path, { state: { orgCode, fromDonor: fromDonor.current, returnPath: donorReturnPath.current } })}
              style={{ padding: '7px 16px', borderRadius: 8, border: tab.active ? '1px solid rgba(149,212,179,0.35)' : 'none', background: tab.active ? 'rgba(149,212,179,0.15)' : 'transparent', color: tab.active ? '#95d4b3' : 'rgba(255,255,255,0.65)', fontWeight: tab.active ? 700 : 500, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
              onMouseEnter={e => { if (!tab.active) e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { if (!tab.active) e.currentTarget.style.color = 'rgba(255,255,255,0.65)' }}
            >
              {tab.label}
            </button>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 999, padding: '5px 14px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#95d4b3' }}>groups</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{orgCode}</span>
            </div>
          )}
        </div>
      </header>

      <main style={{ position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto', padding: '52px 32px 80px' }}>

        {/* Page heading */}
        <header style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 52, fontWeight: 700, color: '#fff', letterSpacing: '-0.025em', margin: '0 0 8px 0', lineHeight: 1.05 }}>Area Intelligence</h1>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.60)', margin: 0, maxWidth: 580, lineHeight: 1.55 }}>
            Visualising community stewardship through real-time supply gap mapping and demand monitoring.
          </p>
        </header>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'rgba(255,255,255,0.6)', fontSize: 16 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 24, animation: 'spin 1s linear infinite' }}>progress_activity</span>
            Loading intelligence data…
          </div>
        ) : error ? (
          <div style={{ color: '#fc9174', fontSize: 16 }}>Could not load intelligence data. Check your connection.</div>
        ) : (
          <>
            {/* Metric cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, marginBottom: 36 }}>
              {metricCards.map(card => (
                <div key={card.label} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 22, padding: '24px 26px', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 19, color: card.accent, fontVariationSettings: "'FILL' 1" }}>{card.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{card.label}</span>
                  </div>
                  <div style={{ fontSize: 34, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.0 }}>{card.value}</div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: 0 }}>{card.sub}</p>
                  {card.prog !== null && (
                    <div style={{ height: 5, background: 'rgba(255,255,255,0.12)', borderRadius: 999, marginTop: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${card.prog}%`, background: card.accent, borderRadius: 999, transition: 'width 0.6s ease' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Tab switcher and filter pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
              {/* Main view tabs */}
              {[
                { view: 'spikes', icon: 'notifications_active', label: 'Demand Spikes' },
                { view: 'gaps',   icon: 'inventory_2',           label: 'Supply Gaps' },
              ].map(t => (
                <button key={t.view} type="button"
                  onClick={() => { setActiveView(t.view); setSelectedPostcode('') }}
                  style={{ padding: '10px 22px', borderRadius: 12, border: activeView === t.view ? '1px solid rgba(149,212,179,0.4)' : '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: activeView === t.view ? 700 : 500, background: activeView === t.view ? 'rgba(149,212,179,0.18)' : 'rgba(255,255,255,0.06)', color: activeView === t.view ? '#95d4b3' : 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', gap: 9, transition: 'all 0.15s', boxShadow: activeView === t.view ? '0 2px 12px rgba(0,0,0,0.2)' : 'none' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{t.icon}</span>
                  {t.label}
                </button>
              ))}

              {/* Context-aware filter pills */}
              <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
                {activeFilters.map(f => {
                  const isActive = activeFilterVal === f.key
                  return (
                    <button key={f.key} type="button" onClick={() => setActiveFilter(f.key)}
                      style={{ padding: '6px 14px', borderRadius: 999, border: `1px solid ${isActive ? 'rgba(149,212,179,0.5)' : 'rgba(255,255,255,0.15)'}`, background: isActive ? 'rgba(149,212,179,0.15)' : 'transparent', color: isActive ? '#95d4b3' : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: isActive ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s' }}
                    >
                      {f.label}
                    </button>
                  )
                })}
              </div>

              <div style={{ marginLeft: 'auto', fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                {currentList.length} {activeView === 'spikes' ? 'alert' : 'zone'}{currentList.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Bento grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 20, alignItems: 'start' }}>

              {/* Left: choropleth map */}
              <section style={{ background: '#fff', borderRadius: 26, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.35)', position: 'relative' }}>
                <ChoroplethMap
                  zones={mapZones}
                  selectedPostcode={selectedPostcode}
                  onSelect={setSelectedPostcode}
                  height={700}
                  defaultCenter={[-36.8, 144.9]}
                  defaultZoom={7}
                />
                {/* Floating legend */}
                <div style={{ position: 'absolute', bottom: 18, right: 18, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid #e8e4dd', borderRadius: 14, padding: '10px 16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px', boxShadow: '0 2px 16px rgba(0,0,0,0.12)', zIndex: 10, maxWidth: 260 }}>
                  {legend.map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: l.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#404943', fontWeight: 500 }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Right: Live Intel Feed */}
              <aside style={{ background: 'rgba(249,249,246,0.97)', borderRadius: 26, boxShadow: '0 8px 40px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', maxHeight: 700, backdropFilter: 'blur(12px)' }}>
                {/* Feed header */}
                <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid #f0f0ec', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f5238' }}>Live Intel Feed</h2>
                  <span style={{ background: 'rgba(154,68,45,0.1)', color: '#9a442d', padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>notifications_active</span>
                    Live
                  </span>
                </div>

                {/* Scrollable feed */}
                <div style={{ overflowY: 'auto', flex: 1, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {currentList.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10, color: '#707973' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 40 }}>filter_alt_off</span>
                      <p style={{ margin: 0, fontSize: 14, textAlign: 'center' }}>No {activeView === 'spikes' ? 'alerts' : 'gaps'} match the current filter.</p>
                    </div>
                  ) : activeView === 'spikes' ? (
                    filteredAlerts.map(alert => {
                      const meta       = getAlertToneMeta(alert.pressureScore, alert.demandLift)
                      const isSelected = selectedPostcode === alert.postcode
                      return (
                        <button key={alert.postcode} type="button"
                          onClick={() => setSelectedPostcode(isSelected ? '' : alert.postcode)}
                          style={{ width: '100%', textAlign: 'left', background: isSelected ? '#f0fbf5' : '#fff', border: `1.5px solid ${isSelected ? '#95d4b3' : 'rgba(154,68,45,0.15)'}`, borderRadius: 16, padding: '16px 16px 14px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', boxShadow: isSelected ? '0 3px 14px rgba(15,82,56,0.12)' : '0 1px 4px rgba(0,0,0,0.04)' }}
                          onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.borderColor = '#ffa894'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.08)' } }}
                          onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.borderColor = 'rgba(154,68,45,0.15)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)' } }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1c1b' }}>{alert.suburb}</div>
                              <div style={{ fontSize: 12, color: '#707973', marginTop: 1 }}>{alert.postcode} · {alert.council}</div>
                            </div>
                            <span style={{ background: meta.badgeBg, color: meta.badgeColor, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', marginLeft: 8, flexShrink: 0 }}>{meta.badge}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: isSelected ? 14 : 12 }}>
                            <span style={{ fontSize: 26, fontWeight: 800, color: '#9a442d', lineHeight: 1 }}>+{alert.demandLift}%</span>
                            <div>
                              <div style={{ fontSize: 12, color: '#707973' }}>demand lift</div>
                              <div style={{ fontSize: 12, color: '#707973' }}>{confLabel(alert.confidence)} · {alert.confidence}%</div>
                            </div>
                          </div>

                          {isSelected && (
                            <div style={{ borderTop: '1px solid #e8e4dd', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                {[
                                  { label: 'Predicted window', value: alert.predictedWindow },
                                  { label: 'Households at risk', value: alert.householdsAtRisk.toLocaleString() },
                                  { label: 'Active portions', value: alert.activePortions },
                                  { label: 'Pressure score', value: `${alert.pressureScore}/100` },
                                ].map(row => (
                                  <div key={row.label} style={{ background: '#f4f4f1', borderRadius: 10, padding: '8px 12px' }}>
                                    <div style={{ fontSize: 10, color: '#707973', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{row.label}</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1c1b' }}>{row.value}</div>
                                  </div>
                                ))}
                              </div>
                              <button type="button"
                                onClick={e => { e.stopPropagation(); handlePost(alert.postcode) }}
                                style={{ width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: '#0f5238', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                              >
                                Post extra food for this area
                              </button>
                            </div>
                          )}

                          {!isSelected && (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button type="button"
                                onClick={e => { e.stopPropagation(); handlePost(alert.postcode) }}
                                style={{ flex: 1, padding: '7px', borderRadius: 9, border: 'none', background: '#9a442d', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                              >
                                Post Food
                              </button>
                              <button type="button"
                                onClick={e => { e.stopPropagation(); setSelectedPostcode(alert.postcode) }}
                                style={{ flex: 1, padding: '7px', borderRadius: 9, border: '1px solid #e8e4dd', background: '#fff', color: '#404943', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                              >
                                Details
                              </button>
                            </div>
                          )}
                        </button>
                      )
                    })
                  ) : (
                    filteredZones.map(zone => {
                      const meta       = getCoverageMeta(zone.coverageLevel)
                      const isSelected = selectedPostcode === zone.postcode
                      return (
                        <button key={zone.postcode} type="button"
                          onClick={() => setSelectedPostcode(isSelected ? '' : zone.postcode)}
                          style={{ width: '100%', textAlign: 'left', background: isSelected ? '#f0fbf5' : '#fff', border: `1.5px solid ${isSelected ? '#95d4b3' : meta.badge === 'No supply' ? 'rgba(154,68,45,0.2)' : '#e8e4dd'}`, borderRadius: 16, padding: '16px 16px 14px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', boxShadow: isSelected ? '0 3px 14px rgba(15,82,56,0.12)' : '0 1px 4px rgba(0,0,0,0.04)' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1c1b' }}>{zone.suburb}</div>
                              <div style={{ fontSize: 12, color: '#707973', marginTop: 1 }}>{zone.postcode} · {zone.council}</div>
                            </div>
                            <span style={{ background: meta.badgeBg, color: meta.badgeColor, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', marginLeft: 8, flexShrink: 0 }}>{meta.badge}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 20, marginBottom: isSelected ? 14 : 12 }}>
                            <div>
                              <div style={{ fontSize: 26, fontWeight: 800, color: '#9a442d', lineHeight: 1 }}>{zone.shortfallPortions}</div>
                              <div style={{ fontSize: 12, color: '#707973' }}>portions short</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 26, fontWeight: 800, color: '#0f5238', lineHeight: 1 }}>{zone.coverageRatePercent}%</div>
                              <div style={{ fontSize: 12, color: '#707973' }}>coverage</div>
                            </div>
                          </div>

                          {isSelected && (
                            <div style={{ borderTop: '1px solid #e8e4dd', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                {[
                                  { label: 'Estimated need', value: zone.estimatedDemand },
                                  { label: 'Active portions', value: zone.activePortions },
                                  { label: 'Shortfall', value: zone.shortfallPortions },
                                  { label: 'Council', value: zone.council },
                                ].map(row => (
                                  <div key={row.label} style={{ background: '#f4f4f1', borderRadius: 10, padding: '8px 12px' }}>
                                    <div style={{ fontSize: 10, color: '#707973', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{row.label}</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1c1b' }}>{row.value}</div>
                                  </div>
                                ))}
                              </div>
                              <button type="button"
                                onClick={e => { e.stopPropagation(); handlePost(zone.postcode) }}
                                style={{ width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: '#0f5238', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                              >
                                Post food for this area
                              </button>
                            </div>
                          )}

                          {!isSelected && (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button type="button"
                                onClick={e => { e.stopPropagation(); handlePost(zone.postcode) }}
                                style={{ flex: 1, padding: '7px', borderRadius: 9, border: 'none', background: '#9a442d', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                              >
                                Post Food
                              </button>
                              <button type="button"
                                onClick={e => { e.stopPropagation(); setSelectedPostcode(zone.postcode) }}
                                style={{ flex: 1, padding: '7px', borderRadius: 9, border: '1px solid #e8e4dd', background: '#fff', color: '#404943', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                              >
                                Details
                              </button>
                            </div>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
