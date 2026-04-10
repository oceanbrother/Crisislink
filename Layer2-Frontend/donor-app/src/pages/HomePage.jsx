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
      {/* Header */}
      <header className="home-header">
        <div className="header-top">
          <div className="logo-section">
            <div className="logo">🥬</div>
            <div className="logo-text">{t('common.appName')}</div>
          </div>
          <LanguageSwitcher />
        </div>

        <div className="tagline">
          {t('home.subtitle')}
        </div>

        <div className="stats">
          <div className="stat-item">
            <div className="stat-dot"></div>
            <div className="stat-text">{t('home.statsMeals')}</div>
          </div>
          <div className="stat-item">
            <div className="stat-text">{t('home.statsNetwork')}</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="home-main">
        <div className="section-title">{t('home.selectRole')}</div>

        <div className="cards-container">
          {/* Donor Card (Amber) */}
          <div className="card card-donor">
            <div className="card-top">
              <div className="card-icon">📋</div>
              <div className="badge">⏱️ {t('home.fastBadge')}</div>
            </div>

            <h2 className="card-title">{t('home.donor')}</h2>
            <p className="card-description">
              {t('home.donorDesc')}
            </p>

            <button 
              onClick={() => navigate('/postcode')}
              className="cta-link card-donor"
            >
              {t('home.donor')} →
            </button>
          </div>

          {/* Organization Card (Teal) */}
          <div className="card card-org">
            <div className="card-top">
              <div className="card-icon">👥</div>
              <div className="badge">⚡ {t('home.smartMatchBadge')}</div>
            </div>

            <h2 className="card-title">{t('home.organization')}</h2>
            <p className="card-description">
              {t('home.orgDesc')}
            </p>

            <button 
              onClick={() => navigate('/org/code')}
              className="cta-link card-org"
            >
              {t('home.organization')} →
            </button>
          </div>
        </div>

        <div className="footer-message">
          {t('home.footerMessage')}
        </div>
      </main>

      {/* Footer */}
      <footer className="home-footer">
        {t('home.footerMeta')}
      </footer>
    </div>
  )
}

export default HomePage
