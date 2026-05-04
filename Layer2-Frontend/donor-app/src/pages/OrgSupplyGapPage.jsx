import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PostcodeMap from '../components/PostcodeMap'
import { predictionApiClient } from '../services/api'
import suburbLookup from '../data/vic_postcode_suburbs.json'
import OrgFeatureNav from '../components/OrgFeatureNav'
import WorkspaceHeader from '../components/WorkspaceHeader'
import '../styles/LiveListingBoard.css'

function suburbName(postcode) {
  return suburbLookup[String(postcode)] || `Postcode ${postcode}`
}

const FILTER_OPTIONS = ['all', 'critical', 'low', 'watch']
const SHOW_SAMPLE_HINT = Boolean(import.meta.env.DEV)

const OrgSupplyGapPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()

  const [loading, setLoading] = useState(true)
  const [coverageFilter, setCoverageFilter] = useState('all')
  const [coverageInsights, setCoverageInsights] = useState({ source: 'loading', zones: [], hotspotZones: [], watchZones: [], totals: { zeroSupply: 0, atRisk: 0, averageCoverage: 0 }, highlightedZone: null })
  const [selectedPostcode, setSelectedPostcode] = useState('')
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
    window.localStorage.setItem('crisislink-org-session', JSON.stringify({ orgCode }))
  }, [orgCode])

  useEffect(() => {
    let isCancelled = false
    setLoading(true)

    predictionApiClient.get('/intelligence/supply-gaps')
      .then(res => {
        if (isCancelled) return
        const rows = res.data || []
        const zones = rows.map(item => {
          const score = item.demand_risk_score
          const supply = item.total_supply || 0
          const estimatedDemand = Math.max(1, Math.round(score * 500))
          const shortfall = Math.max(0, estimatedDemand - supply)
          const coverageRate = estimatedDemand > 0 ? Math.min(100, Math.round((supply / estimatedDemand) * 100)) : 0
          // When supply exists: use coverage rate. When no supply yet: classify by risk score so colours are differentiated.
          const coverageLevel = supply > 0
            ? (coverageRate < 30 ? 'none' : coverageRate < 60 ? 'low' : coverageRate < 85 ? 'watch' : 'healthy')
            : (score >= 0.75 ? 'none' : score >= 0.5 ? 'low' : score >= 0.25 ? 'watch' : 'healthy')
          const name = suburbName(item.postcode)
          return {
            postcode: item.postcode,
            suburb: name,
            council: item.regional_category || 'Service area',
            pressureScore: Math.round(score * 100),
            seifaScore: Math.round(item.irsd_score || 950),
            estimatedPopulationInNeed: Math.round(score * 300),
            listingCount: item.active_listings || 0,
            availableSupply: supply,
            activePortions: supply,
            estimatedDemand,
            shortfallPortions: shortfall,
            coverageRatePercent: coverageRate,
            coverageLevel,
            hasActiveSupply: supply > 0,
            gapScore: shortfall + (100 - coverageRate),
          }
        }).sort((a, b) => b.gapScore - a.gapScore)

        const hotspotZones = zones.filter(z => z.coverageLevel === 'none')
        const watchZones = zones.filter(z => z.coverageLevel === 'low' || z.coverageLevel === 'watch')
        setCoverageInsights({
          source: 'prediction',
          zones,
          hotspotZones,
          watchZones,
          totals: {
            zeroSupply: hotspotZones.length,
            atRisk: watchZones.length,
            averageCoverage: zones.length ? Math.round(zones.reduce((s, z) => s + z.coverageRatePercent, 0) / zones.length) : 0,
          },
          highlightedZone: hotspotZones[0] || zones[0] || null,
        })
      })
      .catch(() => {})
      .finally(() => { if (!isCancelled) setLoading(false) })

    return () => { isCancelled = true }
  }, [])

  const filteredZones = useMemo(() => {
    if (coverageFilter === 'all') return coverageInsights.zones
    if (coverageFilter === 'critical') return coverageInsights.zones.filter((z) => z.coverageLevel === 'none')
    if (coverageFilter === 'low') return coverageInsights.zones.filter((z) => z.coverageLevel === 'low')
    return coverageInsights.zones.filter((z) => z.coverageLevel === 'watch')
  }, [coverageFilter, coverageInsights.zones])

  useEffect(() => {
    if (filteredZones.length === 0) { setSelectedPostcode(''); return }
    setSelectedPostcode((cur) =>
      filteredZones.some((z) => z.postcode === cur) ? cur : filteredZones[0]?.postcode || ''
    )
  }, [filteredZones])

  const selectedZone = useMemo(
    () => filteredZones.find((z) => z.postcode === selectedPostcode) || null,
    [filteredZones, selectedPostcode]
  )

  const criticalZones = useMemo(() => coverageInsights.hotspotZones.slice(0, 4), [coverageInsights.hotspotZones])
  const watchZones = useMemo(() => coverageInsights.watchZones.slice(0, 4), [coverageInsights.watchZones])

  const mapZones = useMemo(() => filteredZones.map((z) => ({
    postcode: z.postcode,
    suburb: z.suburb,
    tone: z.coverageLevel === 'none' ? 'critical'
      : z.coverageLevel === 'low' ? 'high'
      : z.coverageLevel === 'watch' ? 'watch'
      : 'healthy',
    metric: `${z.shortfallPortions} portions short`,
  })), [filteredZones])

  const getCoverageMeta = (coverageLevel) => {
    if (coverageLevel === 'none') return {
      tone: 'none',
      label: t('dashboard.coverageInsights.coverage.none', 'No active supply'),
      cue: t('dashboard.coverageInsights.noSupplyBadge', 'Immediate action'),
      summary: t('dashboard.coverageInsights.noSupplyHint', 'No active listings covering this postcode.'),
    }
    if (coverageLevel === 'low') return {
      tone: 'low',
      label: t('dashboard.coverageInsights.coverage.low', 'Low coverage'),
      cue: t('dashboard.coverageInsights.lowCoverageBadge', 'Action recommended'),
      summary: t('dashboard.coverageInsights.lowCoverageHint', 'Supply is active but below expected local need.'),
    }
    if (coverageLevel === 'watch') return {
      tone: 'watch',
      label: t('dashboard.coverageInsights.coverage.watch', 'Watch'),
      cue: t('dashboard.coverageInsights.watchCoverageBadge', 'Monitor today'),
      summary: t('dashboard.coverageInsights.watchCoverageHint', 'Coverage is holding but demand pressure is rising.'),
    }
    return {
      tone: 'healthy',
      label: t('dashboard.coverageInsights.coverage.healthy', 'Healthy'),
      cue: t('dashboard.coverageInsights.healthyCoverageBadge', 'Coverage stable'),
      summary: t('dashboard.coverageInsights.healthyCoverageHint', 'Supply is keeping pace with estimated need.'),
    }
  }

  const handleRespondToNeed = (zone) => {
    navigate('/form', {
      state: {
        orgMode: true,
        orgCode,
        orgName: `Organisation ${orgCode}`,
        focusPostcode: zone?.postcode || '',
      },
    })
  }

  return (
    <div className="live-listing-board org-role-board org-role-page">
      <WorkspaceHeader
        role="org"
        onBackClick={() => navigate('/org/listings', { state: { orgCode } })}
        onBrandClick={() => navigate('/org/listings', { state: { orgCode } })}
      />

      <main className="feed-content org-feed-content">
        <div className="workspace-nav-row org-area-nav-row">
          <OrgFeatureNav active="gaps" orgCode={orgCode} />
        </div>

        {/* Compact hero */}
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

            <div className="org-coverage-summary">
              <div className="org-coverage-summary-card">
                <strong>{coverageInsights.totals.zeroSupply}</strong>
                <span>{t('dashboard.coverageInsights.summary.zeroSupply', 'Zero supply')}</span>
              </div>
              <div className="org-coverage-summary-card">
                <strong>{coverageInsights.totals.atRisk}</strong>
                <span>{t('dashboard.coverageInsights.summary.atRisk', 'At risk')}</span>
              </div>
              <div className="org-coverage-summary-card">
                <strong>{coverageInsights.totals.averageCoverage}%</strong>
                <span>{t('dashboard.coverageInsights.summary.avgCoverage', 'Avg coverage')}</span>
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
            <span>{t('dashboard.coverageInsights.gapsTitle', 'Supply gaps – what this shows')}</span>
          </button>
          {showInfoBanner && (
            <p style={{
              marginTop: '0.75rem',
              fontSize: '0.85rem',
              color: '#0369a1',
              lineHeight: 1.5,
              margin: '0.75rem 0 0 0',
            }}>
              {t('dashboard.coverageInsights.gapsDescription', 'Shows postcodes that right now have more demand than available supply — zero or very low food stock against estimated need. Use this to prioritise where to redirect surplus food or request emergency donations.')}
            </p>
          )}
        </section>

        {SHOW_SAMPLE_HINT && coverageInsights.source !== 'prediction' ? (
          <p className="org-coverage-data-note org-coverage-data-note--standalone">
            {t('dashboard.coverageInsights.sampleNote', 'Sample data — live coverage map pending.')}
          </p>
        ) : null}

        {loading ? (
          <div className="loading-state empty-state--rich">
            <p>{t('common.loading', 'Loading...')}</p>
          </div>
        ) : (
          <div className="org-coverage-grid">
            {/* Left: map + filters */}
            <article className="org-coverage-map-card">
              <div className="org-coverage-filter-row">
                {FILTER_OPTIONS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={coverageFilter === f ? 'org-coverage-filter-btn active' : 'org-coverage-filter-btn'}
                    onClick={() => setCoverageFilter(f)}
                  >
                    {f === 'all' ? t('common.all', 'All')
                      : f === 'critical' ? t('dashboard.coverageInsights.filterCritical', 'Critical gap')
                      : f === 'low' ? t('dashboard.coverageInsights.filterLow', 'Low coverage')
                      : t('dashboard.coverageInsights.filterWatch', 'Watch')}
                  </button>
                ))}
                <span className="org-coverage-results-count" aria-live="polite">
                  {filteredZones.length} {t('dashboard.coverageInsights.zonesUnit', 'postcodes')}
                </span>
              </div>

              <PostcodeMap
                zones={mapZones}
                selectedPostcode={selectedPostcode}
                onSelect={setSelectedPostcode}
                height={460}
                defaultCenter={[-36.8, 144.9]}
                defaultZoom={7}
              />

              <div className="org-coverage-legend" aria-label={t('dashboard.coverageInsights.legendLabel', 'Coverage legend')}>
                {['none', 'low', 'watch', 'healthy'].map((level) => (
                  <span key={level} className={`org-coverage-badge org-coverage-badge--${level}`}>
                    {getCoverageMeta(level).label}
                  </span>
                ))}
              </div>
            </article>

            {/* Right: detail + lists */}
            <div className="org-coverage-card-stack">
              <aside className="org-coverage-detail-card">
                {selectedZone ? (
                  <>
                    <div className={`org-coverage-detail-anchor org-coverage-detail-anchor--${getCoverageMeta(selectedZone.coverageLevel).tone}`}>
                      <span className="org-coverage-detail-anchor-label">
                        {t('dashboard.coverageInsights.detailEyebrow', 'Selected postcode gap')}
                      </span>
                      <strong>{selectedZone.suburb} · {selectedZone.postcode}</strong>
                    </div>

                    <div className={`org-coverage-detail-badge org-coverage-detail-badge--${getCoverageMeta(selectedZone.coverageLevel).tone}`}>
                      <span className="material-symbols-outlined">warning</span>
                      <strong>{getCoverageMeta(selectedZone.coverageLevel).cue}</strong>
                    </div>

                    <p className="org-coverage-detail-summary">
                      {getCoverageMeta(selectedZone.coverageLevel).summary}
                    </p>

                    <div className="org-coverage-detail-grid">
                      <div>
                        <span>{t('dashboard.coverageInsights.fields.estimatedNeed', 'Estimated need')}</span>
                        <strong>{selectedZone.estimatedDemand}</strong>
                      </div>
                      <div>
                        <span>{t('dashboard.coverageInsights.fields.activePortions', 'Active portions')}</span>
                        <strong>{selectedZone.activePortions}</strong>
                      </div>
                      <div>
                        <span>{t('dashboard.coverageInsights.fields.shortfall', 'Shortfall')}</span>
                        <strong>{selectedZone.shortfallPortions}</strong>
                      </div>
                      <div>
                        <span>{t('dashboard.coverageInsights.fields.council', 'Council')}</span>
                        <strong>{selectedZone.council}</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="org-coverage-respond-btn"
                      onClick={() => handleRespondToNeed(selectedZone)}
                    >
                      {t('dashboard.coverageInsights.respondButton', 'Post food for this area')}
                    </button>
                  </>
                ) : (
                  <div className="org-coverage-detail-placeholder">
                    <strong>{t('dashboard.coverageInsights.detailPlaceholderTitle', 'Choose a postcode')}</strong>
                    <p>{t('dashboard.coverageInsights.detailPlaceholderHint', 'Tap a circle on the map to see coverage details.')}</p>
                  </div>
                )}
              </aside>

              <section className="org-coverage-list-card">
                <div className="org-coverage-card-header">
                  <h3>{t('dashboard.coverageInsights.criticalListTitle', 'Critical now')}</h3>
                </div>
                <div className="org-coverage-list">
                  {criticalZones.length === 0 ? (
                    <div className="org-coverage-list-empty">
                      {t('dashboard.coverageInsights.criticalListEmpty', 'No critical postcodes right now.')}
                    </div>
                  ) : (
                    criticalZones.map((zone) => (
                      <button
                        key={`critical-${zone.postcode}`}
                        type="button"
                        className="org-coverage-list-row"
                        onClick={() => setSelectedPostcode(zone.postcode)}
                      >
                        <div>
                          <strong>{zone.suburb}</strong>
                          <span>{zone.postcode}</span>
                        </div>
                        <div className="org-coverage-list-meta">
                          <span className="org-coverage-badge org-coverage-badge--none">
                            {t('dashboard.coverageInsights.coverage.none', 'No active supply')}
                          </span>
                          <small>
                            {t('dashboard.coverageInsights.shortfallCopy', {
                              count: zone.shortfallPortions,
                              defaultValue: '{{count}} portions short',
                            })}
                          </small>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </section>

              <section className="org-coverage-list-card">
                <div className="org-coverage-card-header">
                  <h3>{t('dashboard.coverageInsights.watchListTitle', 'Watch next')}</h3>
                </div>
                <div className="org-coverage-list">
                  {watchZones.length === 0 ? (
                    <div className="org-coverage-list-empty">
                      {t('dashboard.coverageInsights.watchListEmpty', 'No watchlist postcodes right now.')}
                    </div>
                  ) : (
                    watchZones.map((zone) => (
                      <button
                        key={`watch-${zone.postcode}`}
                        type="button"
                        className="org-coverage-list-row"
                        onClick={() => setSelectedPostcode(zone.postcode)}
                      >
                        <div>
                          <strong>{zone.suburb}</strong>
                          <span>{zone.postcode}</span>
                        </div>
                        <div className="org-coverage-list-meta">
                          <span className={`org-coverage-badge org-coverage-badge--${zone.coverageLevel}`}>
                            {getCoverageMeta(zone.coverageLevel).label}
                          </span>
                          <small>{zone.coverageRatePercent}% {t('dashboard.coverageInsights.coverageRate', 'coverage')}</small>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default OrgSupplyGapPage
