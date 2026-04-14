import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
    if (error) setError('')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (postcode.length === 4) {
      navigate(`/feed/${postcode}`)
    } else {
      setError(t('postcode.example'))
    }
  }

  return (
    <div className="postcode-page">
      <button className="back-link" onClick={() => navigate('/')}>
        <span className="material-symbols-outlined">arrow_back</span>
      </button>

      <main className="postcode-main">
        <div className="postcode-card">
          <div className="postcode-icon-circle">
            <span className="material-symbols-outlined">location_on</span>
          </div>

          <div className="postcode-brand">{t('appName')}</div>

          <h1 className="postcode-title">{t('postcode.title')}</h1>
          <p className="postcode-desc">{t('postcode.subtitle')}</p>

          <form onSubmit={handleSubmit} className="form-group">
            <input
              id="postcode-input"
              className="postcode-input"
              type="text"
              value={postcode}
              onChange={handleInputChange}
              placeholder={t('postcode.placeholder')}
              maxLength="4"
              inputMode="numeric"
              autoComplete="postal-code"
            />

            {error && <div className="inline-error-message">{error}</div>}

            <button type="submit" className="submit-btn">
              {t('postcode.button')} →
            </button>

            <p className="privacy-note">{t('common.secure')}</p>
          </form>
        </div>
      </main>
    </div>
  )
}

export default PostcodeInputPage
