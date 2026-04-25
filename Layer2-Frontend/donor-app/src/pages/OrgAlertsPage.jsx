import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAvailableListings } from '../services/api'
import OrgFeatureNav from '../components/OrgFeatureNav'
import '../styles/LiveListingBoard.css'

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
              <p className="org-page-subtitle">
                {t(
                  'dashboard.intelligence.subtitle',
                  'View upcoming alerts and supply-gap indicators for your service area.',
                )}
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
            <h2 className="empty-state-title">
              {t('dashboard.intelligence.loadErrorTitle', 'Unable to load alerts')}
            </h2>
            <p className="empty-state-subtitle">
              {t(
                'dashboard.intelligence.loadErrorHint',
                'We could not load listing data for the alerts workspace. Please try again shortly.',
              )}
            </p>
          </section>
        ) : listings.length === 0 ? (
          <section className="empty-state empty-state--rich" aria-live="polite">
            <span className="material-symbols-outlined empty-state-icon">notifications_off</span>
            <h2 className="empty-state-title">{t('dashboard.intelligence.noDataTitle', 'No alerts yet')}</h2>
            <p className="empty-state-subtitle">
              {t(
                'dashboard.intelligence.noDataHint',
                'Forecast and coverage modules will appear here once listings and forecasting data are available.',
              )}
            </p>
          </section>
        ) : (
          <section className="org-filter-panel" aria-live="polite">
            <p className="filter-feedback-hint">
              {t(
                'dashboard.intelligence.shellReady',
                'Alerts workspace is ready. Forecast and supply-gap panels will be added in the next user-story branches.',
              )}
            </p>
            <p className="feed-count">{t('listing.itemsAvailable', { count: listings.length })}</p>
          </section>
        )}
      </main>
    </div>
  )
}

export default OrgAlertsPage
