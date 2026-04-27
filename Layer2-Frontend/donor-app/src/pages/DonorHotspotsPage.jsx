import React, { useEffect, useMemo, useState } from 'react'
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

    if (hotspotRegionFilter !== 'all') {
      zones = zones.filter((zone) => zone.region === hotspotRegionFilter)
    }

    if (hotspotDistanceFilter !== 'all') {
      const maxDistance = Number(hotspotDistanceFilter)
      zones = zones.filter((zone) => Number(zone.distanceToDonorKm || 0) <= maxDistance)
    }

    if (hotspotPriorityFilter !== 'all') {
      zones = zones.filter((zone) => zone.priorityBand.tone === hotspotPriorityFilter)
    }

    if (hotspotSortMode === 'distance') {
      return zones.sort((a, b) => Number(a.distanceToDonorKm || 0) - Number(b.distanceToDonorKm || 0))
    }

    return zones.sort((a, b) => b.priorityScore - a.priorityScore)
  }, [hotspotDistanceFilter, hotspotPriorityFilter, hotspotRegionFilter, hotspotSortMode])

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

    if (hotspotSortMode === 'distance') {
      return groups.sort((a, b) => a.closestDistance - b.closestDistance)
    }

    return groups.sort((a, b) => b.topPriority - a.topPriority)
  }, [hotspotSortMode, visibleHotspots])

  useEffect(() => {
    setSelectedHotspotPostcode(visibleHotspots[0]?.postcode || '')
  }, [hotspotSortMode, hotspotRegionFilter, hotspotDistanceFilter, hotspotPriorityFilter, visibleHotspots])

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

        <section className="donor-page-intro donor-page-intro--hotspots">
          <div className="donor-page-meta donor-page-meta-pill donor-page-meta-pill--hotspots">
            <span className="material-symbols-outlined">location_on</span>
            <span>Reference postcode: {focusPostcode || 'State-wide'}</span>
          </div>
        </section>

        <section className="hotspot-board" aria-label="Hotspot priority map">
          <div className="hotspot-board-header">
            <div className="hotspot-board-title-wrap">
              <p className="hotspot-eyebrow">Hotspot map</p>
              <h2 className="hotspot-title">Food shortage hotspots</h2>
              <p className="hotspot-subtitle">
                Hotspots are grouped by region to act like a suburb map when you scan for nearby need.
              </p>
              <p className="hotspot-helper-copy">
                Start from region clusters, then open a postcode card to inspect exact shortage details.
              </p>
            </div>
            <div className="hotspot-chip-row">
              <button
                type="button"
                className={hotspotPriorityFilter === 'all' ? 'hotspot-chip hotspot-chip--neutral active' : 'hotspot-chip hotspot-chip--neutral'}
                onClick={() => setHotspotPriorityFilter('all')}
              >
                All hotspots
              </button>
              <button
                type="button"
                title="Show urgent shortage hotspots"
                className={hotspotPriorityFilter === 'critical' ? 'hotspot-chip hotspot-chip--critical active' : 'hotspot-chip hotspot-chip--critical'}
                onClick={() => setHotspotPriorityFilter('critical')}
              >
                Critical shortage · {priorityCounts.critical}
              </button>
              <button
                type="button"
                title={priorityCounts.high === 0 ? 'No high-need hotspots right now' : 'Show high-need hotspots'}
                disabled={priorityCounts.high === 0}
                className={hotspotPriorityFilter === 'high' ? 'hotspot-chip hotspot-chip--high active' : 'hotspot-chip hotspot-chip--high'}
                onClick={() => setHotspotPriorityFilter('high')}
              >
                High need · {priorityCounts.high}
              </button>
              <button
                type="button"
                title="Show emerging-risk hotspots to monitor"
                className={hotspotPriorityFilter === 'watch' ? 'hotspot-chip hotspot-chip--watch active' : 'hotspot-chip hotspot-chip--watch'}
                onClick={() => setHotspotPriorityFilter('watch')}
              >
                Watchlist risk · {priorityCounts.watch}
              </button>
            </div>
          </div>

          <div className="hotspot-controls">
            <label className="hotspot-control">
              <span>View</span>
              <select
                value={hotspotRegionFilter}
                onChange={(event) => setHotspotRegionFilter(event.target.value)}
              >
                {hotspotRegions.map((region) => (
                  <option key={region} value={region}>
                    {region === 'all' ? 'All regions (state-wide)' : region}
                  </option>
                ))}
              </select>
            </label>

            <label className="hotspot-control">
              <span>Distance</span>
              <select
                value={hotspotDistanceFilter}
                onChange={(event) => setHotspotDistanceFilter(event.target.value)}
              >
                <option value="all">Any distance</option>
                <option value="10">Within 10 km</option>
                <option value="25">Within 25 km</option>
                <option value="50">Within 50 km</option>
              </select>
            </label>

            <label className="hotspot-control">
              <span>Sort</span>
              <select
                value={hotspotSortMode}
                onChange={(event) => setHotspotSortMode(event.target.value)}
              >
                <option value="priority">Priority (highest need first)</option>
                <option value="distance">Distance (closest first)</option>
              </select>
            </label>
          </div>

          <p className="hotspot-legend-copy">
            Critical shortage = urgent need. High need = strong demand. Watchlist risk = areas to monitor next.
          </p>
          <p className="hotspot-sample-note">
            Sample data only. Live hotspot scoring will be connected after database integration.
          </p>

          <div className="hotspot-layout">
            <div
              className={hotspotRegionFilter === 'all' ? 'hotspot-region-grid' : 'hotspot-region-grid is-focused-region'}
              role="list"
            >
              {hotspotRegionGroups.length === 0 ? (
                <div className="hotspot-grid-empty">
                  <strong>No hotspots match these filters.</strong>
                  <span>Try all regions or a wider distance range.</span>
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
                        <h3>{group.zones.length} hotspot{group.zones.length === 1 ? '' : 's'}</h3>
                      </div>
                      <div className="hotspot-region-cluster-meta">
                        <span>
                          {hotspotSortMode === 'distance'
                            ? `Closest ${group.closestDistance.toFixed(1)} km`
                            : `Top priority ${group.topPriority}`}
                        </span>
                        <strong>{group.totalShortfall} portions short</strong>
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
                            <span>{zone.priorityBand.label}</span>
                          </div>
                          <p>{zone.nearestHub.name}</p>
                          <div className="hotspot-zone-metrics">
                            <span>Need score {zone.resourceRequirement}</span>
                            <span>Active listings {zone.activeListings}</span>
                            <span>Priority {zone.priorityScore}</span>
                            <span>{zone.distanceToDonorKm} km away</span>
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
                <h3>Hotspot detail · {selectedHotspot.postcode}</h3>
                <p>Only currently needed categories are shown.</p>

                <div className="hotspot-detail-stats">
                  <div>
                    <span>Current shortfall</span>
                    <strong>{selectedHotspot.totalShortfall} portions</strong>
                  </div>
                  <div>
                    <span>Approx. distance</span>
                    <strong>{selectedHotspot.distanceToDonorKm} km</strong>
                  </div>
                  <div>
                    <span>Nearest supply point</span>
                    <strong>
                      {selectedHotspot.nearestHub.name} ({selectedHotspot.nearestHub.distanceKm} km)
                    </strong>
                  </div>
                </div>

                <ul className="hotspot-needed-list">
                  {selectedHotspot.neededItems.map((item) => (
                    <li key={item.category}>
                      <span>{item.category}</span>
                      <strong>{item.shortfallPortions} portions short</strong>
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
