import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAvailableListings, getGapPostcodes } from '../services/api'
import { buildSupplyGapInsights } from '../constants/supplyGapInsights'
import { buildCoverageInsightsFromGapPostcodes } from '../utils/predictionAdapters'
import OrgFeatureNav from '../components/OrgFeatureNav'
import '../styles/LiveListingBoard.css'

const FILTER_OPTIONS = ['all', 'critical', 'low', 'watch']
const SHOW_SAMPLE_HINT = Boolean(import.meta.env.DEV)
const COVERAGE_MAP_SLOTS = {
  '3001': 'inner-west',
  '3004': 'central',
  '3051': 'inner-north',
  '3072': 'north-east',
  '3163': 'south-east',
  '3182': 'bay-east',
}

const OrgSupplyGapPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()

  const [loading, setLoading] = useState(true)
  const [coverageFilter, setCoverageFilter] = useState('all')
  const [coverageInsights, setCoverageInsights] = useState(() => buildSupplyGapInsights([]))
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
  }, [orgCode])

  useEffect(() => {
    let isCancelled = false

    const loadCoverageInsights = async () => {
      setLoading(true)

      try {
        try {
          const gapPostcodeData = await getGapPostcodes()
          const predictionInsights = buildCoverageInsightsFromGapPostcodes(gapPostcodeData)

          if (!isCancelled && predictionInsights.zones.length > 0) {
            setCoverageInsights(predictionInsights)
            return
          }
        } catch (predictionError) {
          // Prediction service is optional during frontend-only development.
        }

        const availableData = await getAvailableListings({ status: 'available' })
        if (!isCancelled) {
          setCoverageInsights(buildSupplyGapInsights(Array.isArray(availableData) ? availableData : []))
        }
      } catch (error) {
        if (!isCancelled) {
          setCoverageInsights(buildSupplyGapInsights([]))
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    loadCoverageInsights()

    return () => {
      isCancelled = true
    }
  }, [])

  const filteredZones = useMemo(() => {
    if (coverageFilter === 'all') return coverageInsights.zones
    if (coverageFilter === 'critical') {
      return coverageInsights.zones.filter((zone) => zone.coverageLevel === 'none')
    }
    if (coverageFilter === 'low') {
      return coverageInsights.zones.filter((zone) => zone.coverageLevel === 'low')
    }
    return coverageInsights.zones.filter((zone) => zone.coverageLevel === 'watch')
  }, [coverageFilter, coverageInsights.zones])

  useEffect(() => {
    if (filteredZones.length === 0) {
      setSelectedPostcode('')
      return
    }

    setSelectedPostcode((currentPostcode) => {
      if (filteredZones.some((zone) => zone.postcode === currentPostcode)) {
        return currentPostcode
      }
      return filteredZones[0]?.postcode || ''
    })
  }, [filteredZones])

  const selectedZone = useMemo(() => {
    if (!selectedPostcode) return null
    return filteredZones.find((zone) => zone.postcode === selectedPostcode) || null
  }, [filteredZones, selectedPostcode])

  const criticalZones = useMemo(() => coverageInsights.hotspotZones.slice(0, 3), [coverageInsights.hotspotZones])
  const watchZones = useMemo(() => coverageInsights.watchZones.slice(0, 3), [coverageInsights.watchZones])
  const coverageMapZones = useMemo(() => filteredZones.slice(0, 6), [filteredZones])

  const getCoverageMeta = (coverageLevel) => {
    if (coverageLevel === 'none') {
      return {
        tone: 'none',
        label: t('dashboard.coverageInsights.coverage.none', 'No active supply'),
        cue: t('dashboard.coverageInsights.noSupplyBadge', 'Immediate action'),
        summary: t(
          'dashboard.coverageInsights.noSupplyHint',
          'No active listings are currently covering this postcode.',
        ),
        actionReason: t(
          'dashboard.coverageInsights.noSupplyActionReason',
          'This area has no active supply and should be prioritised for donor outreach or nearby surplus re-routing.',
        ),
      }
    }
    if (coverageLevel === 'low') {
      return {
        tone: 'low',
        label: t('dashboard.coverageInsights.coverage.low', 'Low coverage'),
        cue: t('dashboard.coverageInsights.lowCoverageBadge', 'Action recommended'),
        summary: t(
          'dashboard.coverageInsights.lowCoverageHint',
          'Supply is active, but current coverage remains below expected local need.',
        ),
        actionReason: t(
          'dashboard.coverageInsights.lowCoverageActionReason',
          'Coverage is still active, but this postcode should be prioritised before demand pressure rises further.',
        ),
      }
    }
    if (coverageLevel === 'watch') {
      return {
        tone: 'watch',
        label: t('dashboard.coverageInsights.coverage.watch', 'Watch'),
        cue: t('dashboard.coverageInsights.watchCoverageBadge', 'Monitor today'),
        summary: t(
          'dashboard.coverageInsights.watchCoverageHint',
          'Coverage is still holding, but demand pressure is rising.',
        ),
        actionReason: t(
          'dashboard.coverageInsights.watchCoverageActionReason',
          'This area is not critical yet, but it is approaching risk and should stay visible in planning.',
        ),
      }
    }
    return {
      tone: 'healthy',
      label: t('dashboard.coverageInsights.coverage.healthy', 'Healthy'),
      cue: t('dashboard.coverageInsights.healthyCoverageBadge', 'Coverage stable'),
      summary: t(
        'dashboard.coverageInsights.healthyCoverageHint',
        'Current supply is keeping pace with estimated need.',
      ),
      actionReason: t(
        'dashboard.coverageInsights.healthyCoverageActionReason',
        'Coverage is stable for now, so this postcode can stay lower in the response queue.',
      ),
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
              <h1 className="board-title org-page-title">
                {t('dashboard.coverageInsights.pageTitle', 'Supply gap watch')}
              </h1>
              <p className="org-page-subtitle">
                {t(
                  'dashboard.coverageInsights.pageSubtitle',
                  'Identify high-need postcodes with low or zero active food supply.',
                )}
              </p>
              <div className="org-page-meta org-page-meta-pill">
                <span className="material-symbols-outlined">domain</span>
                <span>
                  {t('dashboard.signedInAs', {
                    orgCode,
                    defaultValue: `Signed in as ${orgCode}`,
                  })}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="org-coverage-section" aria-labelledby="org-coverage-title">
          <div className="org-coverage-header">
            <div className="org-coverage-heading">
              <h2 id="org-coverage-title">{t('dashboard.coverageInsights.title', 'Supply gap watch')}</h2>
              <p>
                {t(
                  'dashboard.coverageInsights.subtitle',
                  'Identify high-need postcodes with low or zero active food supply.',
                )}
              </p>
              {SHOW_SAMPLE_HINT && coverageInsights.source !== 'prediction' ? (
                <p className="org-coverage-data-note">
                  {t(
                    'dashboard.coverageInsights.sampleNote',
                    'Preview mode: these postcodes and coverage levels use frontend sample data for the Phase 9 workflow.',
                  )}
                </p>
              ) : null}
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

          {loading ? (
            <div className="loading-state empty-state--rich">
              <p>{t('common.loading', 'Loading...')}</p>
            </div>
          ) : (
            <div className="org-coverage-grid">
              <article className="org-coverage-map-card">
                <div className="org-coverage-card-header">
                  <h3>{t('dashboard.coverageInsights.mapTitle', 'Postcode coverage view')}</h3>
                  <p>
                    {t(
                      'dashboard.coverageInsights.mapHint',
                      'Filter the highest-risk postcodes first, then open a postcode tile to inspect coverage details.',
                    )}
                  </p>
                </div>

                <div className="org-coverage-legend" aria-label={t('dashboard.coverageInsights.legendLabel', 'Coverage legend')}>
                  {['none', 'low', 'watch', 'healthy'].map((level) => (
                    <span key={level} className={`org-coverage-badge org-coverage-badge--${level}`}>
                      {getCoverageMeta(level).label}
                    </span>
                  ))}
                </div>

                <div className="org-coverage-filter-row">
                  {FILTER_OPTIONS.map((filterValue) => (
                    <button
                      key={filterValue}
                      type="button"
                      className={coverageFilter === filterValue ? 'org-coverage-filter-btn active' : 'org-coverage-filter-btn'}
                      onClick={() => setCoverageFilter(filterValue)}
                    >
                      {filterValue === 'all'
                        ? t('common.all', 'All')
                        : filterValue === 'critical'
                          ? t('dashboard.coverageInsights.filterCritical', 'Critical gap')
                          : filterValue === 'low'
                            ? t('dashboard.coverageInsights.filterLow', 'Low coverage')
                            : t('dashboard.coverageInsights.filterWatch', 'Watch')}
                    </button>
                  ))}
                </div>

                <p className="org-coverage-results-hint" aria-live="polite">
                  {filteredZones.length === 1
                    ? t(
                        'dashboard.coverageInsights.resultsHintSingle',
                        '1 postcode matches this filter.',
                      )
                    : t(
                        'dashboard.coverageInsights.resultsHintPlural',
                        {
                          count: filteredZones.length,
                          defaultValue: '{{count}} postcodes match this filter.',
                        },
                      )}
                </p>

                <section className={coverageMapZones.length < 3 ? 'org-coverage-map-shell is-compact' : 'org-coverage-map-shell'} aria-label={t('dashboard.coverageInsights.mapShellLabel', 'Supply gap map shell')}>
                  <div className="org-coverage-map-shell-header">
                    <div>
                      <p className="org-coverage-map-shell-eyebrow">{t('dashboard.coverageInsights.mapShellEyebrow', 'Coverage map shell')}</p>
                      <h4>{t('dashboard.coverageInsights.mapShellTitle', 'Postcode pressure snapshot')}</h4>
                    </div>
                    <p>
                      {t(
                        'dashboard.coverageInsights.mapShellHint',
                        'This static map shell shows where current supply pressure concentrates while live postcode polygons are still pending.',
                      )}
                    </p>
                  </div>

                  <div className="org-coverage-map-stage">
                    <div className="org-coverage-map-stage-grid" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>

                    {coverageMapZones.map((zone) => {
                      const meta = getCoverageMeta(zone.coverageLevel)
                      const slot = COVERAGE_MAP_SLOTS[zone.postcode] || 'metro'
                      const isSelected = zone.postcode === selectedZone?.postcode
                      return (
                        <button
                          key={`map-${zone.postcode}`}
                          type="button"
                          className={[
                            'org-coverage-map-node',
                            `org-coverage-map-node--${slot}`,
                            `org-coverage-map-node--${meta.tone}`,
                            isSelected ? 'is-active' : '',
                          ].join(' ')}
                          onClick={() => setSelectedPostcode(zone.postcode)}
                        >
                          <span>{zone.postcode}</span>
                          <strong>{zone.suburb}</strong>
                          <small>
                            {t('dashboard.coverageInsights.shortfallCopy', {
                              count: zone.shortfallPortions,
                              defaultValue: '{{count}} portions short',
                            })}
                          </small>
                        </button>
                      )
                    })}
                  </div>
                </section>

                <div className="org-coverage-postcode-grid" aria-label={t('dashboard.coverageInsights.postcodeGridLabel', 'Postcode coverage grid')}>
                  {filteredZones.length === 0 ? (
                    <div className="org-coverage-filter-empty">
                      <strong>{t('dashboard.coverageInsights.filterEmptyTitle', 'No postcodes match this filter.')}</strong>
                      <p>{t('dashboard.coverageInsights.filterEmptyHint', 'Try a broader filter to see more coverage zones.')}</p>
                    </div>
                  ) : (
                    filteredZones.map((zone) => {
                      const meta = getCoverageMeta(zone.coverageLevel)
                      const isSelected = zone.postcode === selectedZone?.postcode
                      return (
                        <button
                          key={zone.postcode}
                          type="button"
                          className={[
                            'org-coverage-postcode-tile',
                            `org-coverage-postcode-tile--${meta.tone}`,
                            isSelected ? `is-selected is-selected--${meta.tone}` : '',
                          ].join(' ')}
                          onClick={() => setSelectedPostcode(zone.postcode)}
                        >
                          <div className="org-coverage-postcode-eyebrow">
                            <span className={`org-coverage-postcode-signal org-coverage-postcode-signal--${meta.tone}`}>
                              {meta.label}
                            </span>
                            {isSelected ? (
                              <span className={`org-coverage-postcode-selected org-coverage-postcode-selected--${meta.tone}`}>
                                {t('dashboard.coverageInsights.selected', 'Selected')}
                              </span>
                            ) : null}
                          </div>
                          <div className="org-coverage-postcode-top">
                            <div className="org-coverage-postcode-title-wrap">
                              <strong>{zone.suburb}</strong>
                              <span className="org-coverage-postcode-code">{zone.postcode}</span>
                            </div>
                            <div className="org-coverage-postcode-coverage-wrap">
                              <span className="org-coverage-postcode-coverage-label">
                                {t('dashboard.coverageInsights.coverageRate', 'Coverage')}
                              </span>
                              <strong className="org-coverage-postcode-coverage">{zone.coverageRatePercent}%</strong>
                            </div>
                          </div>
                          <p className="org-coverage-postcode-score">
                            {t('dashboard.coverageInsights.shortfallCopy', {
                              count: zone.shortfallPortions,
                              defaultValue: '{{count}} portions short',
                            })}
                          </p>
                          <div className="org-coverage-postcode-meta">
                            <small>
                              {t('dashboard.coverageInsights.listingCountCopy', {
                                count: zone.listingCount,
                                defaultValue: '{{count}} active listings',
                              })}
                            </small>
                            <small>
                              {t('dashboard.coverageInsights.nearestSupplyCopy', {
                                name: zone.nearestSupplyPoint,
                                distance: zone.nearestSupplyDistanceKm,
                                defaultValue: 'Nearest supply: {{name}} ({{distance}} km)',
                              })}
                            </small>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>

                <p className="org-coverage-click-hint">
                  {t(
                    'dashboard.coverageInsights.clickHint',
                    'Open a postcode tile to see the local context and decide where your next posting can help most.',
                  )}
                </p>
              </article>

              <div className="org-coverage-card-stack">
                <aside className="org-coverage-detail-card">
                  {selectedZone ? (
                    <>
                      <div className="org-coverage-card-header">
                        <h3>{t('dashboard.coverageInsights.detailTitle', 'Postcode gap details')}</h3>
                        <p>{t('dashboard.coverageInsights.detailSubtitle', 'Review why this postcode is at risk and what action should happen next.')}</p>
                      </div>
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

                      <p className="org-coverage-detail-summary">{getCoverageMeta(selectedZone.coverageLevel).summary}</p>
                      <p className="org-coverage-detail-reason">{getCoverageMeta(selectedZone.coverageLevel).actionReason}</p>

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

                      <div className="org-coverage-triage">
                        <p className="org-coverage-triage-title">
                          {t('dashboard.coverageInsights.triageTitle', 'Action prompt')}
                        </p>
                        <p className="org-coverage-detail-reason">
                          {t(
                            'dashboard.coverageInsights.triageHint',
                            'If your organisation can post fresh supply soon, this postcode is a strong candidate for targeted collection or redistribution support.',
                          )}
                        </p>
                        <button
                          type="button"
                          className="org-coverage-respond-btn"
                          onClick={() => handleRespondToNeed(selectedZone)}
                        >
                          {t('dashboard.coverageInsights.respondButton', 'Post food for this area')}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="org-coverage-detail-placeholder">
                      <strong>{t('dashboard.coverageInsights.detailPlaceholderTitle', 'Choose a postcode')}</strong>
                      <p>
                        {t(
                          'dashboard.coverageInsights.detailPlaceholderHint',
                          'Select a postcode tile from the left to inspect coverage pressure and response options.',
                        )}
                      </p>
                    </div>
                  )}
                </aside>

                <section className="org-coverage-list-card">
                  <div className="org-coverage-card-header">
                    <h3>{t('dashboard.coverageInsights.criticalListTitle', 'Critical now')}</h3>
                    <p>{t('dashboard.coverageInsights.criticalListHint', 'These postcodes currently have the most urgent supply gaps.')}</p>
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
                    <p>{t('dashboard.coverageInsights.watchListHint', 'These areas still have supply, but they are moving toward risk.')}</p>
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
        </section>
      </main>
    </div>
  )
}

export default OrgSupplyGapPage
