import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../components/LanguageSwitcher'
import '../styles/OrgCodeInputPage.css'

const OrgCodeInputPage = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [orgCode, setOrgCode] = useState('')
  const [error, setError] = useState('')

  const handleInputChange = (e) => {
    const value = e.target.value.toUpperCase()
    setOrgCode(value)
    if (error) setError('')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!orgCode.trim()) {
      setError(t('orgCode.error'))
      return
    }
    // TODO: Validate org code with backend
    navigate('/org/dashboard', { state: { orgCode } })
  }

  const handleDemoLogin = () => {
    setOrgCode('HCFB-2841')
    // Auto login as demo
    navigate('/org/dashboard', { state: { orgCode: 'HCFB-2841', demoMode: true, orgName: 'Harvest City Food Bank', userName: 'Sarah' } })
  }

  return (
    <div className="org-code-page">
      {/* Header */}
      <header className="org-code-header">
        <div className="header-top">
          <button 
            onClick={() => navigate('/')}
            className="back-link"
          >
            ← {t('common.back')}
          </button>
          <LanguageSwitcher />
        </div>

        <div className="logo-section">
          <div className="logo">🥬</div>
          <div className="logo-text">{t('common.appName')}</div>
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

      {/* Main Card */}
      <main className="org-code-main">
        <div className="card">
          <div className="card-icon">👥</div>
          
          <h1 className="card-title">{t('orgCode.title')}</h1>
          <p className="card-subtitle">{t('orgCode.label')}</p>

          <form onSubmit={handleSubmit} className="form-group">
            <div className="input-wrapper">
              <input 
                type="text" 
                value={orgCode}
                onChange={handleInputChange}
                placeholder={t('orgCode.placeholder')}
                maxLength="20"
                autoComplete="off"
                autoFocus
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" className="submit-btn">
              {t('orgCode.submit')} →
            </button>
          </form>

          <button 
            onClick={handleDemoLogin}
            className="demo-link"
          >
            {t('orgCode.demo')} · Harvest City Food Bank →
          </button>
        </div>
      </main>
    </div>
  )
}

export default OrgCodeInputPage
