import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import DonorFeatureNav from '../components/DonorFeatureNav'
import {
  computeHotspotPriorityScore,
  computeTotalShortfall,
  getNeededItems,
  getPriorityBand,
} from '../constants/hotspotInsights'
import { getSavedDonorPostcode, saveDonorPostcode } from '../utils/donorPostcode'
import { hotspotSampleZones } from '../utils/hotspotSampleData'
import '../styles/PostFeedPage.css'

function getInitialSelectedPostcode(preferredPostcode) {
  if (preferredPostcode && hotspotSampleZones.some((zone) => zone.postcode === preferredPostcode)) {
    return preferredPostcode
  }
  return hotspotSampleZones[0]?.postcode || ''
}

const hotspotRegionMapSlots = {
  'Regional North': 'north',
  'North-East': 'north-east',
  'North Melbourne': 'north-central',
  'Inner Melbourne': 'central',
  West: 'west',
  'Regional West': 'south-west',
  'South-East': 'south-east',
}

const HOTSPOT_REGION_OPTION_GROUPS = [
  {
    labelKey: 'hotspots.controls.groups.metro',
    defaultLabel: 'Metro areas',
    regions: ['Inner Melbourne', 'North Melbourne'],
  },
  {
    labelKey: 'hotspots.controls.groups.greater',
    defaultLabel: 'Greater regions',
    regions: ['North-East', 'South-East', 'West'],
  },
  {
    labelKey: 'hotspots.controls.groups.regional',
    defaultLabel: 'Regional',
    regions: ['Regional North', 'Regional West'],
  },
]

const DonorHotspotsPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { postcode: postcodeFromPath } = useParams()
  const { t, i18n } = useTranslation()
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
  const [hotspotSortMode, setHotspotSortMode] = useState('priority')
  const [hotspotRegionFilter, setHotspotRegionFilter] = useState('all')
  const [hotspotDistanceFilter, setHotspotDistanceFilter] = useState('all')
  const [hotspotPriorityFilter, setHotspotPriorityFilter] = useState('all')
  const [isApplyingFilters, setIsApplyingFilters] = useState(false)
  const [appliedFilters, setAppliedFilters] = useState({
    sort: 'priority',
    region: 'all',
    distance: 'all',
    priority: 'all',
  })
  const hasMountedFilterRef = useRef(false)

  const focusPostcode = String(location.state?.postcode || postcodeFromPath || getSavedDonorPostcode() || '').trim()
  const [selectedHotspotPostcode, setSelectedHotspotPostcode] = useState(
    getInitialSelectedPostcode(focusPostcode),
  )

  useEffect(() => {
    if (focusPostcode) {
      saveDonorPostcode(focusPostcode)
    }
  }, [focusPostcode])

  const hotspotRegions = useMemo(() => {
    const regions = Array.from(new Set(hotspotSampleZones.map((zone) => zone.region)))
    return ['all', ...regions]
  }, [])

  const hotspotRegionFilterGroups = useMemo(() => {
    const availableRegions = new Set(hotspotRegions.filter((region) => region !== 'all'))
    return HOTSPOT_REGION_OPTION_GROUPS.map((group) => ({
      ...group,
      regions: group.regions.filter((region) => availableRegions.has(region)),
    })).filter((group) => group.regions.length > 0)
  }, [hotspotRegions])

  useEffect(() => {
    if (!hasMountedFilterRef.current) {
      hasMountedFilterRef.current = true
      return
    }

    setIsApplyingFilters(true)
    const timeoutId = window.setTimeout(() => {
      setAppliedFilters({
        sort: hotspotSortMode,
        region: hotspotRegionFilter,
        distance: hotspotDistanceFilter,
        priority: hotspotPriorityFilter,
      })
      setIsApplyingFilters(false)
    }, 220)

    return () => window.clearTimeout(timeoutId)
  }, [hotspotDistanceFilter, hotspotPriorityFilter, hotspotRegionFilter, hotspotSortMode])

  const visibleHotspots = useMemo(() => {
    const enriched = hotspotSampleZones.map((zone) => {
      const priorityScore = computeHotspotPriorityScore(zone)
      return {
        ...zone,
        priorityScore,
        priorityBand: getPriorityBand(priorityScore),
        neededItems: getNeededItems(zone.shortageItems),
        totalShortfall: computeTotalShortfall(zone.shortageItems),
      }
    })

    let zones = [...enriched]

    if (appliedFilters.region !== 'all') {
      zones = zones.filter((zone) => zone.region === appliedFilters.region)
    }

    if (appliedFilters.distance !== 'all') {
      const maxDistance = Number(appliedFilters.distance)
      zones = zones.filter((zone) => Number(zone.distanceToDonorKm || 0) <= maxDistance)
    }

    if (appliedFilters.priority !== 'all') {
      zones = zones.filter((zone) => zone.priorityBand.tone === appliedFilters.priority)
    }

    if (appliedFilters.sort === 'distance') {
      return zones.sort((a, b) => Number(a.distanceToDonorKm || 0) - Number(b.distanceToDonorKm || 0))
    }

    return zones.sort((a, b) => b.priorityScore - a.priorityScore)
  }, [appliedFilters])

  const selectedHotspot = useMemo(() => {
    if (visibleHotspots.length === 0) return null
    return (
      visibleHotspots.find((zone) => zone.postcode === selectedHotspotPostcode) || visibleHotspots[0]
    )
  }, [selectedHotspotPostcode, visibleHotspots])

  const hotspotRegionGroups = useMemo(() => {
    const groupedByRegion = visibleHotspots.reduce((groups, zone) => {
      if (!groups[zone.region]) {
        groups[zone.region] = []
      }
      groups[zone.region].push(zone)
      return groups
    }, {})

    const groups = Object.entries(groupedByRegion).map(([region, zones]) => {
      const closestDistance = zones.reduce(
        (minDistance, zone) => Math.min(minDistance, Number(zone.distanceToDonorKm || 0)),
        Number.POSITIVE_INFINITY,
      )
      const topPriority = zones.reduce((maxPriority, zone) => Math.max(maxPriority, zone.priorityScore), 0)
      const totalShortfall = zones.reduce((sum, zone) => sum + zone.totalShortfall, 0)
      return {
        region,
        zones,
        closestDistance,
        topPriority,
        totalShortfall,
        mapSlot: hotspotRegionMapSlots[region] || 'east',
      }
    })

    if (appliedFilters.sort === 'distance') {
      return groups.sort((a, b) => a.closestDistance - b.closestDistance)
    }

    return groups.sort((a, b) => b.topPriority - a.topPriority)
  }, [appliedFilters.sort, visibleHotspots])

  useEffect(() => {
    setSelectedHotspotPostcode(visibleHotspots[0]?.postcode || '')
  }, [visibleHotspots])

  const priorityCounts = useMemo(() => {
    return hotspotSampleZones.reduce(
      (counts, zone) => {
        const band = getPriorityBand(computeHotspotPriorityScore(zone)).tone
        counts[band] += 1
        return counts
      },
      { critical: 0, high: 0, watch: 0 },
    )
  }, [])

  const hotspotEmptyState = useMemo(() => {
    if (appliedFilters.distance !== 'all') {
      const expansionTarget = appliedFilters.distance === '10' ? '25' : appliedFilters.distance === '25' ? '50' : ''
      return {
        title: t('hotspots.emptyDistanceTitle', {
          distance: appliedFilters.distance,
          defaultValue: 'No hotspots within {{distance}} km.',
        }),
        hint: expansionTarget
          ? t('hotspots.emptyDistanceHint', {
              distance: expansionTarget,
              defaultValue: 'Try expanding your distance range to {{distance}} km or more.',
            })
          : t('hotspots.emptyHint', 'Try all regions or a wider distance range.'),
      }
    }

    return {
      title: t('hotspots.emptyTitle', 'No hotspots match these filters.'),
      hint: t('hotspots.emptyHint', 'Try all regions or a wider distance range.'),
    }
  }, [appliedFilters.distance, t])

  const topPriorityHotspot = useMemo(() => {
    if (visibleHotspots.length === 0) return null
    const ranked = [...visibleHotspots].sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore
      }
      return Number(a.distanceToDonorKm || 0) - Number(b.distanceToDonorKm || 0)
    })
    return ranked[0]
  }, [visibleHotspots])

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang)
    localStorage.setItem('preferredLanguage', lang)
    setShowLanguageMenu(false)
  }

  return (
    <div className="post-feed-page donor-role-page donor-hotspots-page">
      <header className="navbar donor-navbar">
        <div className="navbar-inner donor-navbar-inner">
          <button
            className="brand-home-btn"
            type="button"
            onClick={() => navigate('/donor', { state: { postcode: focusPostcode } })}
          >
            <span className="brand-home-title">{t('appName')}</span>
          </button>

          <div className="nav-actions donor-nav-actions">
            <div className="language-btn-wrapper">
              <button className="nav-icon-btn" type="button" onClick={() => setShowLanguageMenu((prev) => !prev)}>
                <span className="material-symbols-outlined">language</span>
              </button>
              {showLanguageMenu ? (
                <div className="language-menu">
                  <button type="button" onClick={() => handleLanguageChange('en')}>English</button>
                  <button type="button" onClick={() => handleLanguageChange('zh')}>中文</button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="navbar-divider" />
      </header>

      <main className="feed-content donor-feed-content">
        <div className="donor-area-nav-row">
          <DonorFeatureNav active="hotspots" postcode={focusPostcode} />
        </div>

        <section className="hotspot-board" aria-label={t('hotspots.ariaLabel', 'Hotspot priority map')}>
          <div className="hotspot-board-header">
            <div className="hotspot-board-title-wrap">
              <p className="hotspot-eyebrow">{t('hotspots.eyebrow', 'Hotspot map')}</p>
              <h2 className="hotspot-title">{t('hotspots.title', 'Where food is needed most')}</h2>
              <p className="hotspot-subtitle">{t('hotspots.subtitle', 'Food shortage hotspots near your reference postcode.')}</p>
              <p className="hotspot-reference-anchor">
                <span className="material-symbols-outlined">location_on</span>
                <span>
                  {focusPostcode
                    ? t('hotspots.referencePostcode', {
                        postcode: focusPostcode,
                        defaultValue: 'Based on postcode {{postcode}}',
                      })
                    : t('hotspots.referenceStatewide', 'Based on state-wide baseline')}
                </span>
              </p>
              <p className="hotspot-helper-copy">{t('hotspots.helper', 'Start from region clusters, then open a postcode card to inspect exact shortage details.')}</p>
              {topPriorityHotspot ? (
                <p className="hotspot-top-priority-copy">
                  <strong>{t('hotspots.topPriorityLabel', 'Top priority right now:')}</strong>{' '}
                  {t('hotspots.topPriorityHint', {
                    name: topPriorityHotspot.nearestHub.name,
                    distance: topPriorityHotspot.distanceToDonorKm,
                    shortfall: topPriorityHotspot.totalShortfall,
                    defaultValue: '{{name}} ({{distance}} km) - {{shortfall}} portions short',
                  })}
                </p>
              ) : null}
            </div>
            <div className="hotspot-chip-filter-group">
              <span className="hotspot-chip-filter-label">{t('hotspots.controls.needLevel', 'Need level')}</span>
              <div className="hotspot-chip-row">
                <button
                  type="button"
                  className={hotspotPriorityFilter === 'all' ? 'hotspot-chip hotspot-chip--neutral active' : 'hotspot-chip hotspot-chip--neutral'}
                  onClick={() => setHotspotPriorityFilter('all')}
                >
                  {t('hotspots.chips.all', 'All hotspots')}
                </button>
                <button
                  type="button"
                  title={t('hotspots.chips.criticalTitle', 'Show urgent shortage hotspots')}
                  className={hotspotPriorityFilter === 'critical' ? 'hotspot-chip hotspot-chip--critical active' : 'hotspot-chip hotspot-chip--critical'}
                  onClick={() => setHotspotPriorityFilter('critical')}
                >
                  {t('hotspots.chips.critical', { count: priorityCounts.critical, defaultValue: 'Critical shortage · {{count}}' })}
                </button>
                <button
                  type="button"
                  title={
                    priorityCounts.high === 0
                      ? t('hotspots.chips.highEmptyTitle', 'No high-need hotspots right now')
                      : t('hotspots.chips.highTitle', 'Show high-need hotspots')
                  }
                  disabled={priorityCounts.high === 0}
                  className={hotspotPriorityFilter === 'high' ? 'hotspot-chip hotspot-chip--high active' : 'hotspot-chip hotspot-chip--high'}
                  onClick={() => setHotspotPriorityFilter('high')}
                >
                  {t('hotspots.chips.high', { count: priorityCounts.high, defaultValue: 'High need · {{count}}' })}
                </button>
                <button
                  type="button"
                  title={t('hotspots.chips.watchTitle', 'Show emerging-risk hotspots to monitor')}
                  className={hotspotPriorityFilter === 'watch' ? 'hotspot-chip hotspot-chip--watch active' : 'hotspot-chip hotspot-chip--watch'}
                  onClick={() => setHotspotPriorityFilter('watch')}
                >
                  {t('hotspots.chips.watch', { count: priorityCounts.watch, defaultValue: 'Watchlist risk · {{count}}' })}
                </button>
              </div>
            </div>
          </div>

          <div className="hotspot-controls">
            <label className="hotspot-control">
              <span>{t('hotspots.controls.view', 'View')}</span>
              <select
                value={hotspotRegionFilter}
                onChange={(event) => setHotspotRegionFilter(event.target.value)}
              >
                <option value="all">{t('hotspots.controls.allRegions', 'All regions (state-wide)')}</option>
                {hotspotRegionFilterGroups.map((group) => (
                  <optgroup
                    key={group.labelKey}
                    label={t(group.labelKey, group.defaultLabel)}
                  >
                    {group.regions.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <label className="hotspot-control">
              <span>{t('hotspots.controls.distance', 'Distance')}</span>
              <select
                value={hotspotDistanceFilter}
                onChange={(event) => setHotspotDistanceFilter(event.target.value)}
              >
                <option value="all">{t('hotspots.controls.anyDistance', 'Any distance')}</option>
                <option value="10">{t('hotspots.controls.within10', 'Within 10 km')}</option>
                <option value="25">{t('hotspots.controls.within25', 'Within 25 km')}</option>
                <option value="50">{t('hotspots.controls.within50', 'Within 50 km')}</option>
              </select>
            </label>

            <label className="hotspot-control">
              <span>{t('hotspots.controls.sort', 'Sort')}</span>
              <select
                value={hotspotSortMode}
                onChange={(event) => setHotspotSortMode(event.target.value)}
              >
                <option value="priority">{t('hotspots.controls.sortPriority', 'Priority (highest need first)')}</option>
                <option value="distance">{t('hotspots.controls.sortDistance', 'Distance (closest first)')}</option>
              </select>
            </label>
          </div>

          <p className="hotspot-region-guide">
            {t(
              'hotspots.controls.groupHint',
              'Metro = inner city areas. Greater = surrounding suburbs. Regional = outside metro regions.',
            )}
          </p>

          <p className="hotspot-legend-copy">
            {t('hotspots.legendCopy', 'Critical shortage = urgent need. High need = strong demand. Watchlist risk = areas to monitor next.')}
          </p>
          <p className="hotspot-sample-note">
            {t('hotspots.sampleNote', 'Sample data only. Live hotspot scoring will be connected after database integration.')}
          </p>

          <div className={isApplyingFilters ? 'hotspot-layout is-updating' : 'hotspot-layout'}>
            {isApplyingFilters ? (
              <div className="hotspot-update-overlay" role="status" aria-live="polite" aria-atomic="true">
                <div className="hotspot-update-pill">
                  <span className="material-symbols-outlined">sync</span>
                  <span>{t('hotspots.updating', 'Updating hotspots...')}</span>
                </div>
              </div>
            ) : null}
            <div
              className={appliedFilters.region === 'all' ? 'hotspot-region-grid' : 'hotspot-region-grid is-focused-region'}
              role="list"
            >
              {hotspotRegionGroups.length === 0 ? (
                <div className="hotspot-grid-empty">
                  <strong>{hotspotEmptyState.title}</strong>
                  <span>{hotspotEmptyState.hint}</span>
                </div>
              ) : (
                hotspotRegionGroups.map((group) => (
                  <section
                    key={group.region}
                    role="listitem"
                    className={[
                      'hotspot-region-cluster',
                      `hotspot-region-cluster--${group.mapSlot}`,
                    ]
                      .join(' ')
                      .trim()}
                  >
                    <header className="hotspot-region-cluster-head">
                      <div>
                        <p className="hotspot-region-cluster-label">{group.region}</p>
                        <h3>{t('hotspots.regionCount', { count: group.zones.length, defaultValue: '{{count}} hotspots' })}</h3>
                      </div>
                      <div className="hotspot-region-cluster-meta">
                        <span>
                          {appliedFilters.sort === 'distance'
                            ? t('hotspots.clusterClosest', {
                                distance: group.closestDistance.toFixed(1),
                                defaultValue: 'Closest {{distance}} km',
                              })
                            : t('hotspots.clusterPriority', {
                                score: group.topPriority,
                                defaultValue: 'Top priority {{score}}',
                              })}
                        </span>
                        <strong>{t('hotspots.clusterShortfall', { count: group.totalShortfall, defaultValue: '{{count}} portions short' })}</strong>
                      </div>
                    </header>

                    <div className="hotspot-zone-grid">
                      {group.zones.map((zone) => (
                        <button
                          key={zone.postcode}
                          type="button"
                          className={[
                            'hotspot-zone-card',
                            `hotspot-zone-card--${zone.priorityBand.tone}`,
                            selectedHotspot?.postcode === zone.postcode ? 'is-active' : '',
                          ]
                            .join(' ')
                            .trim()}
                          onClick={() => setSelectedHotspotPostcode(zone.postcode)}
                        >
                          <div className="hotspot-zone-row">
                            <strong>{zone.postcode}</strong>
                            <span>
                              {t(`hotspots.priorityBands.${zone.priorityBand.tone}`, zone.priorityBand.label)}
                            </span>
                          </div>
                          <p>{zone.nearestHub.name}</p>
                          <div className="hotspot-zone-metrics">
                            <span>{t('hotspots.metrics.needScore', { count: zone.resourceRequirement, defaultValue: 'Need score {{count}}' })}</span>
                            <span>{t('hotspots.metrics.activeListings', { count: zone.activeListings, defaultValue: 'Active listings {{count}}' })}</span>
                            <span>{t('hotspots.metrics.priority', { count: zone.priorityScore, defaultValue: 'Priority {{count}}' })}</span>
                            <span>{t('hotspots.metrics.distanceAway', { distance: zone.distanceToDonorKm, defaultValue: '{{distance}} km away' })}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>

            {selectedHotspot ? (
              <aside className="hotspot-detail-panel" aria-live="polite">
                <h3>{t('hotspots.detailTitle', { postcode: selectedHotspot.postcode, defaultValue: 'Hotspot detail · {{postcode}}' })}</h3>
                <p>{t('hotspots.detailHint', 'Only currently needed categories are shown.')}</p>

                <div className="hotspot-detail-stats">
                  <div>
                    <span>{t('hotspots.detailStats.shortfall', 'Current shortfall')}</span>
                    <strong>{t('hotspots.portions', { count: selectedHotspot.totalShortfall, defaultValue: '{{count}} portions' })}</strong>
                  </div>
                  <div>
                    <span>{t('hotspots.detailStats.distance', 'Approx. distance')}</span>
                    <strong>{t('hotspots.kilometres', { distance: selectedHotspot.distanceToDonorKm, defaultValue: '{{distance}} km' })}</strong>
                  </div>
                  <div>
                    <span>{t('hotspots.detailStats.nearestSupply', 'Nearest supply point')}</span>
                    <strong>
                      {t('hotspots.nearestHub', {
                        name: selectedHotspot.nearestHub.name,
                        distance: selectedHotspot.nearestHub.distanceKm,
                        defaultValue: '{{name}} ({{distance}} km)',
                      })}
                    </strong>
                  </div>
                </div>

                <ul className="hotspot-needed-list">
                  {selectedHotspot.neededItems.map((item) => (
                    <li key={item.category}>
                      <span>{item.category}</span>
                      <strong>{t('hotspots.shortageAmount', { count: item.shortfallPortions, defaultValue: '{{count}} portions short' })}</strong>
                    </li>
                  ))}
                </ul>
              </aside>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  )
}

export default DonorHotspotsPage
