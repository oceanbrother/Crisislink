import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAvailableListings, getPredictionRiskScores } from '../services/api'
import { buildDemandInsights } from '../constants/demandInsights'
import { buildDemandInsightsFromRiskScores } from '../utils/predictionAdapters'
import OrgFeatureNav from '../components/OrgFeatureNav'
import PostcodeMap from '../components/PostcodeMap'
import '../styles/LiveListingBoard.css'

const DEMAND_SPIKE_THRESHOLD = 20
const DEMAND_CRITICAL_THRESHOLD = 30
const HIGH_CONFIDENCE_THRESHOLD = 80
const MEDIUM_CONFIDENCE_THRESHOLD = 70
const SHOW_SAMPLE_HINT = Boolean(import.meta.env.DEV)

const OrgAlertsPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()

  const [demandInsights, setDemandInsights] = useState(() => buildDemandInsights([]))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [alertToneFilter, setAlertToneFilter] = useState('all')
  const [selectedAlertPostcode, setSelectedAlertPostcode] = useState('')

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
    loadDemandInsights()
  }, [orgCode])

  const loadDemandInsights = async () => {
    setLoading(true)
    setError('')
    try {
      try {
        const riskScoreData = await getPredictionRiskScores()
        const predictionInsights = buildDemandInsightsFromRiskScores(riskScoreData)
        if (predictionInsights.alerts.length > 0) {
          setDemandInsights(predictionInsights)
          return
        }
      } catch {
        // prediction service optional
      }
      const availableData = await getAvailableListings({ status: 'available' })
      setDemandInsights(buildDemandInsights(Array.isArray(availableData) ? availableData : []))
    } catch {
      setError('alerts-load-failed')
      setDemandInsights(buildDemandInsights([]))
    } finally {
      setLoading(false)
    }
  }

  const demandAlerts = useMemo(() => {
    if (Array.isArray(demandInsights.alerts) && demandInsights.alerts.length > 0) {
      return demandInsights.alerts
    }
    const fallback = demandInsights.topAlert || demandInsights.fallbackTopAlert
    return fallback ? [fallback] : []
  }, [demandInsights])

  const spikeAlertCount = useMemo(
    () => demandAlerts.filter((a) => Number(a.demandLift || 0) >= DEMAND_SPIKE_THRESHOLD).length,
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
    if (alertToneFilter === 'critical') return demandAlerts.filter((a) => getDemandTone(a.demandLift) === 'critical')
    if (alertToneFilter === 'spike') return demandAlerts.filter((a) => Number(a.demandLift || 0) >= DEMAND_SPIKE_THRESHOLD)
    return demandAlerts.filter((a) => Number(a.demandLift || 0) < DEMAND_SPIKE_THRESHOLD)
  }, [alertToneFilter, demandAlerts])

  useEffect(() => {
    setSelectedAlertPostcode((cur) =>
      filteredDemandAlerts.some((a) => a.postcode === cur) ? cur : filteredDemandAlerts[0]?.postcode || ''
    )
  }, [filteredDemandAlerts])

  const selectedAlert = useMemo(
    () => filteredDemandAlerts.find((a) => a.postcode === selectedAlertPostcode) || filteredDemandAlerts[0] || null,
    [filteredDemandAlerts, selectedAlertPostcode]
  )

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
    navigate('/form', { state: { orgMode: true, orgCode, orgName: `Organization ${orgCode}`, focusPostcode: zone?.postcode || '' } })
  }

  const selectedAlertTone = getDemandToneMeta(selectedAlert?.demandLift)
  const selectedConfidenceLevel = getConfidenceLevel(selectedAlert?.confidence)

  return (
    <div className="live-listing-board org-role-board">
      <header className="navbar org-navbar">
        <div className="navbar-inner org-navbar-inner">
          <button className="brand-home-btn org-brand-btn" type="button" onClick={() => navigate('/')}>
            <span className="brand-home-title">{t('appName')}</span>
          </button>
        </div>
        <div className="navbar-divider" />
      </header>

      <main className="feed-content org-feed-content">
        <div className="org-area-nav-row">
          <OrgFeatureNav active="alerts" orgCode={orgCode} />
        </div>

        {/* Compact hero */}
        <section className="org-page-intro org-hero-card">
          <div className="org-page-heading-row">
            <div className="org-page-heading">
              <h1 className="board-title org-page-title">
                {t('dashboard.intelligence.title', 'Demand alerts')}
              </h1>
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
        ) : !selectedAlert ? (
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
                  >
                    {t('dashboard.intelligence.filterWatch', 'Watch items')}
                  </button>
                </div>

                <PostcodeMap
                  zones={mapZones}
                  selectedPostcode={selectedAlertPostcode}
                  onSelect={setSelectedAlertPostcode}
                  height={340}
                />

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
              </div>

              {/* Right: detail panel */}
              <article className="org-demand-primary-card">
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
              </article>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default OrgAlertsPage
