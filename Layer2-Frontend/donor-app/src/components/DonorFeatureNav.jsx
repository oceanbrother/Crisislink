import React from 'react'
import { useNavigate } from 'react-router-dom'
import { getSavedDonorPostcode } from '../utils/donorPostcode'
import '../styles/DonorFeatureNav.css'

const DonorFeatureNav = ({ active = 'post', postcode = '' }) => {
  const navigate = useNavigate()
  const effectivePostcode = String(postcode || getSavedDonorPostcode() || '').trim()

  const goTo = (path) => {
    navigate(path, { state: { postcode: effectivePostcode } })
  }

  return (
    <section className="donor-feature-nav" aria-label="Donor navigation">
      <button
        type="button"
        className={`donor-feature-nav-button ${active === 'post' ? 'active' : ''}`.trim()}
        onClick={() => goTo('/donor/post')}
      >
        Post food
      </button>
      <button
        type="button"
        className={`donor-feature-nav-button ${active === 'listings' ? 'active' : ''}`.trim()}
        onClick={() => goTo('/donor/listings')}
      >
        My listings
      </button>
      <button
        type="button"
        className={`donor-feature-nav-button ${active === 'hotspots' ? 'active' : ''}`.trim()}
        onClick={() => goTo('/donor/hotspots')}
      >
        Hotspots
      </button>
    </section>
  )
}

export default DonorFeatureNav
