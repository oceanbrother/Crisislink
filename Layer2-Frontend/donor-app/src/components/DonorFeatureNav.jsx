import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getSavedDonorPostcode } from '../utils/donorPostcode'
import WorkspaceFeatureNav from './WorkspaceFeatureNav'

const DonorFeatureNav = ({ active = 'listings', postcode = '' }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()

  const effectivePostcode = String(postcode || getSavedDonorPostcode() || '').trim()

  // Navigate to a path while carrying the current postcode in state
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
          key: 'intelligence',
          label: t('donorNav.intelligence', 'Area Intelligence'),
          active: active === 'intelligence',
          onClick: () => navigate('/org/intelligence', { state: { fromDonor: true, returnPath: location.pathname } }),
        },
      ]}
    />
  )
}

export default DonorFeatureNav
