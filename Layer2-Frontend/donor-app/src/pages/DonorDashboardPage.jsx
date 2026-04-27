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
        <section className="donor-dashboard-hero">
          <div className="donor-dashboard-copy">
            <p className="donor-dashboard-eyebrow">Donor workspace</p>
            <h1>Choose what you want to do next</h1>
            <p>
              Keep posting, insights, and listing management separate so you always know what you’re working on.
            </p>
          </div>

          <div className="donor-dashboard-postcode-card" role="group" aria-label="Current donor postcode">
            <div className="donor-dashboard-postcode-icon">
              <span className="material-symbols-outlined">location_on</span>
            </div>
            <div className="donor-dashboard-postcode-copy">
              <span>Current postcode</span>
              <strong>{postcode || 'Add when you post food'}</strong>
            </div>
          </div>
        </section>

        <section className="donor-dashboard-grid" aria-label="Donor workspace actions">
          <article className="donor-dashboard-card donor-dashboard-card--post">
            <p className="donor-dashboard-card-eyebrow">Post food</p>
            <h2>Post surplus food</h2>
            <p>Share food you have available.</p>
            <button type="button" className="donor-dashboard-card-cta" onClick={() => goTo('/donor/post')}>
              Open posting form
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </article>

          <article className="donor-dashboard-card donor-dashboard-card--hotspots">
            <p className="donor-dashboard-card-eyebrow">Decision support</p>
            <h2>View food shortage hotspots</h2>
            <p>Find areas that need food most.</p>
            <button type="button" className="donor-dashboard-card-cta" onClick={() => goTo('/donor/hotspots')}>
              View hotspot map
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </article>

          <article className="donor-dashboard-card donor-dashboard-card--listings">
            <p className="donor-dashboard-card-eyebrow">My activity</p>
            <h2>Manage my listings</h2>
            <p>View or edit your posts.</p>
            <button type="button" className="donor-dashboard-card-cta" onClick={() => goTo('/donor/listings')}>
              Open my listings
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </article>
        </section>
      </main>
    </div>
  )
}

export default DonorDashboardPage
