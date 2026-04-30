import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import DonorFeatureNav from '../components/DonorFeatureNav'
import PostcodeMap from '../components/PostcodeMap'
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
const SHOW_SAMPLE_HINT = Boolean(import.meta.env.DEV)

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
      } catch {
        // prediction service is optional during frontend-only development
      }
      if (!isCancelled) {
        setHotspotZones(hotspotSampleZones)
        setHotspotSource('sample')
      }
    }
    loadHotspots()
    return () => { isCancelled = true }
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
    return ['all', ...new Set(enrichedHotspots.map((z) => z.region))]
  }, [enrichedHotspots])

  const visibleHotspots = useMemo(() => {
    let zones = [...enrichedHotspots]
    if (regionFilter !== 'all') zones = zones.filter((z) => z.region === regionFilter)
    if (distanceFilter !== 'all') zones = zones.filter((z) => Number(z.distanceToDonorKm || 0) <= Number(distanceFilter))
    if (priorityFilter !== 'all') zones = zones.filter((z) => z.priorityBand.tone === priorityFilter)
    return sortMode === 'distance'
      ? zones.sort((a, b) => Number(a.distanceToDonorKm || 0) - Number(b.distanceToDonorKm || 0))
      : zones.sort((a, b) => b.priorityScore - a.priorityScore)
  }, [distanceFilter, enrichedHotspots, priorityFilter, regionFilter, sortMode])

  useEffect(() => {
    setSelectedPostcode((cur) => {
      if (visibleHotspots.some((z) => z.postcode === cur)) return cur
      return visibleHotspots[0]?.postcode || ''
    })
  }, [visibleHotspots])

  const selectedHotspot = useMemo(() => {
    if (!selectedPostcode) return null
    return visibleHotspots.find((z) => z.postcode === selectedPostcode) || null
  }, [selectedPostcode, visibleHotspots])

  const priorityCounts = useMemo(() => {
    return enrichedHotspots.reduce(
      (counts, zone) => { counts[zone.priorityBand.tone] = (counts[zone.priorityBand.tone] || 0) + 1; return counts },
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
                {t('hotspots.chips.critical', { count: priorityCounts.critical, defaultValue: 'Critical · {{count}}' })}
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
                {t('hotspots.chips.watch', { count: priorityCounts.watch, defaultValue: 'Watch · {{count}}' })}
              </button>
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
                  <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
                    {regions.map((r) => (
                      <option key={r} value={r}>{r === 'all' ? t('common.all', 'All') : r}</option>
                    ))}
                  </select>
                </label>
                <label className="hotspot-control">
                  <span>{t('hotspots.controls.distance', 'Dist.')}</span>
                  <select value={distanceFilter} onChange={(e) => setDistanceFilter(e.target.value)}>
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

              {SHOW_SAMPLE_HINT && hotspotSource !== 'prediction' && (
                <p className="hotspot-sample-note">Preview mode · sample data</p>
              )}
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
                    {selectedHotspot.nearestHub.name}
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
                    onClick={() => navigate('/form/' + focusPostcode, { state: { targetPostcode: selectedHotspot.postcode } })}
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
