import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAvailableListings } from '../services/api'
import { buildSupplyGapInsights } from '../constants/supplyGapInsights'
import OrgFeatureNav from '../components/OrgFeatureNav'
import '../styles/LiveListingBoard.css'

const OrgSupplyGapPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()

  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedPostcode, setSelectedPostcode] = useState('')

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
  const hasCoverageData = coverageInsights.zones.length > 0

  useEffect(() => {
    if (!selectedPostcode) return

    const stillExists = coverageInsights.zones.some((zone) => zone.postcode === selectedPostcode)
    if (!stillExists) {
      setSelectedPostcode('')
    }
  }, [coverageInsights.zones, selectedPostcode])

  const selectedZone = useMemo(() => {
    if (!selectedPostcode) return null
    return coverageInsights.zones.find((zone) => zone.postcode === selectedPostcode) || null
  }, [coverageInsights.zones, selectedPostcode])

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
          <OrgFeatureNav active="gaps" orgCode={orgCode} />
        </div>

        <section className="org-page-intro org-hero-card">
          <div className="org-page-heading-row">
            <div className="org-page-heading">
              <h1 className="board-title org-page-title">{t('dashboard.coverageInsights.title', 'Supply coverage watch')}</h1>
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
              <article className="org-coverage-map-card">
                <div className="org-coverage-card-header">
                  <div>
                    <h3>{t('dashboard.coverageInsights.mapTitle', 'Postcode coverage view')}</h3>
                    <p>
                      {t(
                        'dashboard.coverageInsights.mapHint',
                        'Postcodes are colour-coded using resource requirement (SEIFA + need pressure) and active listing count.',
                      )}
                    </p>
                  </div>
                </div>

                <div className="org-coverage-legend" aria-label={t('dashboard.coverageInsights.legendLabel', 'Coverage legend')}>
                  {['none', 'low', 'watch', 'healthy'].map((level) => (
                    <span key={level} className={`org-coverage-badge org-coverage-badge--${level}`}>
                      {t(`dashboard.coverageInsights.coverage.${level}`)}
                    </span>
                  ))}
                </div>

                <div className="org-coverage-postcode-grid" aria-label={t('dashboard.coverageInsights.postcodeGridLabel', 'Postcode coverage grid')}>
                  {coverageInsights.zones.map((zone) => {
                    const isSelected = zone.postcode === selectedPostcode
                    const isFlagged = zone.coverageLevel !== 'healthy'

                    return (
                      <button
                        key={zone.postcode}
                        type="button"
                        className={`org-coverage-postcode-tile org-coverage-postcode-tile--${zone.coverageLevel}${
                          isSelected ? ' is-selected' : ''
                        }`}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedPostcode(zone.postcode)}
                      >
                        <div className="org-coverage-postcode-top">
                          <strong>{zone.postcode}</strong>
                          <span>{t(`dashboard.coverageInsights.coverage.${zone.coverageLevel}`)}</span>
                        </div>
                        <p>{zone.suburb}</p>
                        <div className="org-coverage-postcode-meta">
                          <small>
                            {t('dashboard.coverageInsights.resourceScoreLabel', 'Resource requirement')}: {zone.requirementScore}
                          </small>
                          <small>
                            {t('dashboard.coverageInsights.fields.activeListings')}: {zone.listingCount}
                          </small>
                        </div>
                        {isFlagged ? (
                          <span className="org-coverage-flag-pill">{t('dashboard.coverageInsights.flaggedLabel', 'Flagged')}</span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>

                <p className="org-coverage-click-hint">
                  {t(
                    'dashboard.coverageInsights.clickHint',
                    'Click a flagged postcode to open the detail panel and plan redistribution.',
                  )}
                </p>
              </article>

              <article className="org-coverage-detail-card">
                <div className="org-coverage-card-header">
                  <div>
                    <h3>{t('dashboard.coverageInsights.detailTitle')}</h3>
                    <p>{t('dashboard.coverageInsights.detailHint')}</p>
                  </div>
                </div>

                {selectedZone ? (
                  <>
                    <h4>
                      {selectedZone.suburb} ({selectedZone.postcode})
                    </h4>

                    <div className="org-coverage-detail-grid">
                      <div>
                        <span>{t('dashboard.coverageInsights.fields.seifa')}</span>
                        <strong>{selectedZone.seifaScore}</strong>
                      </div>
                      <div>
                        <span>{t('dashboard.coverageInsights.resourceScoreLabel', 'Resource requirement score')}</span>
                        <strong>{selectedZone.requirementScore}</strong>
                      </div>
                      <div>
                        <span>{t('dashboard.coverageInsights.fields.activeListings')}</span>
                        <strong>{selectedZone.listingCount}</strong>
                      </div>
                      <div>
                        <span>{t('dashboard.coverageInsights.fields.population')}</span>
                        <strong>{selectedZone.estimatedPopulationInNeed}</strong>
                      </div>
                      <div className="org-coverage-detail-grid--wide">
                        <span>{t('dashboard.coverageInsights.fields.nearestSupply')}</span>
                        <strong>
                          {selectedZone.nearestSupplyPoint} ({selectedZone.nearestSupplyDistanceKm} km)
                        </strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="org-coverage-respond-btn"
                      onClick={() => handleRespondToNeed(selectedZone)}
                    >
                      {t('dashboard.coverageInsights.respondAction')}
                    </button>
                  </>
                ) : (
                  <div className="org-coverage-detail-placeholder">
                    {t(
                      'dashboard.coverageInsights.detailPlaceholder',
                      'Select a flagged postcode from the coverage view to open its detail panel.',
                    )}
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

export default OrgSupplyGapPage
