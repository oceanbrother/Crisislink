import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../components/LanguageSwitcher'
import '../styles/PostcodeInputPage.css'

const PostcodeInputPage = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [postcode, setPostcode] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    document.getElementById('postcode-input')?.focus()
  }, [])

  const handleInputChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4)
    setPostcode(value)
    setError('')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (postcode.length === 4) {
      navigate(`/feed/${postcode}`)
    } else {
      setError(t('postcode.error'))
    }
  }

  return (
    <div className="postcode-page">
      {/* Header */}
      <header className="postcode-header">
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
      <main className="postcode-main">
        <div className="card">
          <div className="card-icon">📍</div>
          
          <h1 className="card-title">{t('postcode.title')}</h1>
          <p className="card-description">{t('postcode.label')}</p>

          <form onSubmit={handleSubmit} className="form-group">
            <div className="input-wrapper">
              <input 
                id="postcode-input"
                type="text" 
                value={postcode}
                onChange={handleInputChange}
                placeholder={t('postcode.placeholder')}
                maxLength="4"
                inputMode="numeric"
                autoComplete="postal-code"
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" className="submit-btn">
              {t('postcode.submit')}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

export default PostcodeInputPage
