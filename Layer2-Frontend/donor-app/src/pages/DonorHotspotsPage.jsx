import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import DonorFeatureNav from '../components/DonorFeatureNav'
import { getHotspots } from '../services/api'
import {
  computeHotspotPriorityScore,
  computeTotalShortfall,
  getNeededItems,
  getPriorityBand,
} from '../constants/hotspotInsights'
import { hotspotSampleZones } from '../utils/hotspotSampleData'
import { buildHotspotsFromPredictionData } from '../utils/predictionAdapters'
import '../styles/PostFeedPage.css'

const STORAGE_KEY = 'crisislink-donor-postcode'
const HOTSPOT_REGION_MAP_SLOTS = {
  'Regional North': 'north',
  'North-East': 'north-east',
  'North Melbourne': 'north-central',
  'Inner Melbourne': 'central',
  West: 'west',
  'Regional West': 'south-west',
  'South-East': 'south-east',
}
const SHOW_SAMPLE_HINT = Boolean(import.meta.env.DEV)
const HOTSPOT_MAP_STAGE_COPY = {
  eyebrow: 'Need map shell',
  title: 'Regional hotspot snapshot',
  subtitle:
    'Use this static map shell to see which donor-facing regions currently cluster the strongest unmet food demand.',
}

const DonorHotspotsPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { postcode: postcodeFromPath } = useParams()
  const { t } = useTranslation()

  const focusPostcode = String(location.state?.postcode || postcodeFromPath || '').trim()
  const [regionFilter, setRegionFilter] = useState('all')
  const [distanceFilter, setDistanceFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [sortMode, setSortMode] = useState('priority')
  const [hotspotZones, setHotspotZones] = useState(hotspotSampleZones)
  const [hotspotSource, setHotspotSource] = useState('sample')
  const [selectedPostcode, setSelectedPostcode] = useState(hotspotSampleZones[0]?.postcode || '')

  useEffect(() => {
    if (!focusPostcode) return
    window.localStorage.setItem(STORAGE_KEY, focusPostcode)
  }, [focusPostcode])


  useEffect(() => {
    let isCancelled = false

    const loadHotspots = async () => {
      try {
        const hotspotData = await getHotspots()
        const predictionHotspots = buildHotspotsFromPredictionData(hotspotData)

        if (!isCancelled && predictionHotspots.zones.length > 0) {
          setHotspotZones(predictionHotspots.zones)
          setHotspotSource(predictionHotspots.source)
          return
        }
      } catch (predictionError) {
        // Prediction service is optional during frontend-only development.
      }

      if (!isCancelled) {
        setHotspotZones(hotspotSampleZones)
        setHotspotSource('sample')
      }
    }

    loadHotspots()

    return () => {
      isCancelled = true
    }
  }, [focusPostcode])

  const enrichedHotspots = useMemo(() => {
    return hotspotZones.map((zone) => {
      const priorityScore = computeHotspotPriorityScore(zone)
      return {
        ...zone,
        priorityScore,
        priorityBand: getPriorityBand(priorityScore),
        neededItems: getNeededItems(zone.shortageItems),
        totalShortfall: computeTotalShortfall(zone.shortageItems),
      }
    })
  }, [hotspotZones])

  const regions = useMemo(() => {
    return ['all', ...new Set(enrichedHotspots.map((zone) => zone.region))]
  }, [enrichedHotspots])

  const visibleHotspots = useMemo(() => {
    let zones = [...enrichedHotspots]

    if (regionFilter !== 'all') {
      zones = zones.filter((zone) => zone.region === regionFilter)
    }

    if (distanceFilter !== 'all') {
      zones = zones.filter((zone) => Number(zone.distanceToDonorKm || 0) <= Number(distanceFilter))
    }

    if (priorityFilter !== 'all') {
      zones = zones.filter((zone) => zone.priorityBand.tone === priorityFilter)
    }

    if (sortMode === 'distance') {
      return zones.sort((left, right) => Number(left.distanceToDonorKm || 0) - Number(right.distanceToDonorKm || 0))
    }

    return zones.sort((left, right) => right.priorityScore - left.priorityScore)
  }, [distanceFilter, enrichedHotspots, priorityFilter, regionFilter, sortMode])

  useEffect(() => {
    setSelectedPostcode((currentPostcode) => {
      if (visibleHotspots.some((zone) => zone.postcode === currentPostcode)) {
        return currentPostcode
      }
      return visibleHotspots[0]?.postcode || ''
    })
  }, [visibleHotspots])

  const selectedHotspot = useMemo(() => {
    if (!selectedPostcode) return null
    return visibleHotspots.find((zone) => zone.postcode === selectedPostcode) || null
  }, [selectedPostcode, visibleHotspots])

  const priorityCounts = useMemo(() => {
    return enrichedHotspots.reduce(
      (counts, zone) => {
        counts[zone.priorityBand.tone] += 1
        return counts
      },
      { critical: 0, high: 0, watch: 0 },
    )
  }, [enrichedHotspots])

  const topPriorityHotspot = visibleHotspots[0] || null
  const isFocusedRegion = regionFilter !== 'all'

  const hotspotRegionGroups = useMemo(() => {
    const grouped = visibleHotspots.reduce((groups, zone) => {
      if (!groups[zone.region]) {
        groups[zone.region] = []
      }
      groups[zone.region].push(zone)
      return groups
    }, {})

    return Object.entries(grouped)
      .map(([region, zones]) => ({
        region,
        zones,
        closestDistance: zones.reduce(
          (minDistance, zone) => Math.min(minDistance, Number(zone.distanceToDonorKm || 0)),
          Number.POSITIVE_INFINITY,
        ),
        topPriority: zones.reduce((maxPriority, zone) => Math.max(maxPriority, zone.priorityScore), 0),
        totalShortfall: zones.reduce((sum, zone) => sum + zone.totalShortfall, 0),
        mapSlot: HOTSPOT_REGION_MAP_SLOTS[region] || 'central',
      }))
      .sort((left, right) => {
        if (sortMode === 'distance') {
          return left.closestDistance - right.closestDistance
        }
        return right.topPriority - left.topPriority
      })
  }, [sortMode, visibleHotspots])

  const handleRegionMapSelect = (region) => {
    const nextFilter = regionFilter === region ? 'all' : region
    setRegionFilter(nextFilter)

    const candidateZone = enrichedHotspots.find((zone) => zone.region === region)
    if (candidateZone) {
      setSelectedPostcode(candidateZone.postcode)
    }
  }

  return (
    <div className="post-feed-page donor-role-page donor-hotspots-page">
      <header className="navbar donor-navbar">
        <div className="navbar-inner donor-navbar-inner">
          <button className="brand-home-btn" type="button" onClick={() => navigate('/')}>
            <span className="brand-home-title">{t('appName')}</span>
          </button>

          <div className="nav-actions donor-nav-actions">
            <button className="post-action-btn" type="button" onClick={() => navigate('/form/' + focusPostcode)}>
              <span className="material-symbols-outlined">add</span>
              {t('feed.shareButton', 'Post surplus')}
            </button>
          </div>
        </div>
        <div className="navbar-divider" />
      </header>

      <main className="feed-content donor-feed-content">
        <section className="donor-page-intro">
          <div className="donor-page-heading">
            <h1 className="board-title donor-page-title">{t('hotspots.pageTitle', 'Donation hotspots')}</h1>
            <div className="donor-page-location-card" role="group" aria-label={t('listing.postcode', 'Postcode')}>
              <div className="donor-page-location-badge">
                <span className="material-symbols-outlined donor-page-location-icon">location_on</span>
              </div>
              <div className="donor-page-location-copy">
                <span className="donor-page-location-label">{t('listing.postcode', 'Postcode')}</span>
                <span className="donor-page-location-value">{focusPostcode || 'VIC'}</span>
              </div>
            </div>
          </div>
        </section>

        <div className="donor-area-nav-row">
          <DonorFeatureNav active="hotspots" postcode={focusPostcode} />
        </div>

        <section className="hotspot-board" aria-label={t('hotspots.ariaLabel', 'Hotspot priority board')}>
          <div className="hotspot-board-header">
            <div className="hotspot-board-title-wrap">
              <p className="hotspot-eyebrow">{t('hotspots.eyebrow', 'Hotspot preview')}</p>
              <h2 className="hotspot-title">{t('hotspots.title', 'Where food is needed most')}</h2>
              <p className="hotspot-subtitle">
                {t(
                  hotspotSource === 'prediction' ? 'hotspots.subtitleLive' : 'hotspots.subtitle',
                  hotspotSource === 'prediction'
                    ? 'This donor-facing board ranks postcodes by current unmet food demand and nearby supply pressure.'
                    : 'This donor-facing board uses sample hotspot data so we can keep building the frontend before live prediction data is ready.',
                )}
              </p>
              <p className="hotspot-reference-anchor">
                <span className="material-symbols-outlined">location_on</span>
                <span>
                  {focusPostcode
                    ? t('hotspots.referencePostcode', {
                        postcode: focusPostcode,
                        defaultValue: 'Based on postcode {{postcode}}',
                      })
                    : t('hotspots.referenceStatewide', 'Using a statewide fallback')}
                </span>
              </p>
              <p className="hotspot-helper-copy">
                {t(
                  'hotspots.helper',
                  'Use this to preview the donor hotspot workflow: filter regions, inspect postcode cards, then decide where to post food next.',
                )}
              </p>
              {topPriorityHotspot ? (
                <p className="hotspot-top-priority-copy">
                  <strong>{t('hotspots.topPriorityLabel', 'Top priority right now:')}</strong>{' '}
                  {t('hotspots.topPriorityHint', {
                    name: topPriorityHotspot.nearestHub.name,
                    distance: topPriorityHotspot.distanceToDonorKm,
                    shortfall: topPriorityHotspot.totalShortfall,
                    defaultValue: '{{name}} ({{distance}} km) · {{shortfall}} portions short',
                  })}
                </p>
              ) : null}
            </div>

            <div className="hotspot-chip-filter-group">
              <span className="hotspot-chip-filter-label">{t('hotspots.controls.needLevel', 'Need level')}</span>
              <div className="hotspot-chip-row">
                <button
                  type="button"
                  className={priorityFilter === 'all' ? 'hotspot-chip hotspot-chip--neutral active' : 'hotspot-chip hotspot-chip--neutral'}
                  onClick={() => setPriorityFilter('all')}
                >
                  {t('hotspots.chips.all', 'All hotspots')}
                </button>
                <button
                  type="button"
                  className={priorityFilter === 'critical' ? 'hotspot-chip hotspot-chip--critical active' : 'hotspot-chip hotspot-chip--critical'}
                  onClick={() => setPriorityFilter('critical')}
                >
                  {t('hotspots.chips.critical', {
                    count: priorityCounts.critical,
                    defaultValue: 'Critical shortage · {{count}}',
                  })}
                </button>
                <button
                  type="button"
                  className={priorityFilter === 'high' ? 'hotspot-chip hotspot-chip--high active' : 'hotspot-chip hotspot-chip--high'}
                  onClick={() => setPriorityFilter('high')}
                >
                  {t('hotspots.chips.high', {
                    count: priorityCounts.high,
                    defaultValue: 'High need · {{count}}',
                  })}
                </button>
                <button
                  type="button"
                  className={priorityFilter === 'watch' ? 'hotspot-chip hotspot-chip--watch active' : 'hotspot-chip hotspot-chip--watch'}
                  onClick={() => setPriorityFilter('watch')}
                >
                  {t('hotspots.chips.watch', {
                    count: priorityCounts.watch,
                    defaultValue: 'Watchlist · {{count}}',
                  })}
                </button>
              </div>
            </div>
          </div>

          <div className="hotspot-controls">
            <div className="hotspot-sort-group">
              <button
                type="button"
                className={sortMode === 'priority' ? 'hotspot-sort-btn active' : 'hotspot-sort-btn'}
                onClick={() => setSortMode('priority')}
              >
                {t('hotspots.controls.sortPriority', 'Sort by priority')}
              </button>
              <button
                type="button"
                className={sortMode === 'distance' ? 'hotspot-sort-btn active' : 'hotspot-sort-btn'}
                onClick={() => setSortMode('distance')}
              >
                {t('hotspots.controls.sortDistance', 'Sort by distance')}
              </button>
            </div>

            <label className="hotspot-control">
              <span>{t('hotspots.controls.region', 'Region')}</span>
              <select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)}>
                {regions.map((region) => (
                  <option key={region} value={region}>
                    {region === 'all' ? t('common.all', 'All') : region}
                  </option>
                ))}
              </select>
            </label>

            <label className="hotspot-control">
              <span>{t('hotspots.controls.distance', 'Distance')}</span>
              <select value={distanceFilter} onChange={(event) => setDistanceFilter(event.target.value)}>
                <option value="all">{t('common.all', 'All')}</option>
                <option value="10">{t('hotspots.controls.within10', 'Within 10 km')}</option>
                <option value="25">{t('hotspots.controls.within25', 'Within 25 km')}</option>
                <option value="50">{t('hotspots.controls.within50', 'Within 50 km')}</option>
              </select>
            </label>
          </div>

          {SHOW_SAMPLE_HINT && hotspotSource !== 'prediction' ? (
            <p className="hotspot-sample-note">
              {t(
                'hotspots.sampleNote',
                'Preview mode: hotspot regions, priorities, and shortage types here use frontend sample data until live prediction data is connected.',
              )}
            </p>
          ) : null}
          <p className="hotspot-region-guide">
            {t(
              'hotspots.regionGuide',
              'Read this like a region map: metro and regional clusters are grouped visually so donors can spot where shortages concentrate first.',
            )}
          </p>

          <section className="hotspot-map-shell" aria-label={t('hotspots.mapShellLabel', 'Regional hotspot map shell')}>
            <div className="hotspot-map-shell-header">
              <div>
                <p className="hotspot-map-shell-eyebrow">{t('hotspots.mapShellEyebrow', HOTSPOT_MAP_STAGE_COPY.eyebrow)}</p>
                <h3>{t('hotspots.mapShellTitle', HOTSPOT_MAP_STAGE_COPY.title)}</h3>
              </div>
              <p>
                {t('hotspots.mapShellHint', HOTSPOT_MAP_STAGE_COPY.subtitle)}
              </p>
            </div>

            <div className={isFocusedRegion ? 'hotspot-map-stage is-focused-region' : 'hotspot-map-stage'}>
              <div className="hotspot-map-stage-grid" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>

              {hotspotRegionGroups.map((group) => {
                const leadZone = group.zones[0]
                return (
                  <button
                    key={`map-${group.region}`}
                    type="button"
                    className={[
                      'hotspot-map-node',
                      `hotspot-map-node--${group.mapSlot}`,
                      `hotspot-map-node-tone--${leadZone?.priorityBand?.tone || 'watch'}`,
                      regionFilter === group.region ? 'is-active' : '',
                    ].join(' ')}
                    onClick={() => handleRegionMapSelect(group.region)}
                  >
                    <span className="hotspot-map-node-region">{group.region}</span>
                    <strong>
                      {t('hotspots.clusterMetaValue', {
                        count: group.zones.length,
                        defaultValue: '{{count}} postcodes',
                      })}
                    </strong>
                    <small>
                      {t('hotspots.metrics.shortfall', {
                        shortfall: group.totalShortfall,
                        defaultValue: '{{shortfall}} portions short',
                      })}
                    </small>
                  </button>
                )
              })}
            </div>
          </section>

          <div className="hotspot-layout">
            <div className={isFocusedRegion ? 'hotspot-region-grid is-focused-region' : 'hotspot-region-grid'}>
              {hotspotRegionGroups.length === 0 ? (
                <div className="hotspot-grid-empty">
                  <strong>{t('hotspots.emptyTitle', 'No hotspots match these filters.')}</strong>
                  <span>{t('hotspots.emptyHint', 'Try a wider region or distance range.')}</span>
                </div>
              ) : (
                hotspotRegionGroups.map((group) => (
                  <div
                    key={group.region}
                    className={`hotspot-region-cluster hotspot-region-cluster--${group.mapSlot}`}
                  >
                    <div className="hotspot-region-cluster-head">
                      <div>
                        <p className="hotspot-region-cluster-label">{t('hotspots.clusterLabel', 'Region cluster')}</p>
                        <h3>{group.region}</h3>
                      </div>
                      <div className="hotspot-region-cluster-meta">
                        <span>{t('hotspots.clusterMeta', 'Visible')}</span>
                        <strong>
                          {t('hotspots.clusterMetaValue', {
                            count: group.zones.length,
                            defaultValue: '{{count}} postcodes',
                          })}
                        </strong>
                      </div>
                    </div>

                    <div className="hotspot-zone-grid">
                      {group.zones.map((zone) => (
                        <button
                          key={zone.postcode}
                          type="button"
                          className={[
                            'hotspot-zone-card',
                            `hotspot-zone-card--${zone.priorityBand.tone}`,
                            selectedHotspot?.postcode === zone.postcode ? 'is-active' : '',
                          ].join(' ')}
                          onClick={() => setSelectedPostcode(zone.postcode)}
                        >
                          <div className="hotspot-zone-row">
                            <strong>{zone.postcode}</strong>
                            <span>{zone.priorityBand.label}</span>
                          </div>
                          <p>{zone.nearestHub.name}</p>
                          <div className="hotspot-zone-metrics">
                            <span>
                              {t('hotspots.metrics.distance', {
                                distance: zone.distanceToDonorKm,
                                defaultValue: '{{distance}} km away',
                              })}
                            </span>
                            <span>
                              {t('hotspots.metrics.shortfall', {
                                shortfall: zone.totalShortfall,
                                defaultValue: '{{shortfall}} portions short',
                              })}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <aside className="hotspot-detail-panel">
              {selectedHotspot ? (
                <>
                  <h3>
                    {selectedHotspot.region} · {selectedHotspot.postcode}
                  </h3>
                  <p>
                    {t('hotspots.detailIntro', {
                      name: selectedHotspot.nearestHub.name,
                      defaultValue: 'Nearest collection point: {{name}}',
                    })}
                  </p>

                  <div className="hotspot-detail-stats">
                    <div>
                      <span>{t('hotspots.fields.priority', 'Priority score')}</span>
                      <strong>{selectedHotspot.priorityScore}</strong>
                    </div>
                    <div>
                      <span>{t('hotspots.fields.populationNeed', 'Population in need')}</span>
                      <strong>{selectedHotspot.estimatedPopulationInNeed}</strong>
                    </div>
                    <div>
                      <span>{t('hotspots.fields.activeListings', 'Active listings')}</span>
                      <strong>{selectedHotspot.activeListings}</strong>
                    </div>
                    <div>
                      <span>{t('hotspots.fields.distance', 'Distance')}</span>
                      <strong>
                        {t('hotspots.fields.distanceValue', {
                          distance: selectedHotspot.distanceToDonorKm,
                          defaultValue: '{{distance}} km',
                        })}
                      </strong>
                    </div>
                  </div>

                  <ul className="hotspot-needed-list">
                    {selectedHotspot.neededItems.map((item) => (
                      <li key={`${selectedHotspot.postcode}-${item.category}`}>
                        <span>{item.category}</span>
                        <strong>
                          {t('hotspots.neededItem', {
                            count: item.shortfallPortions,
                            defaultValue: '{{count}} short',
                          })}
                        </strong>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <h3>{t('hotspots.detailPlaceholderTitle', 'Choose a hotspot')}</h3>
                  <p>{t('hotspots.detailPlaceholderHint', 'Select a postcode card to inspect the sample need breakdown.')}</p>
                </>
              )}
            </aside>
          </div>
        </section>
      </main>
    </div>
  )
}

export default DonorHotspotsPage
