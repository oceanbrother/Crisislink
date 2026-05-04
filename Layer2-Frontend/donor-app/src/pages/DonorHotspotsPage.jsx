import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import WorkspaceHeader from '../components/WorkspaceHeader'
import DonorFeatureNav from '../components/DonorFeatureNav'
import PostcodeMap from '../components/PostcodeMap'
import { getHotspots } from '../services/api'
import {
  computeHotspotPriorityScore,
  computeTotalShortfall,
  getNeededItems,
  getPriorityBand,
} from '../constants/hotspotInsights'
import { getSavedDonorPostcode, saveDonorPostcode } from '../utils/donorPostcode'
import { hotspotSampleZones } from '../utils/hotspotSampleData'
import { buildHotspotsFromPredictionData } from '../utils/predictionAdapters'
import '../styles/PostFeedPage.css'

const SHOW_SAMPLE_HINT = Boolean(import.meta.env.DEV)

const DonorHotspotsPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { postcode: postcodeFromPath } = useParams()
  const { t } = useTranslation()

  const focusPostcode = String(
    location.state?.postcode || postcodeFromPath || getSavedDonorPostcode() || '',
  ).trim()

  const [regionFilter, setRegionFilter] = useState('all')
  const [distanceFilter, setDistanceFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [sortMode, setSortMode] = useState('priority')
  const [hotspotZones, setHotspotZones] = useState(hotspotSampleZones)
  const [hotspotSource, setHotspotSource] = useState('sample')
  const [selectedPostcode, setSelectedPostcode] = useState(hotspotSampleZones[0]?.postcode || '')

  useEffect(() => {
    if (focusPostcode) {
      saveDonorPostcode(focusPostcode)
    }
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
      } catch {
        // prediction service is optional during frontend-only development
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

    return sortMode === 'distance'
      ? zones.sort((a, b) => Number(a.distanceToDonorKm || 0) - Number(b.distanceToDonorKm || 0))
      : zones.sort((a, b) => b.priorityScore - a.priorityScore)
  }, [distanceFilter, enrichedHotspots, priorityFilter, regionFilter, sortMode])

  useEffect(() => {
    setSelectedPostcode((currentSelection) => {
      if (visibleHotspots.some((zone) => zone.postcode === currentSelection)) {
        return currentSelection
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
        counts[zone.priorityBand.tone] = (counts[zone.priorityBand.tone] || 0) + 1
        return counts
      },
      { critical: 0, high: 0, watch: 0 },
    )
  }, [enrichedHotspots])

  const mapZones = useMemo(() => {
    return visibleHotspots.map((zone) => ({
      postcode: zone.postcode,
      suburb: zone.region,
      tone: zone.priorityBand.tone,
      metric: `${zone.totalShortfall} portions short`,
    }))
  }, [visibleHotspots])

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

  return (
    <div className="post-feed-page donor-role-page donor-hotspots-page">
      <WorkspaceHeader
        role="donor"
        onBackClick={() => navigate('/donor/listings', { state: { postcode: focusPostcode } })}
        onBrandClick={() => navigate('/roles')}
      />

      <main className="feed-content donor-feed-content">
        <div className="workspace-nav-row donor-area-nav-row">
          <DonorFeatureNav active="hotspots" postcode={focusPostcode} />
        </div>

        <section className="hotspot-board" aria-label={t('hotspots.ariaLabel', 'Hotspot priority board')}>
          <div className="hotspot-board-header">
            <div className="hotspot-board-title-wrap">
              <p className="hotspot-eyebrow">{t('hotspots.eyebrow', 'Hotspot map')}</p>
              <h2 className="hotspot-title">{t('hotspots.title', 'Where food is needed most')}</h2>
              <p className="hotspot-subtitle">
                {t('hotspots.subtitle', 'Food shortage hotspots near your reference postcode.')}
              </p>
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
              <p className="hotspot-helper-copy">
                {t(
                  'hotspots.helper',
                  'Use the map to inspect where food is most needed, then open a postcode panel to see shortage detail.',
                )}
              </p>
              {topPriorityHotspot ? (
                <p className="hotspot-top-priority-copy">
                  <strong>{t('hotspots.topPriorityLabel', 'Top priority right now:')}</strong>{' '}
                  {t('hotspots.topPriorityHint', {
                    name: topPriorityHotspot.nearestHub?.name || topPriorityHotspot.region,
                    distance: topPriorityHotspot.distanceToDonorKm,
                    shortfall: topPriorityHotspot.totalShortfall,
                    defaultValue: '{{name}} ({{distance}} km) - {{shortfall}} portions short',
                  })}
                </p>
              ) : null}
            </div>

            <div className="hotspot-chip-filter-group hotspot-chip-filter-group--compact">
              <div className="hotspot-chip-row">
                <button
                  type="button"
                  className={`hotspot-chip hotspot-chip--neutral${priorityFilter === 'all' ? ' active' : ''}`}
                  onClick={() => setPriorityFilter('all')}
                >
                  {t('hotspots.chips.all', 'All')}
                </button>
                <button
                  type="button"
                  className={`hotspot-chip hotspot-chip--critical${priorityFilter === 'critical' ? ' active' : ''}`}
                  onClick={() => setPriorityFilter('critical')}
                >
                  {t('hotspots.chips.critical', {
                    count: priorityCounts.critical,
                    defaultValue: 'Critical · {{count}}',
                  })}
                </button>
                <button
                  type="button"
                  className={`hotspot-chip hotspot-chip--high${priorityFilter === 'high' ? ' active' : ''}`}
                  onClick={() => setPriorityFilter('high')}
                >
                  {t('hotspots.chips.high', { count: priorityCounts.high, defaultValue: 'High · {{count}}' })}
                </button>
                <button
                  type="button"
                  className={`hotspot-chip hotspot-chip--watch${priorityFilter === 'watch' ? ' active' : ''}`}
                  onClick={() => setPriorityFilter('watch')}
                >
                  {t('hotspots.chips.watch', {
                    count: priorityCounts.watch,
                    defaultValue: 'Watch · {{count}}',
                  })}
                </button>
              </div>
            </div>
          </div>

          <div className="hotspot-map-layout">
            <div className="hotspot-map-col">
              <div className="hotspot-controls hotspot-controls--inline">
                <div className="hotspot-sort-group">
                  <button
                    type="button"
                    className={`hotspot-sort-btn${sortMode === 'priority' ? ' active' : ''}`}
                    onClick={() => setSortMode('priority')}
                  >
                    {t('hotspots.controls.sortPriority', 'Priority')}
                  </button>
                  <button
                    type="button"
                    className={`hotspot-sort-btn${sortMode === 'distance' ? ' active' : ''}`}
                    onClick={() => setSortMode('distance')}
                  >
                    {t('hotspots.controls.sortDistance', 'Distance')}
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
                  <span>{t('hotspots.controls.distance', 'Dist.')}</span>
                  <select value={distanceFilter} onChange={(event) => setDistanceFilter(event.target.value)}>
                    <option value="all">{t('common.all', 'All')}</option>
                    <option value="10">≤ 10 km</option>
                    <option value="25">≤ 25 km</option>
                    <option value="50">≤ 50 km</option>
                  </select>
                </label>
              </div>

              <PostcodeMap
                zones={mapZones}
                selectedPostcode={selectedPostcode}
                onSelect={setSelectedPostcode}
                height={440}
              />

              <div className="hotspot-map-legend">
                <span className="hotspot-legend-dot hotspot-legend-dot--critical" />
                <span className="hotspot-legend-label">Critical</span>
                <span className="hotspot-legend-dot hotspot-legend-dot--high" />
                <span className="hotspot-legend-label">High</span>
                <span className="hotspot-legend-dot hotspot-legend-dot--watch" />
                <span className="hotspot-legend-label">Watch</span>
              </div>

              {SHOW_SAMPLE_HINT && hotspotSource !== 'prediction' ? (
                <p className="hotspot-sample-note">
                  {t('hotspots.sampleNote', 'Sample data only. Live hotspot scoring will be connected after database integration.')}
                </p>
              ) : null}
            </div>

            <aside className="hotspot-detail-panel">
              {selectedHotspot ? (
                <>
                  <div className="hotspot-detail-head">
                    <h3>{selectedHotspot.postcode}</h3>
                    <span className={`hotspot-detail-badge hotspot-detail-badge--${selectedHotspot.priorityBand.tone}`}>
                      {selectedHotspot.priorityBand.label}
                    </span>
                  </div>

                  <p className="hotspot-detail-hub">
                    <span className="material-symbols-outlined">store</span>
                    {selectedHotspot.nearestHub?.name || selectedHotspot.region}
                  </p>

                  <div className="hotspot-detail-stats">
                    <div>
                      <span>{t('hotspots.fields.distance', 'Distance')}</span>
                      <strong>{selectedHotspot.distanceToDonorKm} km</strong>
                    </div>
                    <div>
                      <span>{t('hotspots.fields.populationNeed', 'In need')}</span>
                      <strong>{selectedHotspot.estimatedPopulationInNeed}</strong>
                    </div>
                    <div>
                      <span>{t('hotspots.fields.activeListings', 'Listings')}</span>
                      <strong>{selectedHotspot.activeListings}</strong>
                    </div>
                    <div>
                      <span>{t('hotspots.fields.priority', 'Score')}</span>
                      <strong>{selectedHotspot.priorityScore}</strong>
                    </div>
                  </div>

                  <h4 className="hotspot-needed-heading">{t('hotspots.neededHeading', 'Items needed')}</h4>
                  <ul className="hotspot-needed-list">
                    {selectedHotspot.neededItems.map((item) => (
                      <li key={`${selectedHotspot.postcode}-${item.category}`}>
                        <span>{item.category}</span>
                        <strong>{item.shortfallPortions} short</strong>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    className="hotspot-post-cta"
                    onClick={() =>
                      navigate('/donor/post', {
                        state: {
                          postcode: focusPostcode,
                          targetPostcode: selectedHotspot.postcode,
                          orgMode: false,
                        },
                      })
                    }
                  >
                    <span className="material-symbols-outlined">volunteer_activism</span>
                    {t('hotspots.postHere', 'Post food here')}
                  </button>
                </>
              ) : (
                <div className="hotspot-detail-placeholder">
                  <span className="material-symbols-outlined">location_searching</span>
                  <p>{t('hotspots.detailPlaceholderHint', 'Select a postcode on the map')}</p>
                </div>
              )}
            </aside>
          </div>
        </section>
      </main>
    </div>
  )
}

export default DonorHotspotsPage
