import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const STORAGE_KEY = 'crisislink-donor-postcode'

function getSavedDonorPostcode() {
  try {
    return String(window.localStorage.getItem(STORAGE_KEY) || '').trim()
  } catch (error) {
    return ''
  }
}

const DonorFeatureNav = ({ active = 'listings', postcode = '' }) => {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const effectivePostcode = String(postcode || getSavedDonorPostcode() || '').trim()

  const goTo = (path) => {
    navigate(path, { state: { postcode: effectivePostcode } })
  }

  return (
    <section className="donor-feature-nav" aria-label={t('common.navigation', 'Donor navigation')}>
      <button
        type="button"
        className={`donor-feature-nav-button ${active === 'listings' ? 'active' : ''}`.trim()}
        onClick={() => goTo('/feed/' + effectivePostcode)}
      >
        {t('donorNav.listings', 'My listings')}
      </button>
      <button
        type="button"
        className={`donor-feature-nav-button ${active === 'hotspots' ? 'active' : ''}`.trim()}
        onClick={() => goTo('/hotspots/' + effectivePostcode)}
      >
        {t('donorNav.hotspots', 'Hotspots')}
      </button>
    </section>
  )
}

export default DonorFeatureNav
