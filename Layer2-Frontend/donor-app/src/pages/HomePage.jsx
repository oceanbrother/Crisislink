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
            <div className="stat-text"><strong>2,841 meals saved</strong> this week</div>
          </div>
          <div className="stat-item">
            <div className="stat-text"><strong>94 donors</strong> · <strong>31 food banks</strong></div>
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
              <div className="badge">⏱️ 60 seconds</div>
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
              <div className="badge">⚡ Smart match</div>
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
          No account, no password, no forms — just a postcode or org code
        </div>
      </main>

      {/* Footer */}
      <footer className="home-footer">
        CrisisLink · Melbourne, VIC · No account required
      </footer>
    </div>
  )
}

export default HomePage
