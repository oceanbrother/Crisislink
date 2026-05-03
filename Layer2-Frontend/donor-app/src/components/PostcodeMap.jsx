import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { POSTCODE_COORDS } from '../utils/postcodeCoords'
import '../styles/PostcodeMap.css'

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

const TONE_COLOR = {
  none:     '#d93025',
  critical: '#d93025',
  low:      '#e8711a',
  high:     '#e8711a',
  watch:    '#c5960e',
  healthy:  '#1a9c67',
}

const TONE_RADIUS = {
  none:     18,
  critical: 18,
  low:      14,
  high:     14,
  watch:    12,
  healthy:  9,
}

const MELBOURNE = [-37.835, 144.975]

export default function PostcodeMap({ zones, selectedPostcode, onSelect, height = 420, defaultCenter = MELBOURNE, defaultZoom = 12 }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef({})
  const onSelectRef = useRef(onSelect)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: defaultCenter,
      zoom: defaultZoom,
      scrollWheelZoom: false,
      attributionControl: false,
      zoomControl: true,
    })

    L.tileLayer(TILE_URL, {
      attribution: '© OpenStreetMap contributors © CARTO',
    }).addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current = {}
    }
  }, [])

  // Sync markers whenever zones or selected postcode change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Remove old markers
    Object.values(markersRef.current).forEach((m) => m.remove())
    markersRef.current = {}

    zones.forEach((zone) => {
      const coords = POSTCODE_COORDS[zone.postcode]
      if (!coords) return

      const tone = zone.tone || 'watch'
      const isSelected = zone.postcode === selectedPostcode
      const color = TONE_COLOR[tone] || '#888'
      const radius = (TONE_RADIUS[tone] || 12) + (isSelected ? 5 : 0)

      const marker = L.circleMarker(coords, {
        radius,
        fillColor: color,
        fillOpacity: isSelected ? 1 : 0.72,
        color: isSelected ? '#fff' : color,
        weight: isSelected ? 3 : 1.5,
      })

      const tooltipHtml = `
        <span class="postcode-map-tooltip">
          <strong>${zone.suburb}</strong>
          <span>${zone.postcode}</span>
          ${zone.metric ? `<em>${zone.metric}</em>` : ''}
        </span>`

      marker.bindTooltip(tooltipHtml, { sticky: true })
      marker.on('click', () => onSelectRef.current(zone.postcode))
      marker.addTo(map)
      markersRef.current[zone.postcode] = marker
    })
  }, [zones, selectedPostcode])

  return (
    <div
      ref={containerRef}
      className="postcode-map-wrap"
      style={{ height }}
    />
  )
}
