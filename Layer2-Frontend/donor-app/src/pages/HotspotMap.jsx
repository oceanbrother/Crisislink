import React, { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import DonorFeatureNav from '../components/DonorFeatureNav'
import WorkspaceHeader from '../components/WorkspaceHeader'
import apiClient from '../services/api'
import { getSavedDonorPostcode } from '../utils/donorPostcode'
import suburbLookup from '../data/vic_postcode_suburbs.json'

function getFeatureCentroid(feature) {
  const geom = feature?.geometry
  if (!geom) return null
  let ring
  if (geom.type === 'Polygon') {
    ring = geom.coordinates[0]
  } else if (geom.type === 'MultiPolygon') {
    let maxLen = 0
    for (const poly of geom.coordinates) {
      if (poly[0].length > maxLen) { maxLen = poly[0].length; ring = poly[0] }
    }
  }
  if (!ring?.length) return null
  const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length
  const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length
  return [lat, lng]
}

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

function circleRadius(score) {
  if (score >= 0.75) return 14
  if (score >= 0.5) return 11
  if (score >= 0.25) return 8
  return 6
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
  const [centroids, setCentroids] = useState({})
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [noCentroids, setNoCentroids] = useState(false)
  const [severityFilter, setSeverityFilter] = useState('all')

  const donorPostcode = getSavedDonorPostcode()

  useEffect(() => {
    fetch('/vic_regional_postcodes.geojson')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { setNoCentroids(true); return }
        const map = {}
        for (const feature of data.features) {
          const pc = feature?.properties?.POA_CODE21 ?? feature?.properties?.postcode
          if (pc) {
            const c = getFeatureCentroid(feature)
            if (c) map[String(pc)] = c
          }
        }
        setCentroids(map)
      })
      .catch(() => setNoCentroids(true))

    apiClient.get('/predictions/all-risk-scores')
      .then(res => setHotspots((res.data || []).map(d => ({ ...d, risk_score: d.demand_risk_score }))))
      .catch(() => apiClient.get('/predictions/hotspots', { params: { limit: 495 } })
        .then(res => setHotspots(res.data || []))
        .catch(() => {}))
      .finally(() => setLoading(false))
  }, [])

  const mappable = useMemo(() => {
    const withCentroids = hotspots.filter(h => centroids[String(h.postcode)])
    if (severityFilter === 'all') return withCentroids
    const minScore = SEVERITY_FILTER_MAP[severityFilter] ?? 0
    const maxScore = severityFilter === 'critical' ? 1
      : severityFilter === 'high' ? 0.75
      : severityFilter === 'watch' ? 0.5
      : 0.25
    return withCentroids.filter(h => h.risk_score >= minScore && h.risk_score < maxScore)
  }, [hotspots, centroids, severityFilter])

  const counts = useMemo(() => {
    const all = hotspots.filter(h => centroids[String(h.postcode)])
    return {
      critical: all.filter(h => h.risk_score >= 0.75).length,
      high: all.filter(h => h.risk_score >= 0.5 && h.risk_score < 0.75).length,
      watch: all.filter(h => h.risk_score >= 0.25 && h.risk_score < 0.5).length,
      low: all.filter(h => h.risk_score < 0.25).length,
    }
  }, [hotspots, centroids])

  return (
    <>
      <WorkspaceHeader role="donor" />
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
          <MapContainer
            center={[-36.8, 144.8]}
            zoom={7}
            style={{ height: MAP_HEIGHT, width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />
            {mappable.map(h => (
              <CircleMarker
                key={h.postcode}
                center={centroids[String(h.postcode)]}
                radius={circleRadius(h.risk_score)}
                pathOptions={{
                  color: severityColor(h.risk_score),
                  fillColor: severityColor(h.risk_score),
                  fillOpacity: 0.75,
                  weight: 2,
                }}
                eventHandlers={{ click: () => setSelected(h) }}
              >
                <Tooltip>
                  <strong>{suburbLookup[String(h.postcode)] || h.postcode}</strong> ({h.postcode})<br />
                  {severityLabel(h.risk_score)} — {(h.risk_score * 100).toFixed(0)}%
                </Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
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
            {noCentroids
              ? 'Place vic_regional_postcodes.geojson in donor-app/public/ to show map positions.'
              : `${mappable.length} hotspot${mappable.length !== 1 ? 's' : ''} on map`}
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
