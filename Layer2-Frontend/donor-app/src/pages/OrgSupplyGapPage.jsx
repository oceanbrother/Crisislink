import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAvailableListings } from '../services/api'
import { buildSupplyGapInsights } from '../constants/supplyGapInsights'
import OrgFeatureNav from '../components/OrgFeatureNav'
import WorkspaceHeader from '../components/WorkspaceHeader'
import '../styles/LiveListingBoard.css'

const OrgSupplyGapPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()

  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [coverageFilter, setCoverageFilter] = useState('all')
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

  const getCoverageMeta = (coverageLevel) => {
    if (coverageLevel === 'none') {
      return {
        filterLabel: t('dashboard.coverageInsights.filterCritical', 'Critical gap'),
        panelLabel: t('dashboard.coverageInsights.noSupplyLabel', 'Coverage gap hotspot'),
        sectionLabel: t('dashboard.coverageInsights.noSupplySection', 'No active supply'),
        tileCue: t('dashboard.coverageInsights.coverage.none'),
        badgeLabel: t('dashboard.coverageInsights.noSupplyBadge', 'No active supply'),
        statusLabel: t('dashboard.coverageInsights.noSupplyStatus', 'Critical now'),
        statusHint: t('dashboard.coverageInsights.noSupplyStatusHint', 'Immediate action'),
        detailHint: t(
          'dashboard.coverageInsights.noSupplyHint',
          'No active listings are covering this postcode right now.',
        ),
      }
    }
    if (coverageLevel === 'low') {
      return {
        filterLabel: t('dashboard.coverageInsights.filterLow', 'Low coverage'),
        panelLabel: t('dashboard.coverageInsights.lowCoverageLabel', 'Low coverage postcode'),
        sectionLabel: t('dashboard.coverageInsights.lowCoverageSection', 'Low coverage'),
        tileCue: t('dashboard.coverageInsights.coverage.low'),
        badgeLabel: t('dashboard.coverageInsights.lowCoverageBadge', 'Coverage gap risk'),
        statusLabel: t('dashboard.coverageInsights.lowCoverageStatus', 'Low coverage'),
        statusHint: t('dashboard.coverageInsights.lowCoverageStatusHint', 'Action recommended'),
        detailHint: t(
          'dashboard.coverageInsights.lowCoverageHint',
          'Limited active supply is available relative to local demand pressure.',
        ),
      }
    }
    if (coverageLevel === 'watch') {
      return {
        filterLabel: t('dashboard.coverageInsights.filterWatch', 'Watch'),
        panelLabel: t('dashboard.coverageInsights.watchCoverageLabel', 'Coverage watch postcode'),
        sectionLabel: t('dashboard.coverageInsights.watchCoverageSection', 'Coverage watch'),
        tileCue: t('dashboard.coverageInsights.coverage.watch'),
        badgeLabel: t('dashboard.coverageInsights.watchCoverageBadge', 'Emerging coverage risk'),
        statusLabel: t('dashboard.coverageInsights.watchCoverageStatus', 'Watch'),
        statusHint: t('dashboard.coverageInsights.watchCoverageStatusHint', 'Monitor today'),
        detailHint: t(
          'dashboard.coverageInsights.watchCoverageHint',
          'Supply is still active, but coverage should be monitored closely.',
        ),
      }
    }
    return {
      filterLabel: t('dashboard.coverageInsights.filterHealthy', 'Healthy'),
      panelLabel: t('dashboard.coverageInsights.healthyCoverageLabel', 'Healthy coverage postcode'),
      sectionLabel: t('dashboard.coverageInsights.healthyCoverageSection', 'Healthy coverage'),
      tileCue: t('dashboard.coverageInsights.coverage.healthy'),
      badgeLabel: t('dashboard.coverageInsights.healthyCoverageBadge', 'Coverage stable'),
      statusLabel: t('dashboard.coverageInsights.healthyCoverageStatus', 'Stable'),
      statusHint: t('dashboard.coverageInsights.healthyCoverageStatusHint', 'Coverage holding'),
      detailHint: t(
        'dashboard.coverageInsights.healthyCoverageHint',
        'Active supply is currently keeping pace with estimated local demand.',
      ),
    }
  }

  const filteredZones = useMemo(() => {
    if (coverageFilter === 'all') return coverageInsights.zones
    if (coverageFilter === 'critical') {
      return coverageInsights.zones.filter((zone) => zone.coverageLevel === 'none')
    }
    if (coverageFilter === 'low') {
      return coverageInsights.zones.filter((zone) => zone.coverageLevel === 'low')
    }
    if (coverageFilter === 'watch') {
      return coverageInsights.zones.filter((zone) => zone.coverageLevel === 'watch')
    }
    return coverageInsights.zones.filter((zone) => zone.coverageLevel === 'healthy')
  }, [coverageFilter, coverageInsights.zones])

  useEffect(() => {
    if (filteredZones.length === 0) {
      setSelectedPostcode('')
      return
    }

    const stillExists = filteredZones.some((zone) => zone.postcode === selectedPostcode)
    if (stillExists) return

    const filteredHighlighted = filteredZones.find((zone) => zone.postcode === coverageInsights.highlightedZone?.postcode)
    setSelectedPostcode(filteredHighlighted?.postcode || filteredZones[0]?.postcode || '')
  }, [coverageInsights.highlightedZone, filteredZones, selectedPostcode])

  const selectedZone = useMemo(() => {
    if (!selectedPostcode) return null
    return filteredZones.find((zone) => zone.postcode === selectedPostcode) || null
  }, [filteredZones, selectedPostcode])

  const selectedCoverageMeta = selectedZone ? getCoverageMeta(selectedZone.coverageLevel) : null
  const isFilterEmpty = filteredZones.length === 0

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
                    <strong>{coverageInsights.totals.averageCoverage}%</strong>
                    <span>{t('dashboard.coverageInsights.summary.avgCoverage', 'Avg coverage')}</span>
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

                <div className="org-coverage-filter-row">
                  <button
                    type="button"
                    className={coverageFilter === 'all' ? 'org-coverage-filter-btn active' : 'org-coverage-filter-btn'}
                    onClick={() => setCoverageFilter('all')}
                  >
                    {t('common.all', 'All')}
                  </button>
                  <button
                    type="button"
                    className={coverageFilter === 'critical' ? 'org-coverage-filter-btn active' : 'org-coverage-filter-btn'}
                    onClick={() => setCoverageFilter('critical')}
                  >
                    {t('dashboard.coverageInsights.filterCritical', 'Critical gap')}
                  </button>
                  <button
                    type="button"
                    className={coverageFilter === 'low' ? 'org-coverage-filter-btn active' : 'org-coverage-filter-btn'}
                    onClick={() => setCoverageFilter('low')}
                  >
                    {t('dashboard.coverageInsights.filterLow', 'Low coverage')}
                  </button>
                  <button
                    type="button"
                    className={coverageFilter === 'watch' ? 'org-coverage-filter-btn active' : 'org-coverage-filter-btn'}
                    onClick={() => setCoverageFilter('watch')}
                  >
                    {t('dashboard.coverageInsights.filterWatch', 'Watch')}
                  </button>
                </div>

                <div className="org-coverage-postcode-grid" aria-label={t('dashboard.coverageInsights.postcodeGridLabel', 'Postcode coverage grid')}>
                  {isFilterEmpty ? (
                    <div className="org-coverage-filter-empty">
                      <strong>{t('dashboard.coverageInsights.filterEmptyTitle', 'No postcodes match this coverage filter.')}</strong>
                      <p>
                        {t(
                          'dashboard.coverageInsights.filterEmptyHint',
                          'Try viewing all postcodes or critical gaps.',
                        )}
                      </p>
                    </div>
                  ) : (
                    filteredZones.map((zone) => {
                      const isSelected = zone.postcode === selectedPostcode
                      const isFlagged = zone.coverageLevel !== 'healthy'
                      const coverageMeta = getCoverageMeta(zone.coverageLevel)

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
                          <div className="org-coverage-postcode-eyebrow">
                            {isSelected ? (
                              <span className="org-coverage-postcode-selected">
                                {t('dashboard.intelligence.selected', 'Selected')}
                              </span>
                            ) : (
                              <span className={`org-coverage-postcode-signal org-coverage-postcode-signal--${zone.coverageLevel}`}>
                                {coverageMeta.tileCue}
                              </span>
                            )}
                          </div>
                          <div className="org-coverage-postcode-top">
                            <div className="org-coverage-postcode-title-wrap">
                              <strong>{zone.suburb}</strong>
                              <span className="org-coverage-postcode-code">{zone.postcode}</span>
                            </div>
                            <div className="org-coverage-postcode-coverage-wrap">
                              <span className="org-coverage-postcode-coverage-label">
                                {t('dashboard.coverageInsights.currentCoverageLabel', 'Coverage')}
                              </span>
                              <strong className="org-coverage-postcode-coverage">{zone.coverageRatePercent}%</strong>
                            </div>
                          </div>
                          <p className="org-coverage-postcode-score">
                            {t('dashboard.coverageInsights.shortfallLabel', 'Shortfall')}: {zone.shortfallPortions}{' '}
                            {t('dashboard.coverageInsights.portionsLabel', 'portions')}
                          </p>
                          <div className="org-coverage-postcode-meta">
                            <small>
                              {t('dashboard.coverageInsights.fields.seifa')}: {zone.seifaScore}
                            </small>
                            <small>
                              {coverageMeta.statusLabel}: {coverageMeta.statusHint}
                            </small>
                          </div>
                          {isFlagged ? (
                            <span className="org-coverage-flag-pill">{t('dashboard.coverageInsights.flaggedLabel', 'Flagged')}</span>
                          ) : null}
                        </button>
                      )
                    })
                  )}
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
                    <h3>
                      {selectedCoverageMeta?.panelLabel ||
                        t('dashboard.coverageInsights.detailDefaultTitle', 'Select a postcode')}
                    </h3>
                    <p>
                      {selectedCoverageMeta?.detailHint ||
                        t(
                          'dashboard.coverageInsights.detailDefaultHint',
                          'Choose a flagged postcode to view coverage details and redistribution guidance.',
                        )}
                    </p>
                  </div>
                </div>

                {selectedZone ? (
                  <>
                    <div
                      className={`org-coverage-detail-anchor org-coverage-detail-anchor--${selectedZone.coverageLevel}`}
                    >
                      <span className="org-coverage-detail-anchor-label">{selectedCoverageMeta.sectionLabel}</span>
                      <strong>
                        {selectedZone.suburb} ({selectedZone.postcode})
                      </strong>
                    </div>

                    <div
                      className={`org-coverage-detail-badge org-coverage-detail-badge--${selectedZone.coverageLevel}`}
                    >
                      <span className="material-symbols-outlined">location_searching</span>
                      <strong>{selectedCoverageMeta.badgeLabel}</strong>
                    </div>

                    <p className="org-coverage-detail-reason">{selectedCoverageMeta.detailHint}</p>

                    <div className="org-coverage-detail-grid">
                      <div>
                        <span>{t('dashboard.coverageInsights.currentCoverageLabel', 'Current coverage')}</span>
                        <strong>{selectedZone.coverageRatePercent}%</strong>
                      </div>
                      <div>
                        <span>{t('dashboard.coverageInsights.estimatedDemandLabel', 'Estimated demand')}</span>
                        <strong>{selectedZone.estimatedDemand} {t('dashboard.coverageInsights.portionsLabel', 'portions')}</strong>
                      </div>
                      <div>
                        <span>{t('dashboard.coverageInsights.availableSupplyLabel', 'Available supply')}</span>
                        <strong>{selectedZone.availableSupply} {t('dashboard.coverageInsights.portionsLabel', 'portions')}</strong>
                      </div>
                      <div>
                        <span>{t('dashboard.coverageInsights.shortfallLabel', 'Shortfall')}</span>
                        <strong>{selectedZone.shortfallPortions} {t('dashboard.coverageInsights.portionsLabel', 'portions')}</strong>
                      </div>
                    </div>

                    <div className="org-coverage-detail-grid org-coverage-context-grid">
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

                    <div className="org-coverage-triage">
                      <p className="org-coverage-triage-title">{t('dashboard.coverageInsights.triageTitle', 'Triage guidance')}</p>
                      <div className="org-coverage-detail-grid org-coverage-triage-grid">
                        <div className="org-coverage-detail-grid--wide">
                          <span>{t('dashboard.coverageInsights.recommendedActionLabel', 'Recommended action')}</span>
                          <strong>
                            {selectedZone.coverageLevel === 'none'
                              ? t('dashboard.coverageInsights.recommendedActionCritical', 'Trigger donor outreach and re-route nearby surplus now')
                              : selectedZone.coverageLevel === 'low'
                                ? t('dashboard.coverageInsights.recommendedActionLow', 'Increase pickup frequency and redirect nearby supply')
                                : t('dashboard.coverageInsights.recommendedActionWatch', 'Monitor coverage and prepare donor outreach')}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="org-coverage-respond-btn"
                      onClick={() => handleRespondToNeed(selectedZone)}
                    >
                      {t('dashboard.coverageInsights.respondAction', 'Post extra food for this area')}
                    </button>
                  </>
                ) : (
                  <div className="org-coverage-detail-placeholder">
                    <strong>{t('dashboard.coverageInsights.detailDefaultTitle', 'Select a postcode')}</strong>
                    <p>
                      {isFilterEmpty
                        ? t(
                            'dashboard.coverageInsights.filterEmptyHint',
                            'Try viewing all postcodes or critical gaps.',
                          )
                        : t(
                            'dashboard.coverageInsights.detailDefaultHint',
                            'Choose a flagged postcode to view coverage details and redistribution guidance.',
                          )}
                    </p>
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
