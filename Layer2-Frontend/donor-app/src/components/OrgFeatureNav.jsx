import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import WorkspaceFeatureNav from './WorkspaceFeatureNav'

const OrgFeatureNav = ({ active = 'listings', orgCode = '' }) => {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const goTo = (path) => {
    navigate(path, { state: { orgCode } })
  }

  return (
    <WorkspaceFeatureNav
      role="org"
      ariaLabel={t('common.navigation', 'Organization navigation')}
      items={[
        {
          key: 'listings',
          label: t('dashboard.title'),
          active: active === 'listings',
          onClick: () => goTo('/org/listings'),
        },
        {
          key: 'alerts',
          label: t('common.alerts'),
          active: active === 'alerts',
          onClick: () => goTo('/org/alerts'),
        },
        {
          key: 'gaps',
          label: t('dashboard.coverageInsights.navLabel', 'Supply gaps'),
          active: active === 'gaps',
          onClick: () => goTo('/org/gaps'),
        },
        {
          key: 'coverage-map',
          label: t('coverageMap.navLabel', 'Around me'),
          active: active === 'coverage-map',
          onClick: () => goTo('/org/coverage-map'),
        },
      ]}
    />
  )
}

export default OrgFeatureNav
