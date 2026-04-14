import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../components/LanguageSwitcher'
import '../styles/HomePage.css'

const HomePage = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <div className="home-page">
      {/* Logo */}
      <header className="home-header">
        <h1 className="brand-name">{t('appName')}</h1>
        <LanguageSwitcher />
      </header>

      {/* Main */}
      <main className="home-main">
        <p className="home-question">{t('home.question')}</p>

        <div className="cards-grid">
          {/* Donor card */}
          <div className="role-card" onClick={() => navigate('/postcode')}>
            <div className="role-card-accent donor" />
            <div className="role-card-inner">
              <div className="role-icon-circle donor">
                <span className="material-symbols-outlined">bakery_dining</span>
              </div>
              <h3 className="role-card-title donor">{t('home.donor.title')}</h3>
              <p className="role-card-desc">{t('home.donor.description')}</p>
              <button
                className="role-btn donor"
                onClick={(e) => { e.stopPropagation(); navigate('/postcode') }}
              >
                {t('home.donor.button')}
              </button>
            </div>
          </div>

          {/* Org / community card */}
          <div className="role-card" onClick={() => navigate('/org/code')}>
            <div className="role-card-accent org" />
            <div className="role-card-inner">
              <div className="role-icon-circle org">
                <span className="material-symbols-outlined">corporate_fare</span>
              </div>
              <h3 className="role-card-title org">{t('home.organization.title')}</h3>
              <p className="role-card-desc">{t('home.organization.description')}</p>
              <button
                className="role-btn org"
                onClick={(e) => { e.stopPropagation(); navigate('/org/code') }}
              >
                {t('home.organization.button')}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer decorative element */}
      <footer className="home-footer" />
    </div>
  )
}

export default HomePage
