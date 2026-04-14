import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../components/LanguageSwitcher'
import '../styles/OrgCodeInputPage.css'

const OrgCodeInputPage = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [orgCode, setOrgCode] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    document.getElementById('org-code-input')?.focus()
  }, [])

  const handleInputChange = (e) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20)
    setOrgCode(value)
    if (error) setError('')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!orgCode.trim()) {
      setError(t('donation.errors.orgCode'))
      return
    }

    if (orgCode.trim()) {
      navigate('/org/dashboard', { state: { orgCode } })
    } else {
      setError(t('orgCode.example'))
    }
  }

  return (
    <div className="org-code-page">
      <div style={{ position: 'absolute', top: '2rem', right: '2rem', zIndex: 10 }}>
        <LanguageSwitcher />
      </div>
      <button className="back-link" onClick={() => navigate('/')}>
        <span className="material-symbols-outlined">arrow_back</span>
      </button>

      <main className="org-code-main">
        <div className="org-code-card">
          <div className="org-code-icon-circle">
            <span className="material-symbols-outlined">business</span>
          </div>

          <div className="org-code-brand">{t('appName')}</div>

          <h1 className="org-code-title">{t('orgCode.title')}</h1>
          <p className="org-code-desc">
            {t('orgCode.subtitle')}
          </p>

          <form onSubmit={handleSubmit} className="form-group">
            <input
              id="org-code-input"
              className="org-code-input"
              type="text"
              value={orgCode}
              onChange={handleInputChange}
              placeholder={t('orgCode.placeholder')}
              maxLength="20"
              autoComplete="off"
            />

            {error && <div className="error-message">{error}</div>}

            <button type="submit" className="submit-btn">
              {t('orgCode.button')} →
            </button>

            <button
              type="button"
              className="secondary-link"
              onClick={() => navigate('/')}
            >
              {t('common.back')}
            </button>

            <p className="privacy-note">
              {t('common.secure')}
            </p>
          </form>
        </div>
      </main>
    </div>
  )
}

export default OrgCodeInputPage
