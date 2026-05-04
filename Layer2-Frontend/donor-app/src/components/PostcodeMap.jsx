import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { POSTCODE_COORDS } from '../utils/postcodeCoords'
import '../styles/PostcodeMap.css'

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

const TONE_COLOR = {
  none:     '#e53030',
  critical: '#e53030',
  low:      '#e8711a',
  high:     '#e8711a',
  watch:    '#c5960e',
  healthy:  '#1a9c67',
}

const TONE_RADIUS = {
  none:     15,
  critical: 15,
  low:      12,
  high:     12,
  watch:    10,
  healthy:  8,
}

const MELBOURNE = [-37.835, 144.975]

function markerStyle(tone, isSelected) {
  const color = TONE_COLOR[tone] || '#888'
  const base  = TONE_RADIUS[tone] || 10
  return {
    radius:      isSelected ? base + 5 : base,
    fillColor:   color,
    fillOpacity: isSelected ? 0.95 : 0.68,
    color:       isSelected ? '#ffffff' : color,
    weight:      isSelected ? 2.5 : 1.2,
    opacity:     1,
  }
}

function haloStyle(tone, radius) {
  const color = TONE_COLOR[tone] || '#888'
  return {
    radius,
    fillColor:   color,
    fillOpacity: 0.13,
    color:       color,
    weight:      1.5,
    opacity:     0.25,
  }
}

