import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

const TONE_FILL = {
  critical: { color: '#e53030', opacity: 0.68 },
  none:     { color: '#e53030', opacity: 0.68 },
  high:     { color: '#e8711a', opacity: 0.65 },
  low:      { color: '#e8711a', opacity: 0.65 },
  watch:    { color: '#d69e2e', opacity: 0.62 },
  healthy:  { color: '#1a9c67', opacity: 0.58 },
}

// ABS ASGS 2021 Postal Areas MapServer
const ABS_URL = 'https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/POA/MapServer/0/query'

// Module-level cache persists across remounts, keyed by postcode string
const geoCache = {}

// Fetch GeoJSON boundaries from ABS for the given postcodes, batching requests
async function loadBoundaries(postcodes) {
  const uncached = postcodes.filter(p => !(p in geoCache))
  if (!uncached.length) return

  // ArcGIS accepts up to ~60 values in an IN clause comfortably
  const batches = []
  for (let i = 0; i < uncached.length; i += 60) batches.push(uncached.slice(i, i + 60))

  for (const batch of batches) {
    const inClause = batch.map(p => `'${p}'`).join(',')
    const params = new URLSearchParams({
      where: `poa_code_2021 IN (${inClause})`,
      outFields: 'poa_code_2021',
      returnGeometry: 'true',
      f: 'geojson',
      geometryPrecision: '4',
      outSR: '4326',
    })

    try {
      const res = await fetch(`${ABS_URL}?${params}`, { signal: AbortSignal.timeout(15000) })
      if (!res.ok) throw new Error(res.status)
      const data = await res.json()

      if (data.features) {
        data.features.forEach(feat => {
          const code = feat.properties?.poa_code_2021
          if (code && feat.geometry) geoCache[String(code)] = feat
        })
      }
    } catch (err) {
      console.warn('[ChoroplethMap] ABS boundary fetch failed:', err)
    }

    // Mark any that came back empty so we don't retry them
    batch.forEach(p => { if (!(p in geoCache)) geoCache[p] = null })
  }
}

// Build Leaflet style object for a polygon based on tone and selection state
function layerStyle(tone, isSelected) {
  const { color, opacity } = TONE_FILL[tone] || TONE_FILL.watch
  return {
    fillColor:   color,
    fillOpacity: isSelected ? Math.min(opacity + 0.28, 0.88) : opacity,
    color:       isSelected ? '#ffffff' : color,
    weight:      isSelected ? 2.5 : 0.8,
    opacity:     0.9,
  }
}

export default function ChoroplethMap({
  zones = [],
  selectedPostcode = '',
  onSelect,
  height = 680,
  defaultCenter = [-36.8, 144.9],
  defaultZoom = 7,
}) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const layersRef    = useRef({})   // postcode to L.GeoJSON
  const onSelectRef  = useRef(onSelect)
  const zonesRef     = useRef(zones)
  const selectedRef  = useRef(selectedPostcode)

  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])

  // Init map once on mount
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center:           defaultCenter,
      zoom:             defaultZoom,
      scrollWheelZoom:  false,
      attributionControl: false,
      zoomControl:      true,
    })

    L.tileLayer(TILE_URL, { maxZoom: 18 }).addTo(map)
    L.control.attribution({ prefix: false })
      .addAttribution('© <a href="https://carto.com">CARTO</a> · Boundaries © <a href="https://abs.gov.au">ABS</a>')
      .addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current  = null
      layersRef.current = {}
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Rebuild polygon layers when zones change
  useEffect(() => {
    zonesRef.current = zones
    const map = mapRef.current
    if (!map) return

    let cancelled = false

    const render = async () => {
      const postcodes = zones.map(z => String(z.postcode))
      await loadBoundaries(postcodes)
      if (cancelled || !mapRef.current) return

      // Remove stale layers
      const codeSet = new Set(postcodes)
      Object.keys(layersRef.current).forEach(pc => {
        if (!codeSet.has(pc)) { layersRef.current[pc].remove(); delete layersRef.current[pc] }
      })

      // Add/refresh layers for each zone
      zones.forEach(zone => {
        const pc      = String(zone.postcode)
        const feature = geoCache[pc]
        if (!feature) return

        const tone       = zone.tone || 'watch'
        const isSelected = pc === selectedRef.current

        // Remove existing layer so we can recreate cleanly
        if (layersRef.current[pc]) { layersRef.current[pc].remove() }

        const layer = L.geoJSON(feature, {
          style: () => layerStyle(tone, isSelected),
        })

        layer.on('click', () => onSelectRef.current?.(pc))
        layer.bindTooltip(
          `<div style="font:500 13px/1.5 Inter,sans-serif;padding:2px 4px">
            <strong>${zone.suburb ?? pc}</strong><br>
            <span style="color:#707973">${pc}</span>
            ${zone.metric ? `<br><em style="color:#404943">${zone.metric}</em>` : ''}
          </div>`,
          { sticky: true, className: 'pcmap-tip' }
        )

        if (isSelected) layer.bringToFront()
        layer.addTo(mapRef.current)
        layersRef.current[pc] = layer
      })
    }

    render()
    return () => { cancelled = true }
  }, [zones]) // eslint-disable-line react-hooks/exhaustive-deps

  // Restyle polygons when selected postcode changes, no fetch needed
  useEffect(() => {
    selectedRef.current = selectedPostcode
    const map = mapRef.current
    if (!map) return

    Object.entries(layersRef.current).forEach(([pc, layer]) => {
      const zone = zonesRef.current.find(z => String(z.postcode) === pc)
      if (!zone) return
      const tone       = zone.tone || 'watch'
      const isSelected = pc === selectedPostcode
      layer.setStyle(layerStyle(tone, isSelected))
      if (isSelected) {
        layer.bringToFront()
        try {
          const bounds = layer.getBounds()
          if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13, animate: true, duration: 0.4 })
        } catch {}
      }
    })
  }, [selectedPostcode]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} style={{ height, width: '100%' }} />
}
