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

const DEMAND_SPIKE_THRESHOLD = 20
const DEMAND_CRITICAL_THRESHOLD = 30
const HIGH_CONFIDENCE_THRESHOLD = 80
const MEDIUM_CONFIDENCE_THRESHOLD = 70
const SHOW_SAMPLE_HINT = Boolean(import.meta.env.DEV)

const OrgAlertsPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()

  const [demandInsights, setDemandInsights] = useState({ source: 'loading', alerts: [], topAlert: null, fallbackTopAlert: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [alertToneFilter, setAlertToneFilter] = useState('all')
  const [selectedAlertPostcode, setSelectedAlertPostcode] = useState('')
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
    setError('')

    predictionApiClient.get('/intelligence/supply-gaps')
      .then(res => {
        if (isCancelled) return
        const rows = res.data || []
        const alerts = rows
          .filter(item => item.demand_risk_score >= 0.5)
          .map(item => {
            const score = item.demand_risk_score
            // Scale so 0.62 (medium-high) → ~17% watch, 0.82 (high) → ~32% critical
            const demandLift = Math.max(0, Math.round((score - 0.4) * 75))
            const name = suburbName(item.postcode)
            return {
              postcode: item.postcode,
              suburb: name,
              council: item.regional_category || 'Service area',
              demandLift,
              confidence: Math.round(60 + score * 30),
              pressureScore: Math.round(score * 100),
              householdsAtRisk: Math.round(score * 400),
              contributingFactors: [t('dashboard.intelligence.factorSeifa'), t('dashboard.intelligence.factorLowSupply')],
              alertReason: t('dashboard.intelligence.alertReason', { score: (score * 100).toFixed(0), irsd: Math.round(item.irsd_score || 950) }),
              activePortions: item.total_supply || 0,
              predictedWindow: t('dashboard.intelligence.nextSevenDays'),
            }
          })
          .sort((a, b) => b.demandLift - a.demandLift)
        setDemandInsights({ source: 'prediction', alerts, topAlert: alerts[0] || null, fallbackTopAlert: alerts[0] || null })
      })
      .catch(() => setError('alerts-load-failed'))
      .finally(() => { if (!isCancelled) setLoading(false) })

    return () => { isCancelled = true }
  }, [])

  const demandAlerts = useMemo(() => {
    if (Array.isArray(demandInsights.alerts) && demandInsights.alerts.length > 0) {
      return demandInsights.alerts
    }
    const fallback = demandInsights.topAlert || demandInsights.fallbackTopAlert
    return fallback ? [fallback] : []
  }, [demandInsights])

  const spikeAlertCount = useMemo(
    () => demandAlerts.filter((a) => a.pressureScore >= 75).length,
    [demandAlerts]
  )
  const watchAlertCount = useMemo(
    () => demandAlerts.filter((a) => a.pressureScore < 75).length,
    [demandAlerts]
  )

  const averageConfidence = useMemo(() => {
    if (demandAlerts.length === 0) return 0
    return Math.round(demandAlerts.reduce((s, a) => s + Number(a.confidence || 0), 0) / demandAlerts.length)
  }, [demandAlerts])

  function getDemandTone(demandLift) {
    const v = Number(demandLift || 0)
    if (v >= DEMAND_CRITICAL_THRESHOLD) return 'critical'
    if (v >= DEMAND_SPIKE_THRESHOLD) return 'high'
    return 'watch'
  }

  function getDemandToneMeta(demandLift) {
    const tone = getDemandTone(demandLift)
    if (tone === 'critical') return {
      tone,
      detailLabel: t('dashboard.intelligence.primaryLabel', 'Demand spike alert'),
      sectionLabel: t('dashboard.intelligence.spikeItem', 'Spike alert'),
      cardCue: t('dashboard.intelligence.priorityHigh', 'High priority'),
      badgeLabel: t('dashboard.intelligence.priorityHigh', 'High priority'),
    }
    if (tone === 'high') return {
      tone,
      detailLabel: t('dashboard.intelligence.primaryLabel', 'Demand spike alert'),
      sectionLabel: t('dashboard.intelligence.spikeItem', 'Spike alert'),
      cardCue: t('dashboard.intelligence.priorityRisk', 'Demand spike risk'),
      badgeLabel: t('dashboard.intelligence.priorityRisk', 'Demand spike risk'),
    }
    return {
      tone,
      detailLabel: t('dashboard.intelligence.watchPrimaryLabel', 'Demand watch item'),
      sectionLabel: t('dashboard.intelligence.watchItem', 'Watch item'),
      cardCue: t('dashboard.intelligence.watchItem', 'Watch item'),
      badgeLabel: t('dashboard.intelligence.emergingRisk', 'Emerging demand risk'),
    }
  }

  const filteredDemandAlerts = useMemo(() => {
    if (alertToneFilter === 'all') return demandAlerts
    if (alertToneFilter === 'spike') return demandAlerts.filter((a) => a.pressureScore >= 75)
    return demandAlerts.filter((a) => a.pressureScore < 75)
  }, [alertToneFilter, demandAlerts])

  useEffect(() => {
    if (alertToneFilter === 'watch' && watchAlertCount === 0) {
      setAlertToneFilter('all')
    }
  }, [alertToneFilter, watchAlertCount])

  useEffect(() => {
    setSelectedAlertPostcode((cur) =>
      filteredDemandAlerts.some((a) => a.postcode === cur) ? cur : filteredDemandAlerts[0]?.postcode || ''
    )
  }, [filteredDemandAlerts])

  const selectedAlert = useMemo(
    () => filteredDemandAlerts.find((a) => a.postcode === selectedAlertPostcode) || filteredDemandAlerts[0] || null,
    [filteredDemandAlerts, selectedAlertPostcode]
  )
  const hasAnyAlerts = demandAlerts.length > 0
  const hasFilteredAlerts = filteredDemandAlerts.length > 0

  const mapZones = useMemo(
    () => filteredDemandAlerts.map((a) => ({
      ...a,
      tone: getDemandTone(a.demandLift),
      metric: `+${a.demandLift}% demand lift`,
    })),
    [filteredDemandAlerts]
  )

  function getConfidenceLevel(confidence) {
    const v = Number(confidence || 0)
    if (v >= HIGH_CONFIDENCE_THRESHOLD) return { tone: 'high', label: t('dashboard.intelligence.confidenceHigh', 'High confidence') }
    if (v >= MEDIUM_CONFIDENCE_THRESHOLD) return { tone: 'medium', label: t('dashboard.intelligence.confidenceMedium', 'Medium confidence') }
    return { tone: 'watch', label: t('dashboard.intelligence.confidenceLow', 'Low confidence') }
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

  const selectedAlertTone = getDemandToneMeta(selectedAlert?.demandLift)
  const selectedConfidenceLevel = getConfidenceLevel(selectedAlert?.confidence)

  return (
    <div className="live-listing-board org-role-board org-role-page">
      <WorkspaceHeader
        role="org"
        onBackClick={() => navigate('/org/listings', { state: { orgCode } })}
        onBrandClick={() => navigate('/org/listings', { state: { orgCode } })}
      />

      <main className="feed-content org-feed-content">
        <div className="workspace-nav-row org-area-nav-row">
          <OrgFeatureNav active="alerts" orgCode={orgCode} />
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
                <span>{t('dashboard.signedInAs', { orgCode })}</span>
              </div>
            </div>

            <div className="org-coverage-summary">
              <div className="org-coverage-summary-card">
                <strong>{spikeAlertCount}</strong>
                <span>{t('dashboard.intelligence.filterSpike', 'Spike alerts')}</span>
              </div>
              <div className="org-coverage-summary-card">
                <strong>{demandAlerts.length}</strong>
                <span>{t('common.alerts', 'Alerts')}</span>
              </div>
              <div className="org-coverage-summary-card">
                <strong>{averageConfidence}%</strong>
                <span>{t('dashboard.intelligence.fields.confidence', 'Confidence')}</span>
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
            <span>{t('dashboard.intelligence.alertsTitle', 'Demand alerts – what this shows')}</span>
          </button>
          {showInfoBanner && (
            <p style={{
              marginTop: '0.75rem',
              fontSize: '0.85rem',
              color: '#0369a1',
              lineHeight: 1.5,
              margin: '0.75rem 0 0 0',
            }}>
              {t('dashboard.intelligence.alertsDescription', 'Flags postcodes where our model predicts a spike in demand over the next 7 days — areas likely to face a shortage soon. Check these to decide where to encourage more donations before the gap appears.')}
            </p>
          )}
        </section>

        {SHOW_SAMPLE_HINT && demandInsights.source !== 'prediction' ? (
          <p className="org-coverage-data-note org-coverage-data-note--standalone">
            {t('dashboard.intelligence.sampleNote', 'Sample demand indicators shown — forecasting feed pending.')}
          </p>
        ) : null}

        {loading ? (
          <div className="loading-state empty-state--rich">
            <p>{t('common.loading')}</p>
          </div>
        ) : error ? (
          <section className="empty-state empty-state--rich" aria-live="polite">
            <span className="material-symbols-outlined empty-state-icon">warning</span>
            <h2 className="empty-state-title">{t('dashboard.intelligence.loadErrorTitle')}</h2>
            <p className="empty-state-subtitle">{t('dashboard.intelligence.loadErrorHint')}</p>
          </section>
        ) : !hasAnyAlerts ? (
          <section className="empty-state empty-state--rich" aria-live="polite">
            <span className="material-symbols-outlined empty-state-icon">notifications_off</span>
            <h2 className="empty-state-title">{t('dashboard.intelligence.noDataTitle')}</h2>
            <p className="empty-state-subtitle">{t('dashboard.intelligence.noDataHint')}</p>
          </section>
        ) : (
          <section className="org-demand-section" aria-labelledby="org-demand-intelligence">
            <div className="org-demand-layout">

              {/* Left: map + compact alert list */}
              <div className="org-demand-map-col">
                <div className="org-alert-filter-row org-alert-filter-row--top">
                  <button
                    type="button"
                    className={alertToneFilter === 'all' ? 'org-alert-filter-btn active' : 'org-alert-filter-btn'}
                    onClick={() => setAlertToneFilter('all')}
                  >
                    {t('common.all', 'All')}
                  </button>
                  <button
                    type="button"
                    className={alertToneFilter === 'spike' ? 'org-alert-filter-btn active' : 'org-alert-filter-btn'}
                    onClick={() => setAlertToneFilter('spike')}
                  >
                    {t('dashboard.intelligence.filterSpike', 'Spike alerts')}
                  </button>
                  <button
                    type="button"
                    className={alertToneFilter === 'watch' ? 'org-alert-filter-btn active' : 'org-alert-filter-btn'}
                    onClick={() => setAlertToneFilter('watch')}
                    disabled={watchAlertCount === 0}
                    title={watchAlertCount === 0 ? t('dashboard.intelligence.noWatchFilterHint', 'No watch items are currently available.') : ''}
                  >
                    {t('dashboard.intelligence.filterWatch', 'Watch items')}
                  </button>
                </div>

                <PostcodeMap
                  zones={mapZones}
                  selectedPostcode={selectedAlertPostcode}
                  onSelect={setSelectedAlertPostcode}
                  height={340}
                  defaultCenter={[-36.8, 144.9]}
                  defaultZoom={7}
                />

                {hasFilteredAlerts ? (
                  <div className="org-demand-alert-grid" role="list" aria-label={t('dashboard.intelligence.postcodeAlerts', 'Postcode alerts')}>
                    {filteredDemandAlerts.map((alert) => {
                      const confidenceLevel = getConfidenceLevel(alert.confidence)
                      const toneMeta = getDemandToneMeta(alert.demandLift)
                      const isSelected = selectedAlert?.postcode === alert.postcode
                      return (
                        <button
                          key={alert.postcode}
                          type="button"
                          role="listitem"
                          className={[
                            'org-demand-alert-card',
                            `org-demand-alert-card--${toneMeta.tone}`,
                            isSelected ? 'is-active' : '',
                          ].join(' ').trim()}
                          onClick={() => setSelectedAlertPostcode(alert.postcode)}
                        >
                          <div className="org-demand-alert-card-eyebrow">
                            {isSelected ? (
                              <span className="org-demand-alert-card-selected">
                                {t('dashboard.intelligence.selected', 'Selected')}
                              </span>
                            ) : (
                              <span className={`org-demand-alert-card-signal org-demand-alert-card-signal--${toneMeta.tone}`}>
                                {toneMeta.cardCue}
                              </span>
                            )}
                          </div>
                          <div className="org-demand-alert-card-main">
                            <div className="org-demand-alert-card-title-wrap">
                              <strong>{alert.suburb}</strong>
                              <span className="org-demand-alert-card-postcode">{alert.postcode}</span>
                            </div>
                            <div className="org-demand-alert-card-lift-wrap">
                              <span className="org-demand-alert-card-lift-label">
                                {t('dashboard.intelligence.metrics.demandLift')}
                              </span>
                              <strong className="org-demand-alert-card-lift">+{alert.demandLift}%</strong>
                            </div>
                          </div>
                          <p className={`org-demand-alert-card-confidence org-demand-alert-card-confidence--${confidenceLevel.tone}`}>
                            {confidenceLevel.label} · {alert.confidence}%
                          </p>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="org-demand-filter-empty" aria-live="polite">
                    <span className="material-symbols-outlined">filter_alt_off</span>
                    <div>
                      <strong>{t('dashboard.intelligence.noFilteredTitle', 'No alerts match this filter')}</strong>
                      <p>
                        {alertToneFilter === 'watch'
                          ? t('dashboard.intelligence.noFilteredWatchHint', 'No watch items are currently flagged. Try All or Spike alerts.')
                          : t('dashboard.intelligence.noFilteredHint', 'Try another alert filter to view available demand signals.')}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="org-demand-filter-reset-btn"
                      onClick={() => setAlertToneFilter('all')}
                    >
                      {t('dashboard.intelligence.showAllAlerts', 'Show all alerts')}
                    </button>
                  </div>
                )}
              </div>

              {/* Right: detail panel */}
              <article className="org-demand-primary-card">
                {selectedAlert ? (
                  <>
                <div className="org-demand-primary-topline">
                  <span className="material-symbols-outlined">notifications_active</span>
                  <span>{selectedAlertTone.detailLabel}</span>
                </div>

                <div className="org-demand-detail-anchor">
                  <span className="org-demand-detail-anchor-label">{selectedAlertTone.sectionLabel}</span>
                  <strong>{selectedAlert.suburb} ({selectedAlert.postcode})</strong>
                </div>

                <div className="org-demand-alert-banner">
                  <span className="material-symbols-outlined">warning</span>
                  <strong>{selectedAlertTone.badgeLabel}</strong>
                </div>

                <h3 className="org-demand-detail-title">
                  {t('dashboard.intelligence.primaryHeadline', {
                    suburb: selectedAlert.suburb,
                    postcode: selectedAlert.postcode,
                  })}
                </h3>
                <p className="org-demand-detail-reason">{selectedAlert.alertReason}</p>

                <div className="org-demand-evidence">
                  <div className="org-demand-evidence-row">
                    <span>{t('dashboard.intelligence.fields.predictedWindow')}</span>
                    <strong>{selectedAlert.predictedWindow || '-'}</strong>
                  </div>
                  <div className="org-demand-evidence-row">
                    <span>{t('dashboard.intelligence.fields.confidence')}</span>
                    <strong>{selectedConfidenceLevel.label} ({selectedAlert.confidence}%)</strong>
                  </div>
                  <div className="org-demand-evidence-row">
                    <span>{t('dashboard.intelligence.fields.factors')}</span>
                    <strong>{(selectedAlert.contributingFactors || []).join(', ')}</strong>
                  </div>
                </div>

                <div className="org-demand-metrics">
                  <div className="org-demand-metric">
                    <span>{t('dashboard.intelligence.metrics.demandLift')}</span>
                    <strong>+{selectedAlert.demandLift}%</strong>
                  </div>
                  <div className="org-demand-metric">
                    <span>{t('dashboard.intelligence.metrics.activePortions')}</span>
                    <strong>{selectedAlert.activePortions ?? '-'}</strong>
                  </div>
                  <div className="org-demand-metric">
                    <span>{t('dashboard.intelligence.metrics.households')}</span>
                    <strong>{selectedAlert.householdsAtRisk}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="org-demand-respond-btn"
                  onClick={() => handleRespondToNeed(selectedAlert)}
                >
                  {t('dashboard.intelligence.respondAction', 'Post extra food for this area')}
                </button>
                  </>
                ) : (
                  <div className="org-demand-detail-empty" aria-live="polite">
                    <span className="material-symbols-outlined">info</span>
                    <strong>{t('dashboard.intelligence.noFilteredTitle', 'No alerts match this filter')}</strong>
                    <p>{t('dashboard.intelligence.noFilteredHint', 'Try another alert filter to view available demand signals.')}</p>
                  </div>
                )}
              </article>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default OrgAlertsPage
