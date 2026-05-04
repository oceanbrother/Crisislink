import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getSavedDonorPostcode } from '../utils/donorPostcode'
import WorkspaceFeatureNav from './WorkspaceFeatureNav'
const DonorFeatureNav = ({ active = 'listings', postcode = '' }) => {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const effectivePostcode = String(postcode || getSavedDonorPostcode() || '').trim()

  const goTo = (path) => {
    navigate(path, { state: { postcode: effectivePostcode } })
  }

  return (
    <WorkspaceFeatureNav
      role="donor"
      ariaLabel={t('common.navigation', 'Donor navigation')}
      items={[
        {
          key: 'listings',
          label: t('donorNav.listings', 'My listings'),
          active: active === 'listings',
          onClick: () => goTo('/donor/listings'),
        },
        {
          key: 'hotspots',
          label: t('donorNav.hotspots', 'Hotspots'),
          active: active === 'hotspots',
          onClick: () => goTo('/donor/hotspots'),
        },
      ]}
    />
  )
}

export default DonorFeatureNav
