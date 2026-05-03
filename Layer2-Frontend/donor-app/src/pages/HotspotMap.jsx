import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import DonorFeatureNav from '../components/DonorFeatureNav'
import WorkspaceHeader from '../components/WorkspaceHeader'
import PostcodeMap from '../components/PostcodeMap'
import { predictionApiClient } from '../services/api'
import { getSavedDonorPostcode } from '../utils/donorPostcode'
import suburbLookup from '../data/vic_postcode_suburbs.json'

function severityColor(score) {
  if (score >= 0.75) return '#e53e3e'
  if (score >= 0.5) return '#dd6b20'
  if (score >= 0.25) return '#d69e2e'
  return '#38a169'
}

function severityLabel(score) {
  if (score >= 0.75) return 'Critical'
  if (score >= 0.5) return 'High need'
  if (score >= 0.25) return 'Watch'
  return 'Low'
}

const LEGEND = [
  { color: '#e53e3e', label: 'Critical (≥0.75)', key: 'critical' },
  { color: '#dd6b20', label: 'High need (≥0.50)', key: 'high' },
  { color: '#d69e2e', label: 'Watch (≥0.25)', key: 'watch' },
  { color: '#38a169', label: 'Low (<0.25)', key: 'low' },
]

const SEVERITY_FILTER_MAP = { critical: 0.75, high: 0.5, watch: 0.25, low: 0 }

const MAP_HEIGHT = 'calc(100vh - 112px)'

export default function HotspotMap() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [hotspots, setHotspots] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState('all')

  const donorPostcode = getSavedDonorPostcode()

  useEffect(() => {
    predictionApiClient.get('/predictions/hotspots', { params: { limit: 495 } })
      .then(res => setHotspots(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (severityFilter === 'all') return hotspots
    const minScore = SEVERITY_FILTER_MAP[severityFilter] ?? 0
    const maxScore = severityFilter === 'critical' ? 1
      : severityFilter === 'high' ? 0.75
      : severityFilter === 'watch' ? 0.5
      : 0.25
    return hotspots.filter(h => h.risk_score >= minScore && h.risk_score < maxScore)
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
    setSelected(hotspots.find(h => String(h.postcode) === String(postcode)) || null)
  }

  return (
    <>
      <WorkspaceHeader role="donor" onBackClick={() => navigate(-1)} />
      <DonorFeatureNav active="hotspots" />

      <div style={{ display: 'flex', height: MAP_HEIGHT }}>
        {/* Map */}
        <div style={{ flex: 1, position: 'relative', minHeight: 0, minWidth: 0 }}>
          {loading && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center', zIndex: 1000,
              background: 'rgba(255,255,255,0.85)',
            }}>
              <p style={{ color: '#4a5568' }}>{t('common.loading')}</p>
            </div>
          )}
          <PostcodeMap
            zones={mapZones}
            selectedPostcode={selected ? String(selected.postcode) : null}
            onSelect={handleSelect}
            height={MAP_HEIGHT}
            defaultCenter={[-36.8, 144.9]}
            defaultZoom={7}
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

          {/* Priority filter chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {[
              { key: 'all', label: 'All', color: '#4a5568' },
              { key: 'critical', label: `Critical · ${counts.critical}`, color: '#e53e3e' },
              { key: 'high', label: `High · ${counts.high}`, color: '#dd6b20' },
              { key: 'watch', label: `Watch · ${counts.watch}`, color: '#d69e2e' },
              { key: 'low', label: `Low · ${counts.low}`, color: '#38a169' },
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

          {/* Legend */}
          <div>
            <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              Severity
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {LEGEND.map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.75rem', color: '#4a5568' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <p style={{ fontSize: '0.75rem', color: '#a0aec0' }}>
            {`${filtered.length} hotspot${filtered.length !== 1 ? 's' : ''} shown`}
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
                <Row label="Severity">
                  <span style={{ color: severityColor(selected.risk_score), fontWeight: 600 }}>
                    {severityLabel(selected.risk_score)}
                  </span>
                </Row>
                <Row label="Risk score">
                  <span style={{ fontWeight: 500 }}>{(selected.risk_score * 100).toFixed(0)}%</span>
                </Row>
                <Row label="Data source">
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 600, padding: '2px 7px', borderRadius: '999px',
                    background: selected.cold_start ? '#fff3cd' : selected.data_source === 'ai_forecast' ? '#e0f5ec' : '#edf2f7',
                    color: selected.cold_start ? '#7d5a00' : selected.data_source === 'ai_forecast' ? '#1a7c54' : '#4a5568',
                  }}>
                    {selected.cold_start ? '⏳ Learning' : selected.data_source === 'ai_forecast' ? '✦ AI forecast' : '⊖ Rule-based'}
                  </span>
                </Row>
                <Row label="SEIFA IRSD">
                  <span style={{ fontWeight: 500 }}>{typeof selected.irsd_score === 'number' ? selected.irsd_score.toFixed(1) : selected.irsd_score}</span>
                </Row>
                <Row label="Active supply">
                  <span style={{ fontWeight: 500, color: selected.total_supply === 0 ? '#e53e3e' : '#38a169' }}>
                    {selected.total_supply} portions
                  </span>
                </Row>
              </div>

              {/* Post food here CTA */}
              <button
                onClick={() => navigate('/donor/post', {
                  state: {
                    postcode: donorPostcode,
                    targetPostcode: selected.postcode,
                  },
                })}
                style={{
                  width: '100%', padding: '0.6rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: '#e53e3e', color: '#fff', fontWeight: 600, fontSize: '0.85rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
              >
                Post food here
              </button>
            </div>
          ) : (
            <p style={{ fontSize: '0.75rem', color: '#a0aec0', fontStyle: 'italic' }}>
              Click a circle on the map to see postcode details.
            </p>
          )}
        </div>
      </div>
    </>
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