export default function PostcodeMap({
  zones,
  selectedPostcode,
  onSelect,
  height = 420,
  defaultCenter = MELBOURNE,
  defaultZoom   = 12,
  fitBoundsOnLoad = false,
  userPostcode = null,
  route = null,
}) {
  const containerRef    = useRef(null)
  const mapRef          = useRef(null)
  const markersRef      = useRef({})
  const halosRef        = useRef({})
  const userMarkerRef   = useRef(null)
  const routePolylineRef = useRef(null)
  const onSelectRef     = useRef(onSelect)
  const zonesRef        = useRef(zones)
  const selectedRef     = useRef(selectedPostcode)
  const hasFitRef       = useRef(false)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => { onSelectRef.current = onSelect },        [onSelect])
  useEffect(() => { zonesRef.current    = zones },           [zones])

  // ── Init map once ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center:           defaultCenter,
      zoom:             defaultZoom,
      scrollWheelZoom:  false,
      attributionControl: false,
      zoomControl:      true,
      zoomAnimation:    true,
      fadeAnimation:    true,
    })

    L.tileLayer(TILE_URL, {
      attribution: '© <a href="https://carto.com">CARTO</a>',
      maxZoom: 19,
    }).addTo(map)

    mapRef.current = map
    setMapReady(true)

    return () => {
      map.remove()
      mapRef.current   = null
      markersRef.current = {}
      halosRef.current   = {}
      setMapReady(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rebuild all markers when zones change ─────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    Object.values(markersRef.current).forEach(m => m.remove())
    Object.values(halosRef.current).forEach(m => m.remove())
    markersRef.current = {}
    halosRef.current   = {}

    const curSelected = selectedRef.current

    zones.forEach(zone => {
      const coords = POSTCODE_COORDS[zone.postcode]
      if (!coords) return

      const tone       = zone.tone || 'watch'
      const isSelected = zone.postcode === curSelected
      const style      = markerStyle(tone, isSelected)

      // Halo ring behind the selected marker
      if (isSelected) {
        const halo = L.circleMarker(coords, haloStyle(tone, style.radius + 9)).addTo(map)
        halo.bringToBack()
        halosRef.current[zone.postcode] = halo
      }

      const marker = L.circleMarker(coords, style)

      marker.bindTooltip(buildTooltip(zone), {
        sticky:    true,
        className: 'pcmap-tip',
        offset:    [0, -4],
      })

      marker.on('click', () => onSelectRef.current(zone.postcode))
      marker.addTo(map)

      if (isSelected) applyGlow(marker)

      markersRef.current[zone.postcode] = marker
    })

    // Auto-fit map to show all markers on first non-empty load only
    if (fitBoundsOnLoad && !hasFitRef.current) {
      const allCoords = Object.values(markersRef.current).map(m => m.getLatLng())
      if (allCoords.length > 0) {
        map.fitBounds(L.latLngBounds(allCoords), { padding: [32, 32], maxZoom: 9 })
        hasFitRef.current = true
      }
    }
  }, [zones]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle user postcode marker and route ─────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    // Remove old user marker if exists
    if (userMarkerRef.current) {
      userMarkerRef.current.remove()
      userMarkerRef.current = null
    }

    // Remove old route if exists
    if (routePolylineRef.current) {
      routePolylineRef.current.remove()
      routePolylineRef.current = null
    }

    // Add user marker (blue dot with label)
    if (userPostcode) {
      const coords = POSTCODE_COORDS[userPostcode]
      if (coords) {
        const userMarker = L.circleMarker(coords, {
          radius: 8,
          fillColor: '#3182ce',
          fillOpacity: 0.85,
          color: '#ffffff',
          weight: 2,
          opacity: 1,
        })
        userMarker.bindTooltip(`<span class="pcmap-tip-inner"><strong>${userPostcode}</strong><em>Your location</em></span>`, {
          sticky: true,
          className: 'pcmap-tip',
          offset: [0, -4],
        })
        userMarker.addTo(map)
        userMarker.bringToFront()
        userMarkerRef.current = userMarker

        // Add pulsing animation to user marker
        const el = userMarker.getElement()
        if (el) el.classList.add('pcmap-user-pulse')
      }
    }

    // Add route polyline if exists
    if (route && route.from && route.to) {
      const fromCoords = POSTCODE_COORDS[route.from]
      const toCoords = POSTCODE_COORDS[route.to]
      if (fromCoords && toCoords) {
        const polyline = L.polyline([fromCoords, toCoords], {
          color: '#3182ce',
          weight: 3,
          opacity: 0.7,
          dashArray: '5, 5',
        }).addTo(map)
        polyline.bringToBack()
        routePolylineRef.current = polyline
      }
    }
  }, [userPostcode, route, mapReady])

  // ── Handle selection changes ───────────────────────────────────────────────
  useEffect(() => {
    selectedRef.current = selectedPostcode
    const map = mapRef.current
    if (!map || Object.keys(markersRef.current).length === 0) return

    const curZones = zonesRef.current

    // 1. Update every marker's visual style
    curZones.forEach(zone => {
      const marker = markersRef.current[zone.postcode]
      if (!marker) return

      const tone       = zone.tone || 'watch'
      const isSelected = zone.postcode === selectedPostcode
      const style      = markerStyle(tone, isSelected)

      marker.setStyle({
        fillColor:   style.fillColor,
        fillOpacity: style.fillOpacity,
        color:       style.color,
        weight:      style.weight,
        opacity:     style.opacity,
      })
      marker.setRadius(style.radius)

      // Glow class
      const el = marker.getElement()
      if (el) {
        el.classList.remove('pcmap-selected-glow')
        if (isSelected) el.classList.add('pcmap-selected-glow')
      }

      // Rebuild halo
      const oldHalo = halosRef.current[zone.postcode]
      if (oldHalo) { oldHalo.remove(); delete halosRef.current[zone.postcode] }
      if (isSelected) {
        const halo = L.circleMarker(marker.getLatLng(), haloStyle(tone, style.radius + 9)).addTo(map)
        halo.bringToBack()
        halosRef.current[zone.postcode] = halo
      }
    })

    // 2. Pan to selected marker
    if (selectedPostcode) {
      const coords = POSTCODE_COORDS[selectedPostcode]
      if (coords) map.panTo(coords, { animate: true, duration: 0.45, easeLinearity: 0.4 })
    }

    // 3. Bounce animation on selected marker via setRadius sequence
    const sel = markersRef.current[selectedPostcode]
    if (sel) {
      const tone  = curZones.find(z => z.postcode === selectedPostcode)?.tone || 'watch'
      const baseR = (TONE_RADIUS[tone] || 10) + 5
      const seq   = [[0, baseR + 8], [110, baseR - 2], [195, baseR + 3], [270, baseR]]
      seq.forEach(([delay, r]) =>
        setTimeout(() => {
          if (markersRef.current[selectedPostcode] === sel) sel.setRadius(r)
        }, delay)
      )
    }
  }, [selectedPostcode])

  return (
    <div
      ref={containerRef}
      className="postcode-map-wrap"
      style={{ height }}
    />
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────

function applyGlow(marker) {
  const el = marker.getElement()
  if (el) el.classList.add('pcmap-selected-glow')
}

function buildTooltip(zone) {
  return `<span class="pcmap-tip-inner">
    <strong>${zone.suburb}</strong>
    <span>${zone.postcode}</span>
    ${zone.metric ? `<em>${zone.metric}</em>` : ''}
  </span>`
}
