import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAvailableListings, getPredictionRiskScores } from '../services/api'
import { buildDemandInsights } from '../constants/demandInsights'
import { buildDemandInsightsFromRiskScores } from '../utils/predictionAdapters'
import OrgFeatureNav from '../components/OrgFeatureNav'
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

  const savedOrgSession = (() => {
    try {
      return JSON.parse(window.localStorage.getItem('crisislink-org-session') || '{}')
    } catch (storageError) {
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
      } catch (predictionError) {
        // Prediction service is optional during frontend-only development.
      }

      const availableData = await getAvailableListings({ status: 'available' })
      setDemandInsights(buildDemandInsights(Array.isArray(availableData) ? availableData : []))
    } catch (loadError) {
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
    const fallbackAlert = demandInsights.topAlert || demandInsights.fallbackTopAlert
    return fallbackAlert ? [fallbackAlert] : []
  }, [demandInsights.alerts, demandInsights.fallbackTopAlert, demandInsights.topAlert])

  const [alertToneFilter, setAlertToneFilter] = useState('all')
  const [selectedAlertPostcode, setSelectedAlertPostcode] = useState('')

  const spikeAlertCount = useMemo(
    () => demandAlerts.filter((alert) => Number(alert.demandLift || 0) >= DEMAND_SPIKE_THRESHOLD).length,
    [demandAlerts],
  )

  const averageConfidence = useMemo(() => {
    if (demandAlerts.length === 0) return 0
    const totalConfidence = demandAlerts.reduce((sum, alert) => sum + Number(alert.confidence || 0), 0)
    return Math.round(totalConfidence / demandAlerts.length)
  }, [demandAlerts])

  function getDemandTone(demandLift) {
    const demandLiftValue = Number(demandLift || 0)
    if (demandLiftValue >= DEMAND_CRITICAL_THRESHOLD) return 'critical'
    if (demandLiftValue >= DEMAND_SPIKE_THRESHOLD) return 'high'
    return 'watch'
  }

  function getDemandToneMeta(demandLift) {
    const tone = getDemandTone(demandLift)
    if (tone === 'critical') {
      return {
        tone,
        filterLabel: t('dashboard.intelligence.filterSpike', 'Spike alerts'),
        detailLabel: t('dashboard.intelligence.primaryLabel', 'Demand spike alert'),
        sectionLabel: t('dashboard.intelligence.spikeItem', 'Spike alert'),
        cardCue: t('dashboard.intelligence.priorityHigh', 'High priority'),
        badgeLabel: t('dashboard.intelligence.priorityHigh', 'High priority'),
      }
    }
    if (tone === 'high') {
      return {
        tone,
        filterLabel: t('dashboard.intelligence.filterSpike', 'Spike alerts'),
        detailLabel: t('dashboard.intelligence.primaryLabel', 'Demand spike alert'),
        sectionLabel: t('dashboard.intelligence.spikeItem', 'Spike alert'),
        cardCue: t('dashboard.intelligence.priorityRisk', 'Demand spike risk'),
        badgeLabel: t('dashboard.intelligence.priorityRisk', 'Demand spike risk'),
      }
    }
    return {
      tone,
      filterLabel: t('dashboard.intelligence.filterWatch', 'Watch items'),
      detailLabel: t('dashboard.intelligence.watchPrimaryLabel', 'Demand watch item'),
      sectionLabel: t('dashboard.intelligence.watchItem', 'Watch item'),
      cardCue: t('dashboard.intelligence.watchItem', 'Watch item'),
      badgeLabel: t('dashboard.intelligence.emergingRisk', 'Emerging demand risk'),
    }
  }

  const filteredDemandAlerts = useMemo(() => {
    if (alertToneFilter === 'all') return demandAlerts
    if (alertToneFilter === 'critical') {
      return demandAlerts.filter((alert) => getDemandTone(alert.demandLift) === 'critical')
    }
    if (alertToneFilter === 'spike') {
      return demandAlerts.filter((alert) => Number(alert.demandLift || 0) >= DEMAND_SPIKE_THRESHOLD)
    }
    return demandAlerts.filter((alert) => Number(alert.demandLift || 0) < DEMAND_SPIKE_THRESHOLD)
  }, [alertToneFilter, demandAlerts])

  useEffect(() => {
    setSelectedAlertPostcode((currentSelection) => {
      if (filteredDemandAlerts.some((alert) => alert.postcode === currentSelection)) {
        return currentSelection
      }
      return filteredDemandAlerts[0]?.postcode || ''
    })
  }, [filteredDemandAlerts])

  const selectedAlert = useMemo(() => {
    if (filteredDemandAlerts.length === 0) return null
    return (
      filteredDemandAlerts.find((alert) => alert.postcode === selectedAlertPostcode) || filteredDemandAlerts[0]
    )
  }, [filteredDemandAlerts, selectedAlertPostcode])

  const getConfidenceLevel = (confidence) => {
    const confidenceValue = Number(confidence || 0)
    if (confidenceValue >= HIGH_CONFIDENCE_THRESHOLD) {
      return {
        tone: 'high',
        label: t('dashboard.intelligence.confidenceHigh', 'High confidence'),
      }
    }
    if (confidenceValue >= MEDIUM_CONFIDENCE_THRESHOLD) {
      return {
        tone: 'medium',
        label: t('dashboard.intelligence.confidenceMedium', 'Medium confidence'),
      }
    }
    return {
      tone: 'watch',
      label: t('dashboard.intelligence.confidenceLow', 'Low confidence'),
    }
  }

  const handleRespondToNeed = (zone) => {
    navigate('/form', {
      state: {
        orgMode: true,
        orgCode,
        orgName: `Organization ${orgCode}`,
        focusPostcode: zone?.postcode || '',
      },
    })
  }

  const responseWindowLabel = selectedAlert?.predictedWindow || 'next 3-5 days'
  const selectedConfidenceLevel = getConfidenceLevel(selectedAlert?.confidence)
  const selectedAlertTone = getDemandToneMeta(selectedAlert?.demandLift)
  const isSelectedWatchItem = selectedAlertTone.tone === 'watch'
  const primaryPanelLabel = selectedAlertTone.detailLabel
  const priorityLabel = selectedAlertTone.badgeLabel
  const triggerCopy = isSelectedWatchItem
    ? t('dashboard.intelligence.watchTriggerRule', {
        demandLift: selectedAlert?.demandLift,
        threshold: DEMAND_SPIKE_THRESHOLD,
        defaultValue: 'Watch signal: +{{demandLift}}% demand lift (alert threshold: >{{threshold}}%)',
      })
    : t('dashboard.intelligence.triggerRule', {
        demandLift: selectedAlert?.demandLift,
        threshold: DEMAND_SPIKE_THRESHOLD,
        defaultValue: 'Alert triggered: +{{demandLift}}% demand lift (threshold: >{{threshold}}%)',
      })

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

        <section className="org-page-intro org-hero-card">
          <div className="org-page-heading-row">
            <div className="org-page-heading">
              <h1 className="board-title org-page-title">
                {t('dashboard.workspaceTitle', 'Organization workspace')}
              </h1>
              <p className="org-page-subtitle">
                {t('dashboard.workspaceSubtitle', 'Review live supply and demand signals for nearby service areas.')}
              </p>
              <div className="org-page-meta org-page-meta-pill">
                <span className="material-symbols-outlined">domain</span>
                <span>{t('dashboard.signedInAs', { orgCode })}</span>
              </div>
            </div>
          </div>
        </section>

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
            <div className="org-demand-heading">
              <h2 id="org-demand-intelligence">{t('dashboard.intelligence.title')}</h2>
              <p>{t('dashboard.intelligence.subtitle')}</p>
              <div className="org-demand-summary-row" aria-live="polite">
                <div className="org-demand-summary-stat">
                  <span className="org-demand-summary-label">{t('common.alerts')}</span>
                  <strong>
                    {t('dashboard.intelligence.summarySpikeCount', {
                      count: spikeAlertCount,
                      defaultValue: '{{count}} spike alerts',
                    })}
                  </strong>
                </div>
                <div className="org-demand-summary-stat">
                  <span className="org-demand-summary-label">{t('dashboard.intelligence.fields.confidence')}</span>
                  <strong>
                    {t('dashboard.intelligence.summaryAvgConfidence', {
                      confidence: averageConfidence,
                      defaultValue: 'Avg confidence {{confidence}}%',
                    })}
                  </strong>
                </div>
                <div className="org-alert-filter-row">
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
              </div>
              {SHOW_SAMPLE_HINT && demandInsights.source !== 'prediction' ? (
                <p className="org-demand-data-note">{t('dashboard.intelligence.sampleNote')}</p>
              ) : null}
            </div>

            <div className="org-demand-layout">
              <div className="org-demand-alert-grid" role="list" aria-label={t('dashboard.intelligence.postcodeAlerts', 'Postcode alerts')}>
                {filteredDemandAlerts.map((alert) => {
                  const confidenceLevel = getConfidenceLevel(alert.confidence)
                  const demandToneMeta = getDemandToneMeta(alert.demandLift)
                  const isSelected = selectedAlert.postcode === alert.postcode
                  return (
                    <button
                      key={alert.postcode}
                      type="button"
                      role="listitem"
                      className={[
                        'org-demand-alert-card',
                        `org-demand-alert-card--${demandToneMeta.tone}`,
                        isSelected ? 'is-active' : '',
                      ]
                        .join(' ')
                        .trim()}
                      onClick={() => setSelectedAlertPostcode(alert.postcode)}
                    >
                      <div className="org-demand-alert-card-eyebrow">
                        {isSelected ? (
                          <span className="org-demand-alert-card-selected">
                            {t('dashboard.intelligence.selected', 'Selected')}
                          </span>
                        ) : (
                          <span className={`org-demand-alert-card-signal org-demand-alert-card-signal--${demandToneMeta.tone}`}>
                            {demandToneMeta.cardCue}
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
                      <p className="org-demand-alert-card-window">{alert.predictedWindow || '-'}</p>
                      <div className="org-demand-alert-card-factors">
                        {(alert.contributingFactors || []).slice(0, 2).join(' · ') || '-'}
                      </div>
                      <p className={`org-demand-alert-card-confidence org-demand-alert-card-confidence--${confidenceLevel.tone}`}>
                        {confidenceLevel.label} · {alert.confidence}%
                      </p>
                    </button>
                  )
                })}
              </div>

              <article className="org-demand-primary-card">
                <div className="org-demand-primary-topline">
                  <span className="material-symbols-outlined">notifications_active</span>
                  <span>{primaryPanelLabel}</span>
                </div>

                <div className="org-demand-detail-anchor">
                  <span className="org-demand-detail-anchor-label">{selectedAlertTone.sectionLabel}</span>
                  <strong>
                    {selectedAlert.suburb} ({selectedAlert.postcode})
                  </strong>
                </div>
                <div className="org-demand-alert-banner" aria-label={t('dashboard.intelligence.priorityCue', 'Alert priority and trigger')}>
                  <span className="material-symbols-outlined">warning</span>
                  <strong>{priorityLabel}</strong>
                </div>
                <p className="org-demand-trigger-text">{triggerCopy}</p>

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

                <div className="org-demand-evidence org-demand-triage">
                  <p className="org-demand-triage-title">{t('dashboard.intelligence.triageTitle', 'Triage guidance')}</p>
                  <div className="org-demand-evidence-row">
                    <span>{t('dashboard.intelligence.recommendedActionLabel', 'Recommended action')}</span>
                    <strong>
                      {t('dashboard.intelligence.recommendedActionValue', {
                        postcode: selectedAlert.postcode,
                        defaultValue: 'Source extra food for postcode {{postcode}}',
                      })}
                    </strong>
                  </div>
                  <div className="org-demand-evidence-row">
                    <span>{t('dashboard.intelligence.responseTimingLabel', 'Response timing')}</span>
                    <strong>
                      {t('dashboard.intelligence.responseTimingValue', {
                        window: responseWindowLabel,
                        defaultValue: 'Within the predicted window ({{window}})',
                      })}
                    </strong>
                  </div>
                </div>

                <div className="org-demand-metrics">
                  <div className="org-demand-metric">
                    <span>{t('dashboard.intelligence.metrics.demandLift')}</span>
                    <strong>+{selectedAlert.demandLift}%</strong>
                  </div>
                  <div className="org-demand-metric">
                    <span>{t('dashboard.intelligence.metrics.activePortions')}</span>
                    <strong>{selectedAlert.activePortions}</strong>
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
