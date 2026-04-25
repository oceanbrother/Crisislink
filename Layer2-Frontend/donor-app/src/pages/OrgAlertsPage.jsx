import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAvailableListings } from '../services/api'
import { buildSupplyGapInsights } from '../constants/supplyGapInsights'
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

  const coverageInsights = useMemo(() => buildSupplyGapInsights(listings), [listings])
  const hasCoverageData = coverageInsights.hotspotZones.length > 0 || coverageInsights.watchZones.length > 0

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
              <p className="org-page-subtitle">{t('dashboard.coverageInsights.subtitle')}</p>
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
            <h2 className="empty-state-title">{t('dashboard.coverageInsights.loadErrorTitle')}</h2>
            <p className="empty-state-subtitle">{t('dashboard.coverageInsights.loadErrorHint')}</p>
          </section>
        ) : !hasCoverageData ? (
          <section className="empty-state empty-state--rich" aria-live="polite">
            <span className="material-symbols-outlined empty-state-icon">map_off</span>
            <h2 className="empty-state-title">{t('dashboard.coverageInsights.noDataTitle')}</h2>
            <p className="empty-state-subtitle">{t('dashboard.coverageInsights.noDataHint')}</p>
          </section>
        ) : (
          <section className="org-coverage-section" aria-labelledby="org-coverage-intelligence">
            <div className="org-coverage-header">
              <div className="org-coverage-heading">
                <span className="org-coverage-kicker">{t('dashboard.coverageInsights.kicker')}</span>
                <h2 id="org-coverage-intelligence">{t('dashboard.coverageInsights.title')}</h2>
                <p>{t('dashboard.coverageInsights.subtitle')}</p>
                {coverageInsights.source === 'sample' ? (
                  <p className="org-coverage-data-note">{t('dashboard.coverageInsights.sampleNote')}</p>
                ) : null}
              </div>

              <div className="org-coverage-summary">
                <div className="org-coverage-summary-card">
                  <strong>{coverageInsights.totals.zeroSupply}</strong>
                  <span>{t('dashboard.coverageInsights.summary.zeroSupply')}</span>
                </div>
                <div className="org-coverage-summary-card">
                  <strong>{coverageInsights.totals.atRisk}</strong>
                  <span>{t('dashboard.coverageInsights.summary.atRisk')}</span>
                </div>
                <div className="org-coverage-summary-card">
                  <strong>{coverageInsights.totals.tracked}</strong>
                  <span>{t('dashboard.coverageInsights.summary.tracked')}</span>
                </div>
              </div>
            </div>

            <div className="org-coverage-grid">
              <div className="org-coverage-card-stack">
                <article className="org-coverage-list-card">
                  <div className="org-coverage-card-header">
                    <div>
                      <h3>{t('dashboard.coverageInsights.hotspotsTitle')}</h3>
                      <p>{t('dashboard.coverageInsights.hotspotsHint')}</p>
                    </div>
                  </div>
                  <div className="org-coverage-list">
                    {coverageInsights.hotspotZones.length > 0 ? (
                      coverageInsights.hotspotZones.map((zone) => (
                        <div key={zone.postcode} className="org-coverage-list-row">
                          <div>
                            <strong>{zone.suburb}</strong>
                            <span>{zone.postcode}</span>
                          </div>
                          <div className="org-coverage-list-meta">
                            <span className="org-coverage-badge org-coverage-badge--none">
                              {t('dashboard.coverageInsights.badges.zeroSupply')}
                            </span>
                            <small>
                              {zone.activePortions} {t('listing.units.portions')}
                            </small>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="org-coverage-list-empty">{t('dashboard.coverageInsights.allCovered')}</div>
                    )}
                  </div>
                </article>

                <article className="org-coverage-list-card">
                  <div className="org-coverage-card-header">
                    <div>
                      <h3>{t('dashboard.coverageInsights.watchTitle')}</h3>
                      <p>{t('dashboard.coverageInsights.watchHint')}</p>
                    </div>
                  </div>
                  <div className="org-coverage-list">
                    {coverageInsights.watchZones.length > 0 ? (
                      coverageInsights.watchZones.map((zone) => (
                        <div key={`${zone.postcode}-watch`} className="org-coverage-list-row">
                          <div>
                            <strong>{zone.suburb}</strong>
                            <span>{zone.postcode}</span>
                          </div>
                          <div className="org-coverage-list-meta">
                            <span className={`org-coverage-badge org-coverage-badge--${zone.coverageLevel}`}>
                              {t(`dashboard.coverageInsights.coverage.${zone.coverageLevel}`)}
                            </span>
                            <small>
                              {zone.activePortions} {t('listing.units.portions')}
                            </small>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="org-coverage-list-empty">{t('dashboard.coverageInsights.noWatch')}</div>
                    )}
                  </div>
                </article>
              </div>

              {coverageInsights.highlightedZone ? (
                <article className="org-coverage-detail-card">
                  <div className="org-coverage-card-header">
                    <div>
                      <h3>{t('dashboard.coverageInsights.detailTitle')}</h3>
                      <p>{t('dashboard.coverageInsights.detailHint')}</p>
                    </div>
                  </div>

                  <h4>
                    {coverageInsights.highlightedZone.suburb} ({coverageInsights.highlightedZone.postcode})
                  </h4>

                  <div className="org-coverage-detail-grid">
                    <div>
                      <span>{t('dashboard.coverageInsights.fields.seifa')}</span>
                      <strong>{coverageInsights.highlightedZone.seifaScore}</strong>
                    </div>
                    <div>
                      <span>{t('dashboard.coverageInsights.fields.activeListings')}</span>
                      <strong>{coverageInsights.highlightedZone.listingCount}</strong>
                    </div>
                    <div>
                      <span>{t('dashboard.coverageInsights.fields.population')}</span>
                      <strong>{coverageInsights.highlightedZone.estimatedPopulationInNeed}</strong>
                    </div>
                    <div>
                      <span>{t('dashboard.coverageInsights.fields.nearestSupply')}</span>
                      <strong>{coverageInsights.highlightedZone.nearestSupplyDistanceKm} km</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="org-coverage-respond-btn"
                    onClick={() => handleRespondToNeed(coverageInsights.highlightedZone)}
                  >
                    {t('dashboard.coverageInsights.respondAction')}
                  </button>
                </article>
              ) : null}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default OrgAlertsPage
