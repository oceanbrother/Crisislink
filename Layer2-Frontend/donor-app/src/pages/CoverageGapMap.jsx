import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import OrgFeatureNav from '../components/OrgFeatureNav'
import WorkspaceHeader from '../components/WorkspaceHeader'
import { getGapPostcodes } from '../services/api'

const CoverageGapMap = () => {
  const [geojson, setGeojson] = useState(null)
  const [gaps, setGaps] = useState([])

  useEffect(() => {
    // Load gap postcodes from API
    const load = async () => {
      const data = await getGapPostcodes()
      setGaps(data || [])
    }
    load()
  }, [])

  const style = (feature) => {
    const pc = feature.properties.postcode
    const match = gaps.find(g => g.postcode === pc)
    const color = match ? '#d62828' : '#6aa84f'
    return { color, weight: 1, fillOpacity: 0.6 }
  }

  return (
    <div>
      <WorkspaceHeader title="Around Me" />
      <OrgFeatureNav />
      <MapContainer center={[-37.8136, 144.9631]} zoom={10} style={{ height: '70vh' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {geojson && <GeoJSON data={geojson} style={style} />}
      </MapContainer>
    </div>
  )
}

export default CoverageGapMap
