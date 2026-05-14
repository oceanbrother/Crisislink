import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import DonorFeatureNav from '../components/DonorFeatureNav'
import WorkspaceHeader from '../components/WorkspaceHeader'
import PostcodeMap from '../components/PostcodeMap'
import { predictionApiClient } from '../services/api'
import apiClient from '../services/api'
import { getSavedDonorPostcode } from '../utils/donorPostcode'
import suburbLookup from '../data/vic_postcode_suburbs.json'
import { POSTCODE_COORDS } from '../utils/postcodeCoords'
import '../styles/LiveListingBoard.css'

function haversineKm([lat1, lon1], [lat2, lon2]) {
  const R = 6371
  const toRad = d => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

function severityColor(score) {
  if (score >= 0.75) return '#e53e3e'
  if (score >= 0.5) return '#dd6b20'
  if (score >= 0.25) return '#d69e2e'
  return '#38a169'
}

function severityLabelKey(score) {
  if (score >= 0.75) return 'hotspots.map.sevCritical'
  if (score >= 0.5) return 'hotspots.map.sevHigh'
  if (score >= 0.25) return 'hotspots.map.sevWatch'
  return 'hotspots.map.sevLow'
}

const LEGEND = [
  { color: '#e53e3e', key: 'critical', labelKey: 'hotspots.map.legendCritical' },
  { color: '#dd6b20', key: 'high',     labelKey: 'hotspots.map.legendHigh' },
  { color: '#d69e2e', key: 'watch',    labelKey: 'hotspots.map.legendWatch' },
  { color: '#38a169', key: 'low',      labelKey: 'hotspots.map.legendLow' },
]

const SEVERITY_FILTER_MAP = { critical: 0.75, high: 0.5, watch: 0.25, low: 0 }

const MAP_HEIGHT = '58vh'

export default function HotspotMap() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [hotspots, setHotspots] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [severityFilter, setSeverityFilter] = useState('all')
  const [sortMode, setSortMode] = useState('priority')
  const [showRoute, setShowRoute] = useState(null) // { from, to } for route display
  const [locating, setLocating] = useState(false)
  const [liveSupply, setLiveSupply] = useState(null)

  const hasAutoSelectedRef = useRef(false)
  const donorPostcode = getSavedDonorPostcode()

  const loadHotspots = () => {
    setLoading(true)
    setFetchError(false)
    predictionApiClient.get('/predictions/hotspots', { params: { limit: 495 } })
      .then(res => setHotspots(res.data || []))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadHotspots() }, [])

  // Auto-select highest priority hotspot on first data load
  useEffect(() => {
    if (hotspots.length > 0 && !hasAutoSelectedRef.current) {
      setSelected(hotspots[0]) // API already sorts by risk_score desc
      hasAutoSelectedRef.current = true
    }
  }, [hotspots])


  // Fetch live supply count for selected postcode
  useEffect(() => {
    if (!selected) {
      setLiveSupply(null)
      return
    }
    apiClient.get('/listings', {
      params: { status: 'available', postcode: selected.postcode }
    }).then(res => {
      const count = Array.isArray(res.data) ? res.data.length : 0
      setLiveSupply(count)
    }).catch(() => setLiveSupply(null))
  }, [selected])

  const filtered = useMemo(() => {
    let list = hotspots
    if (severityFilter !== 'all') {
      const minScore = SEVERITY_FILTER_MAP[severityFilter] ?? 0
      const maxScore = severityFilter === 'critical' ? 1
        : severityFilter === 'high' ? 0.75
        : severityFilter === 'watch' ? 0.5
        : 0.25
      list = list.filter(h => h.risk_score >= minScore && h.risk_score < maxScore)
    }
    return list
  }, [hotspots, severityFilter])

  const mapZones = useMemo(() =>
    filtered.map(h => ({
      postcode: h.postcode,
      suburb: suburbLookup[String(h.postcode)] || String(h.postcode),
      tone: h.risk_score >= 0.75 ? 'critical'
          : h.risk_score >= 0.5 ? 'high'
          : h.risk_score >= 0.25 ? 'watch'
          : 'healthy',
      metric: `Risk: ${(h.risk_score * 100).toFixed(0)}%`,
    }))
  , [filtered])

  const counts = useMemo(() => ({
    critical: hotspots.filter(h => h.risk_score >= 0.75).length,
    high: hotspots.filter(h => h.risk_score >= 0.5 && h.risk_score < 0.75).length,
    watch: hotspots.filter(h => h.risk_score >= 0.25 && h.risk_score < 0.5).length,
    low: hotspots.filter(h => h.risk_score < 0.25).length,
  }), [hotspots])

  function handleSelect(postcode) {
    const selected = hotspots.find(h => String(h.postcode) === String(postcode)) || null
    setSelected(selected)
    if (selected && donorPostcode) {
      setShowRoute({ from: donorPostcode, to: selected.postcode })
    } else {
      setShowRoute(null)
    }
  }

  function handleSortByPriority() {
    setSortMode('priority')
    setShowRoute(null)
    // Re-select the highest priority in current filtered view
    const top = filtered[0] || hotspots.find(h => {
      if (severityFilter === 'all') return true
      const minScore = SEVERITY_FILTER_MAP[severityFilter] ?? 0
      const maxScore = severityFilter === 'critical' ? 1
        : severityFilter === 'high' ? 0.75
        : severityFilter === 'watch' ? 0.5 : 0.25
      return h.risk_score >= minScore && h.risk_score < maxScore
    })
    if (top) setSelected(top)
  }

  function handleSortByDistance() {
    if (!donorPostcode) {
      alert('Please set your postcode first')
      return
    }

    setLocating(true)
    const userCoords = POSTCODE_COORDS[donorPostcode]
    if (!userCoords) {
      setLocating(false)
      return
    }

    // Find nearest hotspot in current filtered list
    const withDist = filtered
      .map(h => ({ h, coords: POSTCODE_COORDS[h.postcode] }))
      .filter(({ coords: c }) => !!c)
      .sort((a, b) => haversineKm(userCoords, a.coords) - haversineKm(userCoords, b.coords))

    if (withDist.length > 0) {
      const nearest = withDist[0].h
      setSelected(nearest)
      setShowRoute({ from: donorPostcode, to: nearest.postcode })
    }
    setLocating(false)
  }

  const selectedDistKm = useMemo(() => {
    if (!donorPostcode || !selected) return null
    const userCoords = POSTCODE_COORDS[donorPostcode]
    const selectedCoords = POSTCODE_COORDS[selected.postcode]
    if (!userCoords || !selectedCoords) return null
    return haversineKm(userCoords, selectedCoords).toFixed(0)
  }, [donorPostcode, selected])

  return (
    <div className="live-listing-board donor-role-board donor-role-page">
      <WorkspaceHeader role="donor" onBackClick={() => navigate(-1)} />
      <main className="feed-content donor-feed-content">
        <div className="workspace-nav-row donor-area-nav-row">
          <DonorFeatureNav active="hotspots" />
        </div>

      <section style={{ display: 'flex', height: MAP_HEIGHT }}>
        {/* Map */}
        <div style={{ flex: 1, position: 'relative', minHeight: 0, minWidth: 0 }}>
          {(loading || fetchError) && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', zIndex: 1000,
              background: 'rgba(255,255,255,0.9)', gap: '0.75rem',
            }}>
              {loading
                ? <p style={{ color: '#4a5568' }}>{t('common.loading')}</p>
                : <>
                    <p style={{ color: '#e53e3e', fontWeight: 600, fontSize: '0.9rem' }}>
                      {t('hotspots.map.loadError')}
                    </p>
                    <button
                      onClick={loadHotspots}
                      style={{
                        padding: '0.5rem 1.2rem', borderRadius: '999px', border: 'none',
                        background: '#b86e10', color: '#fff', fontWeight: 600,
                        fontSize: '0.82rem', cursor: 'pointer',
                      }}
                    >
                      {t('hotspots.map.retry')}
                    </button>
                  </>
              }
            </div>
          )}
          <PostcodeMap
            zones={mapZones}
            selectedPostcode={selected ? String(selected.postcode) : null}
            onSelect={handleSelect}
            height={MAP_HEIGHT}
            defaultCenter={[-36.8, 144.9]}
            defaultZoom={7}
            userPostcode={donorPostcode || null}
            route={showRoute}
          />
        </div>

        {/* Side panel */}
        <div style={{
          width: '290px',
          background: '#fff',
          borderLeft: '1px solid #e2e8f0',
          overflowY: 'auto',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          flexShrink: 0,
        }}>
          <div>
            <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>
              {t('hotspots.title')}
            </p>
            <p style={{ fontSize: '0.78rem', color: '#718096' }}>
              {t('hotspots.subtitle')}
            </p>
          </div>

          {/* User postcode info */}
          {donorPostcode && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 10px',
              background: POSTCODE_COORDS[donorPostcode] ? '#ebf8ff' : '#fff3cd',
              border: `1px solid ${POSTCODE_COORDS[donorPostcode] ? '#90cdf4' : '#fde68a'}`,
              borderRadius: '8px',
            }}>
              <span style={{
                width: 12, height: 12, borderRadius: '50%',
                background: POSTCODE_COORDS[donorPostcode] ? '#3182ce' : '#a0aec0',
                flexShrink: 0,
                boxShadow: POSTCODE_COORDS[donorPostcode] ? '0 0 0 3px rgba(49,130,206,0.25)' : 'none',
              }} />
              <div style={{ fontSize: '0.75rem', lineHeight: 1.3 }}>
                <strong style={{ color: '#2c5282' }}>Your postcode: {donorPostcode}</strong>
                {!POSTCODE_COORDS[donorPostcode] && (
                  <div style={{ color: '#7d5a00', marginTop: '2px' }}>
                    Location not on map yet
                  </div>
                )}
              </div>
            </div>
          )}
          {!donorPostcode && (
            <div style={{
              padding: '8px 10px', background: '#fff3cd',
              border: '1px solid #fde68a', borderRadius: '8px',
              fontSize: '0.75rem', color: '#7d5a00',
            }}>
              No postcode saved. Please set your postcode first.
            </div>
          )}

          {/* Sort mode */}
          <div>
            <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
              {t('hotspots.map.sortBy')}
            </p>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={handleSortByPriority}
                style={{
                  flex: 1, fontSize: '0.75rem', padding: '5px 0', borderRadius: '999px', cursor: 'pointer',
                  border: '1.5px solid #b86e10',
                  background: sortMode === 'priority' ? '#b86e10' : 'transparent',
                  color: sortMode === 'priority' ? '#fff' : '#b86e10',
                  fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>priority_high</span>
                {t('hotspots.map.sortPriority')}
              </button>
              <button
                onClick={handleSortByDistance}
                disabled={locating}
                style={{
                  flex: 1, fontSize: '0.75rem', padding: '5px 0', borderRadius: '999px', cursor: locating ? 'wait' : 'pointer',
                  border: '1.5px solid #4a5568',
                  background: sortMode === 'distance' ? '#4a5568' : 'transparent',
                  color: sortMode === 'distance' ? '#fff' : '#4a5568',
                  fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  opacity: locating ? 0.6 : 1,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>near_me</span>
                {locating ? t('hotspots.map.locating') : t('hotspots.controls.distance')}
              </button>
            </div>
          </div>

          {/* Severity filter chips */}
          <div>
            <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
              {t('hotspots.map.filter')}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {[
                { key: 'all',      label: t('common.all'),                                              color: '#4a5568' },
                { key: 'critical', label: t('hotspots.map.chipCritical', { count: counts.critical }),   color: '#e53e3e' },
                { key: 'high',     label: t('hotspots.map.chipHigh',     { count: counts.high }),       color: '#dd6b20' },
                { key: 'watch',    label: t('hotspots.map.chipWatch',    { count: counts.watch }),      color: '#d69e2e' },
                { key: 'low',      label: t('hotspots.map.chipLow',      { count: counts.low }),        color: '#38a169' },
              ].map(({ key, label, color }) => (
                <button
                  key={key}
                  onClick={() => setSeverityFilter(key)}
                  style={{
                    fontSize: '0.72rem', padding: '3px 10px', borderRadius: '999px', cursor: 'pointer',
                    border: `1.5px solid ${color}`,
                    background: severityFilter === key ? color : 'transparent',
                    color: severityFilter === key ? '#fff' : color,
                    fontWeight: 600,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div>
            <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              {t('hotspots.map.severity')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {LEGEND.map(({ color, key, labelKey }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.75rem', color: '#4a5568' }}>{t(labelKey)}</span>
                </div>
              ))}
            </div>
          </div>

          <p style={{ fontSize: '0.75rem', color: '#a0aec0' }}>
            {t('hotspots.map.shown', { count: filtered.length })}
          </p>

          {selected ? (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>{suburbLookup[String(selected.postcode)] || `Postcode ${selected.postcode}`}</p>
                  <p style={{ fontSize: '0.72rem', color: '#718096' }}>{selected.postcode}{selected.regional_category ? ` · ${selected.regional_category}` : ''}</p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a0aec0', fontSize: '1rem' }}
                  aria-label={t('common.close')}
                >✕</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1rem' }}>
                <Row label={t('hotspots.map.labelSeverity')}>
                  <span style={{ color: severityColor(selected.risk_score), fontWeight: 600 }}>
                    {t(severityLabelKey(selected.risk_score))}
                  </span>
                </Row>
                <Row label={t('hotspots.map.labelRisk')}>
                  <span style={{ fontWeight: 500 }}>{(selected.risk_score * 100).toFixed(0)}%</span>
                </Row>
                {selectedDistKm !== null && (
                  <Row label={t('hotspots.map.labelDistance')}>
                    <span style={{ fontWeight: 500 }}>{selectedDistKm} km</span>
                  </Row>
                )}
                <Row label={t('hotspots.map.labelDataSource')}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 600, padding: '2px 7px', borderRadius: '999px',
                    background: selected.cold_start ? '#fff3cd' : selected.data_source === 'ai_forecast' ? '#e0f5ec' : '#edf2f7',
                    color: selected.cold_start ? '#7d5a00' : selected.data_source === 'ai_forecast' ? '#1a7c54' : '#4a5568',
                  }}>
                    {selected.cold_start ? t('hotspots.map.dataLearning') : selected.data_source === 'ai_forecast' ? t('hotspots.map.dataAi') : t('hotspots.map.dataRule')}
                  </span>
                </Row>
                <Row label={t('hotspots.map.labelSeifa')}>
                  <span style={{ fontWeight: 500 }}>{typeof selected.irsd_score === 'number' ? selected.irsd_score.toFixed(1) : selected.irsd_score}</span>
                </Row>
                <Row label={t('hotspots.map.labelSupply')}>
                  <span style={{ fontWeight: 500, color: (liveSupply ?? 0) === 0 ? '#e53e3e' : '#38a169' }}>
                    {liveSupply !== null ? t('hotspots.portions', { count: liveSupply }) : <span style={{ color: '#a0aec0' }}>Loading...</span>}
                  </span>
                </Row>
              </div>

              <button
                onClick={() => navigate('/donor/post', {
                  state: { postcode: donorPostcode, targetPostcode: selected.postcode },
                })}
                style={{
                  width: '100%', padding: '0.6rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: '#e53e3e', color: '#fff', fontWeight: 600, fontSize: '0.85rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
              >
                {t('hotspots.map.postHere')}
              </button>
            </div>
          ) : (
            <p style={{ fontSize: '0.75rem', color: '#a0aec0', fontStyle: 'italic' }}>
              {t('hotspots.map.clickHint')}
            </p>
          )}
        </div>
      </section>
      </main>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
      <span style={{ color: '#718096' }}>{label}</span>
      {children}
    </div>
  )
}
