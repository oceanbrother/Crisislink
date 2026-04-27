import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import '../styles/OrgCodeInputPage.css'

const ORG_SESSION_KEY = 'crisislink-org-session'

const OrgCodeInputPage = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [orgCode, setOrgCode] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    document.getElementById('org-code-input')?.focus()
  }, [])

  const handleOrgCodeChange = (e) => {
    const value = e.target.value.replace(/[^A-Za-z0-9 -]/g, '').slice(0, 40)
    setOrgCode(value)
    if (error) setError('')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = orgCode.trim()
    if (!trimmed) {
      setError(t('orgCode.example'))
      return
    }

    const orgSession = { orgCode: trimmed.toUpperCase() }
    window.localStorage.setItem(ORG_SESSION_KEY, JSON.stringify(orgSession))
    navigate('/org/listings', { state: orgSession })
  }

  return (
    <div className="org-code-page">
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
          <p className="org-code-desc">{t('orgCode.subtitle')}</p>

          <form onSubmit={handleSubmit} className="form-group">
            <label className="org-code-label" htmlFor="org-code-input">
              {t('orgCode.label')}
            </label>
            <input
              id="org-code-input"
              className="org-code-input"
              type="text"
              value={orgCode}
              onChange={handleOrgCodeChange}
              placeholder={t('orgCode.placeholder')}
              maxLength="40"
              autoComplete="organization"
            />

            {error && <div className="error-message">{error}</div>}

            <button type="submit" className="submit-btn">
              {t('orgCode.button')}
            </button>

            <button
              type="button"
              className="secondary-link"
              onClick={() => navigate('/')}
            >
              {t('common.back')}
            </button>

            <p className="privacy-note">{t('orgCode.note')}</p>
          </form>
        </div>
      </main>
    </div>
  )
}

export default OrgCodeInputPage
