import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAvailableListings } from '../services/api'
import { buildDemandInsights } from '../constants/demandInsights'
import OrgFeatureNav from '../components/OrgFeatureNav'
import '../styles/LiveListingBoard.css'

const DEMAND_SPIKE_THRESHOLD = 20

const OrgAlertsPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()

  const [listings, setListings] = useState([])
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
    loadListings()
  }, [orgCode])

  const loadListings = async () => {
    setLoading(true)
    setError('')

    try {
      const availableData = await getAvailableListings({ status: 'available' })
      setListings(Array.isArray(availableData) ? availableData : [])
    } catch (loadError) {
      setError('alerts-load-failed')
      setListings([])
    } finally {
      setLoading(false)
    }
  }

  const demandInsights = useMemo(() => buildDemandInsights(listings), [listings])
  const topAlert = demandInsights.topAlert || demandInsights.fallbackTopAlert

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

  const priorityLabel = Number(topAlert?.demandLift || 0) >= 30
    ? t('dashboard.intelligence.priorityHigh', 'High priority')
    : t('dashboard.intelligence.priorityRisk', 'Demand spike risk')

  const responseWindowLabel = topAlert?.predictedWindow || 'next 3-5 days'

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
              <h1 className="board-title org-page-title">{t('common.alerts')}</h1>
              <p className="org-page-subtitle">{t('dashboard.intelligence.subtitle')}</p>
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
        ) : !topAlert ? (
          <section className="empty-state empty-state--rich" aria-live="polite">
            <span className="material-symbols-outlined empty-state-icon">notifications_off</span>
            <h2 className="empty-state-title">{t('dashboard.intelligence.noDataTitle')}</h2>
            <p className="empty-state-subtitle">{t('dashboard.intelligence.noDataHint')}</p>
          </section>
        ) : (
          <section className="org-demand-section" aria-labelledby="org-demand-intelligence">
            <div className="org-demand-heading">
              <span className="org-demand-kicker">{t('common.alerts')}</span>
              <h2 id="org-demand-intelligence">{t('dashboard.intelligence.title')}</h2>
              <p>{t('dashboard.intelligence.subtitle')}</p>
              {demandInsights.source === 'sample' ? (
                <p className="org-demand-data-note">{t('dashboard.intelligence.sampleNote')}</p>
              ) : null}
            </div>

            <article className="org-demand-primary-card">
              <div className="org-demand-primary-topline">
                <span className="material-symbols-outlined">notifications_active</span>
                <span>{t('dashboard.intelligence.primaryLabel')}</span>
              </div>

              <div className="org-demand-priority-row" aria-label={t('dashboard.intelligence.priorityCue', 'Alert priority and trigger')}>
                <span className="org-demand-priority-badge">{priorityLabel}</span>
                <span className="org-demand-trigger-note">
                  {t('dashboard.intelligence.triggerRule', {
                    demandLift: topAlert.demandLift,
                    threshold: DEMAND_SPIKE_THRESHOLD,
                    defaultValue: 'Alert triggered: +{{demandLift}}% demand lift (threshold: >{{threshold}}%)',
                  })}
                </span>
              </div>

              <h3>
                {t('dashboard.intelligence.primaryHeadline', {
                  suburb: topAlert.suburb,
                  postcode: topAlert.postcode,
                })}
              </h3>
              <p>{topAlert.alertReason}</p>

              <div className="org-demand-evidence">
                <div className="org-demand-evidence-row">
                  <span>{t('dashboard.intelligence.fields.predictedWindow')}</span>
                  <strong>{topAlert.predictedWindow || '-'}</strong>
                </div>
                <div className="org-demand-evidence-row">
                  <span>{t('dashboard.intelligence.fields.confidence')}</span>
                  <strong>{topAlert.confidence}%</strong>
                </div>
                <div className="org-demand-evidence-row">
                  <span>{t('dashboard.intelligence.fields.factors')}</span>
                  <strong>{(topAlert.contributingFactors || []).join(', ')}</strong>
                </div>
              </div>

              <div className="org-demand-evidence org-demand-triage">
                <p className="org-demand-triage-title">{t('dashboard.intelligence.triageTitle', 'Triage guidance')}</p>
                <div className="org-demand-evidence-row">
                  <span>{t('dashboard.intelligence.recommendedActionLabel', 'Recommended action')}</span>
                  <strong>
                    {t('dashboard.intelligence.recommendedActionValue', {
                      postcode: topAlert.postcode,
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
                  <strong>+{topAlert.demandLift}%</strong>
                </div>
                <div className="org-demand-metric">
                  <span>{t('dashboard.intelligence.metrics.activePortions')}</span>
                  <strong>{topAlert.activePortions}</strong>
                </div>
                <div className="org-demand-metric">
                  <span>{t('dashboard.intelligence.metrics.households')}</span>
                  <strong>{topAlert.householdsAtRisk}</strong>
                </div>
              </div>

              <button
                type="button"
                className="org-demand-respond-btn"
                onClick={() => handleRespondToNeed(topAlert)}
              >
                {t('dashboard.intelligence.respondAction')}
              </button>
            </article>
          </section>
        )}
      </main>
    </div>
  )
}

export default OrgAlertsPage
