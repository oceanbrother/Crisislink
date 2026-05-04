import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import OrgFeatureNav from '../components/OrgFeatureNav'
import WorkspaceHeader from '../components/WorkspaceHeader'
import PostcodeMap from '../components/PostcodeMap'
import { predictionApiClient } from '../services/api'
import suburbLookup from '../data/vic_postcode_suburbs.json'
import '../styles/LiveListingBoard.css'

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
  { key: 'high', color: RISK_COLORS.high },
  { key: 'medium-high', color: RISK_COLORS['medium-high'] },
  { key: 'medium-low', color: RISK_COLORS['medium-low'] },
  { key: 'low', color: RISK_COLORS.low },
  { key: 'none', color: RISK_COLORS.none },
]

export default function CoverageGapMap() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [riskData, setRiskData] = useState({})
  const [selectedPostcode, setSelectedPostcode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showInfoBanner, setShowInfoBanner] = useState(false)
  const savedOrgSession = (() => {
    try {
      return JSON.parse(window.localStorage.getItem('crisislink-org-session') || '{}')
    } catch {
      return {}
    }
  })()
  const orgCode = location.state?.orgCode || savedOrgSession.orgCode || 'HCFB-2841'

  useEffect(() => {
    predictionApiClient.get('/intelligence/supply-gaps')
      .then(res => {
        const map = {}
        for (const item of (res.data || [])) map[item.postcode] = item
        setRiskData(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const mapZones = useMemo(() =>
    Object.values(riskData).map(item => ({
      postcode: item.postcode,
      suburb: suburbLookup[String(item.postcode)] || String(item.postcode),
      tone: item.demand_risk_score >= 0.75 ? 'critical'
          : item.demand_risk_score >= 0.5 ? 'high'
          : item.demand_risk_score >= 0.25 ? 'watch'
          : 'healthy',
      metric: `Risk: ${(item.demand_risk_score * 100).toFixed(0)}%`,
    }))
  , [riskData])

  const selected = selectedPostcode ? { postcode: selectedPostcode, ...riskData[selectedPostcode] } : null

  const atRiskCount = Object.keys(riskData).length

  const MAP_HEIGHT = '58vh'

  return (
    <div className="live-listing-board org-role-board org-role-page">
      <WorkspaceHeader
        role="org"
        onBackClick={() => navigate('/org/listings', { state: { orgCode } })}
        onBrandClick={() => navigate('/org/listings', { state: { orgCode } })}
      />

      <main className="feed-content org-feed-content">
        <div className="workspace-nav-row org-area-nav-row">
          <OrgFeatureNav active="coverage-map" orgCode={orgCode} />
        </div>

        <section className="org-page-intro org-hero-card">
          <div className="org-page-heading-row">
            <div className="org-page-heading">
              <h1 className="board-title org-page-title">
                {t('dashboard.workspaceTitle', 'Organisation workspace')}
              </h1>
              <p className="org-page-subtitle">
                {t('dashboard.workspaceSubtitle', 'Review live supply and demand signals for nearby service areas.')}
              </p>
              <div className="org-page-meta org-page-meta-pill">
                <span className="material-symbols-outlined">domain</span>
                <span>{t('dashboard.signedInAs', { orgCode, defaultValue: `Signed in as ${orgCode}` })}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Info banner */}
        <section style={{
          background: '#e0f2fe',
          border: '1px solid #bae6fd',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
        }}>
          <button
            onClick={() => setShowInfoBanner(!showInfoBanner)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#0369a1',
              fontWeight: 600,
              fontSize: '0.9rem',
              width: '100%',
              textAlign: 'left',
              padding: 0,
            }}
            aria-expanded={showInfoBanner}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', flexShrink: 0 }}>info</span>
            <span>{t('coverageMap.aroundMeTitle', 'Around me – what this shows')}</span>
          </button>
          {showInfoBanner && (
            <p style={{
              marginTop: '0.75rem',
              fontSize: '0.85rem',
              color: '#0369a1',
              lineHeight: 1.5,
              margin: '0.75rem 0 0 0',
            }}>
              {t('coverageMap.aroundMeDescription', 'Shows what food is currently available near your organisation. Use it to see which food types and quantities are on offer in your local area, so you can avoid duplicating supply.')}
            </p>
          )}
        </section>

        <section style={{ display: 'flex', height: MAP_HEIGHT }}>
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
          <PostcodeMap
            zones={mapZones}
            selectedPostcode={selectedPostcode}
            onSelect={setSelectedPostcode}
            height={MAP_HEIGHT}
            defaultCenter={[-36.8, 144.9]}
            defaultZoom={7}
          />
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
                    {key === 'high' ? 'High (≥0.75)' :
                     key === 'medium-high' ? 'Medium-high (≥0.50)' :
                     key === 'medium-low' ? 'Medium-low (≥0.25)' :
                     key === 'low' ? 'Low (<0.25)' : 'No score yet'}
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
                  <p style={{ fontSize: '0.72rem', color: '#718096' }}>{selected.postcode}</p>
                </div>
                <button
                  onClick={() => setSelectedPostcode(null)}
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
                <Row label="Data source">
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 600, padding: '2px 7px', borderRadius: '999px',
                    background: selected.cold_start ? '#fff3cd' : selected.data_source === 'ai_forecast' ? '#e0f5ec' : '#edf2f7',
                    color: selected.cold_start ? '#7d5a00' : selected.data_source === 'ai_forecast' ? '#1a7c54' : '#4a5568',
                  }}>
                    {selected.cold_start ? '⏳ Learning' : selected.data_source === 'ai_forecast' ? '✦ AI forecast' : '⊖ Rule-based'}
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
