import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import DonorFeatureNav from '../components/DonorFeatureNav'
import { getHotspots } from '../services/api'

const HotspotMap = () => {
  const [hotspots, setHotspots] = useState([])

  useEffect(() => {
    const load = async () => {
      const data = await getHotspots()
      setHotspots(data || [])
    }
    load()
  }, [])

  return (
    <div>
      <DonorFeatureNav />
      <MapContainer center={[-37.8136, 144.9631]} zoom={11} style={{ height: '70vh' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {hotspots.map((h) => (
          <Marker key={h.postcode} position={h.center || [-37.8136, 144.9631]}>
            <Popup>
              <div>
                <strong>{h.postcode}</strong>
                <div>Risk: {h.risk_score}</div>
                <div>Supply: {h.total_supply}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}

export default HotspotMap
