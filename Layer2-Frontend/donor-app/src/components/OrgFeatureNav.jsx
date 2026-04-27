import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const OrgFeatureNav = ({ active = 'listings', orgCode = '' }) => {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const goTo = (path) => {
    navigate(path, { state: { orgCode } })
  }

  return (
    <section className="org-feature-nav" aria-label={t('common.navigation', 'Organization navigation')}>
      <button
        type="button"
        className={`org-feature-nav-button ${active === 'listings' ? 'active' : ''}`.trim()}
        onClick={() => goTo('/org/listings')}
      >
        {t('dashboard.title')}
      </button>
      <button
        type="button"
        className={`org-feature-nav-button ${active === 'alerts' ? 'active' : ''}`.trim()}
        onClick={() => goTo('/org/alerts')}
      >
        {t('common.alerts')}
      </button>
    </section>
  )
}

export default OrgFeatureNav
