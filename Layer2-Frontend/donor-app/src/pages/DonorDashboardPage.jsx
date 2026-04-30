import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getSavedDonorPostcode, saveDonorPostcode } from '../utils/donorPostcode'
import '../styles/PostFeedPage.css'
import '../styles/DonorDashboardPage.css'

const DonorDashboardPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { t, i18n } = useTranslation()
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)

  const postcode = useMemo(() => {
    return String(location.state?.postcode || getSavedDonorPostcode() || '').trim()
  }, [location.state?.postcode])

  useEffect(() => {
    if (postcode) {
      saveDonorPostcode(postcode)
    }
  }, [postcode])

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang)
    localStorage.setItem('preferredLanguage', lang)
    setShowLanguageMenu(false)
  }

  const goTo = (path) => {
    navigate(path, { state: { postcode } })
  }

  return (
    <div className="donor-dashboard-page donor-role-page">
      <header className="navbar donor-navbar">
        <div className="navbar-inner donor-navbar-inner">
          <button className="brand-home-btn" type="button" onClick={() => navigate('/')}>
            <span className="brand-home-title">{t('appName')}</span>
          </button>

          <div className="nav-actions donor-nav-actions">
            <div className="language-btn-wrapper">
              <button className="nav-icon-btn" type="button" onClick={() => setShowLanguageMenu((prev) => !prev)}>
                <span className="material-symbols-outlined">language</span>
              </button>
              {showLanguageMenu ? (
                <div className="language-menu">
                  <button type="button" onClick={() => handleLanguageChange('en')}>English</button>
                  <button type="button" onClick={() => handleLanguageChange('zh')}>中文</button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="navbar-divider" />
      </header>

      <main className="donor-dashboard-shell">
        <section className="donor-dashboard-intro donor-dashboard-hero-card">
          <div className="donor-dashboard-heading-row">
            <div className="donor-dashboard-heading">
              <h1>{t('donorWorkspace.title', 'Donor workspace')}</h1>
              <p className="donor-dashboard-subtitle">
                {t(
                  'donorWorkspace.subtitle',
                  'Post surplus food, view local hotspots, and manage your listings.',
                )}
              </p>
              <div
                className="donor-dashboard-meta-pill"
                role="group"
                aria-label={t('donorWorkspace.currentPostcodeAria', 'Current donor postcode')}
              >
                <span className="material-symbols-outlined">location_on</span>
                <span className="donor-dashboard-meta-label">
                  {t('donorWorkspace.currentPostcodeLabel', 'Current postcode')}
                </span>
                <strong>{postcode || t('donorWorkspace.currentPostcodeFallback', 'Add when you post food')}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="donor-dashboard-grid" aria-label={t('donorWorkspace.actionsAria', 'Donor workspace actions')}>
          <article className="donor-dashboard-card donor-dashboard-card--post">
            <p className="donor-dashboard-card-eyebrow">{t('donorWorkspace.cards.post.eyebrow', 'Post food')}</p>
            <h2>{t('donorWorkspace.cards.post.title', 'Post surplus food')}</h2>
            <p>{t('donorWorkspace.cards.post.description', 'Share food you have available.')}</p>
            <button type="button" className="donor-dashboard-card-cta" onClick={() => goTo('/donor/post')}>
              {t('donorWorkspace.cards.post.button', 'Open posting form')}
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </article>

          <article className="donor-dashboard-card donor-dashboard-card--hotspots">
            <p className="donor-dashboard-card-eyebrow">{t('donorWorkspace.cards.hotspots.eyebrow', 'Decision support')}</p>
            <h2>{t('donorWorkspace.cards.hotspots.title', 'View food shortage hotspots')}</h2>
            <p>{t('donorWorkspace.cards.hotspots.description', 'Find areas that need food most.')}</p>
            <button type="button" className="donor-dashboard-card-cta" onClick={() => goTo('/donor/hotspots')}>
              {t('donorWorkspace.cards.hotspots.button', 'View hotspot map')}
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </article>

          <article className="donor-dashboard-card donor-dashboard-card--listings">
            <p className="donor-dashboard-card-eyebrow">{t('donorWorkspace.cards.listings.eyebrow', 'My activity')}</p>
            <h2>{t('donorWorkspace.cards.listings.title', 'Manage my listings')}</h2>
            <p>{t('donorWorkspace.cards.listings.description', 'View or edit your posts.')}</p>
            <button type="button" className="donor-dashboard-card-cta" onClick={() => goTo('/donor/listings')}>
              {t('donorWorkspace.cards.listings.button', 'Open my listings')}
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </article>
        </section>
      </main>
    </div>
  )
}

export default DonorDashboardPage
