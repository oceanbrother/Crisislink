import React, { useCallback, useEffect, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import { useTranslation } from 'react-i18next'
import OrgFeatureNav from '../components/OrgFeatureNav'
import WorkspaceHeader from '../components/WorkspaceHeader'
import apiClient from '../services/api'
import suburbLookup from '../data/vic_postcode_suburbs.json'

const RISK_COLORS = {
  high: '#e53e3e',
  'medium-high': '#dd6b20',
  'medium-low': '#d69e2e',
  low: '#38a169',
  none: '#a0aec0',
}

function riskColor(score) {
  if (score == null) return RISK_COLORS.none
  if (score >= 0.75) return RISK_COLORS.high
  if (score >= 0.5) return RISK_COLORS['medium-high']
  if (score >= 0.25) return RISK_COLORS['medium-low']
  return RISK_COLORS.low
}

function riskLabel(score) {
  if (score == null) return 'No data'
  if (score >= 0.75) return 'High'
  if (score >= 0.5) return 'Medium-high'
  if (score >= 0.25) return 'Medium-low'
  return 'Low'
}

const LEGEND = [
  { key: 'high', min: 0.75, color: RISK_COLORS.high },
  { key: 'medium-high', min: 0.5, color: RISK_COLORS['medium-high'] },
  { key: 'medium-low', min: 0.25, color: RISK_COLORS['medium-low'] },
  { key: 'low', min: 0, color: RISK_COLORS.low },
  { key: 'none', color: RISK_COLORS.none },
]

export default function CoverageGapMap() {
  const { t } = useTranslation()
  const [geojson, setGeojson] = useState(null)
  const [riskData, setRiskData] = useState({})
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [geoError, setGeoError] = useState(false)

  useEffect(() => {
    fetch('/vic_regional_postcodes.geojson')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => setGeojson(data))
      .catch(() => setGeoError(true))
      .finally(() => setLoading(false))

    apiClient.get('/predictions/all-risk-scores')
      .then(res => {
        const map = {}
        for (const item of (res.data || [])) map[item.postcode] = item
        setRiskData(map)
      })
      .catch(() => {
        // fallback to supply-gaps if new endpoint not yet available
        apiClient.get('/intelligence/supply-gaps')
          .then(res => {
            const map = {}
            for (const item of (res.data || [])) map[item.postcode] = item
            setRiskData(map)
          })
          .catch(() => {})
      })
  }, [])

  const styleFeature = useCallback((feature) => {
    const pc = feature?.properties?.POA_CODE21 ?? feature?.properties?.postcode
    const score = riskData[pc]?.demand_risk_score ?? null
    return {
      color: '#555555',
      weight: 0.8,
      fillColor: riskColor(score),
      fillOpacity: score != null ? 0.65 : 0.25,
    }
  }, [riskData])

  const onEachFeature = useCallback((feature, layer) => {
    const pc = feature?.properties?.POA_CODE21 ?? feature?.properties?.postcode
    const tipName = suburbLookup[String(pc)] || String(pc ?? '')
    layer.bindTooltip(`${tipName} (${pc})`, { sticky: true })
    layer.on('click', () => {
      const info = riskData[pc]
      setSelected({
        postcode: pc,
        demand_risk_score: info?.demand_risk_score ?? null,
        irsd_score: info?.irsd_score ?? null,
        regional_category: info?.regional_category ?? null,
        active_listings: info?.active_listings ?? null,
        total_supply: info?.total_supply ?? null,
      })
    })
  }, [riskData])

  const atRiskCount = Object.keys(riskData).length

  const MAP_HEIGHT = 'calc(100vh - 112px)'

  return (
    <>
      <WorkspaceHeader role="org" />
      <OrgFeatureNav active="coverage-map" />

      <div style={{ display: 'flex', height: MAP_HEIGHT }}>
        {/* Map area */}
        <div style={{ flex: 1, position: 'relative' }}>
          {loading && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center', zIndex: 10,
              background: 'rgba(255,255,255,0.85)',
            }}>
              <p style={{ color: '#4a5568' }}>{t('common.loading')}</p>
            </div>
          )}
          {geoError ? (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', zIndex: 10,
              background: '#fff', padding: '2rem', textAlign: 'center',
            }}>
              <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.5rem' }}>
                GeoJSON boundaries not loaded
              </p>
              <p style={{ fontSize: '0.8rem', color: '#718096', maxWidth: '360px' }}>
                Download the ABS Postal Areas GeoJSON, filter to the 495 regional Victorian
                postcodes using <code>Layer5-Data/postgresql/setup/filter_geojson.py</code>,
                and place the result at <code>donor-app/public/vic_regional_postcodes.geojson</code>.
              </p>
            </div>
          ) : (
            <MapContainer
              center={[-36.8, 144.8]}
              zoom={7}
              style={{ height: MAP_HEIGHT, width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              {geojson && (
                <GeoJSON
                  key={atRiskCount}
                  data={geojson}
                  style={styleFeature}
                  onEachFeature={onEachFeature}
                />
              )}
            </MapContainer>
          )}
        </div>

        {/* Side panel */}
        <div style={{
          width: '280px', background: '#fff', borderLeft: '1px solid #e2e8f0',
          overflowY: 'auto', padding: '1rem', display: 'flex',
          flexDirection: 'column', gap: '1rem',
        }}>
          {/* Legend */}
          <div>
            <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              {t('coverageMap.legend', 'Risk level')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {LEGEND.map(({ key, color }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: 14, height: 14, borderRadius: 3, background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.75rem', color: '#4a5568' }}>
                    {t(`coverageMap.risk.${key.replace('-', '')}`,
                      key === 'high' ? 'High (≥0.75)' :
                      key === 'medium-high' ? 'Medium-high (≥0.50)' :
                      key === 'medium-low' ? 'Medium-low (≥0.25)' :
                      key === 'low' ? 'Low (<0.25)' : 'No score yet')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary count */}
          <div>
            <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              {t('coverageMap.summary', 'At-risk postcodes')}
            </p>
            <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#e53e3e', lineHeight: 1 }}>{atRiskCount}</p>
            <p style={{ fontSize: '0.72rem', color: '#a0aec0', marginTop: '2px' }}>
              {t('coverageMap.riskCountHint', 'with demand risk > 0.5')}
            </p>
          </div>

          {/* Selected postcode detail */}
          {selected ? (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {suburbLookup[String(selected.postcode)] || `Postcode ${selected.postcode}`}
                  </p>
                  <p style={{ fontSize: '0.72rem', color: '#718096' }}>
                    {selected.postcode}{selected.regional_category ? ` · ${selected.regional_category}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a0aec0', fontSize: '1rem' }}
                  aria-label={t('common.close')}
                >✕</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Row label={t('coverageMap.riskScore', 'Demand risk')}>
                  <span style={{ color: riskColor(selected.demand_risk_score), fontWeight: 600 }}>
                    {selected.demand_risk_score != null
                      ? `${(selected.demand_risk_score * 100).toFixed(0)}% — ${riskLabel(selected.demand_risk_score)}`
                      : t('coverageMap.noScore', 'Not scored yet')}
                  </span>
                </Row>
                {selected.irsd_score != null && (
                  <Row label={t('coverageMap.seifaScore', 'SEIFA IRSD')}>
                    <span style={{ fontWeight: 500 }}>{selected.irsd_score}</span>
                  </Row>
                )}
                {selected.active_listings != null && (
                  <Row label={t('coverageMap.activeListings', 'Active listings')}>
                    <span style={{ fontWeight: 500, color: selected.active_listings === 0 ? '#e53e3e' : '#38a169' }}>
                      {selected.active_listings}
                    </span>
                  </Row>
                )}
                {selected.total_supply != null && (
                  <Row label={t('coverageMap.totalSupply', 'Total supply')}>
                    <span style={{ fontWeight: 500 }}>{selected.total_supply} portions</span>
                  </Row>
                )}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '0.75rem', color: '#a0aec0', fontStyle: 'italic' }}>
              {t('coverageMap.clickHint', 'Click a postcode on the map to see details.')}
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
