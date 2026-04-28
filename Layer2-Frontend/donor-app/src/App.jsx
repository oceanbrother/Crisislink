import React, { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import './App.css'

// Pages - Donor Flow
import HomePage from './pages/HomePage'
import PostcodeInputPage from './pages/PostcodeInputPage'
import PostFeedPage from './pages/PostFeedPage'
import DonationFormPage from './pages/DonationFormPage'
import DonorDashboardPage from './pages/DonorDashboardPage'
import DonorHotspotsPage from './pages/DonorHotspotsPage'

// Pages - Organization Flow
import OrgCodeInputPage from './pages/OrgCodeInputPage'
import LiveListingBoard from './pages/LiveListingBoard'
import OrgAlertsPage from './pages/OrgAlertsPage'
import OrgSupplyGapPage from './pages/OrgSupplyGapPage'

const ACCESS_STORAGE_KEY = 'crisislink-site-access-granted'

function PasswordGate({ expectedPassword, children }) {
  const { t } = useTranslation()
  const [inputPassword, setInputPassword] = useState('')
  const [error, setError] = useState('')
  const [isUnlocked, setIsUnlocked] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!expectedPassword) {
      setIsUnlocked(true)
      return
    }
    window.localStorage.removeItem(ACCESS_STORAGE_KEY)
    setIsUnlocked(window.sessionStorage.getItem(ACCESS_STORAGE_KEY) === 'true')
  }, [expectedPassword])

  const handleSubmit = (event) => {
    event.preventDefault()

    if (inputPassword.trim() === expectedPassword) {
      window.sessionStorage.setItem(ACCESS_STORAGE_KEY, 'true')
      setIsUnlocked(true)
      setError('')
      navigate('/', { replace: true })
      return
    }

    setError(t('accessGate.error'))
  }

  if (isUnlocked) {
    return children
  }

  return (
    <div className="site-gate-shell">
      <div className="site-gate-layout">
        <section className="site-gate-intro">
          <h1>{t('accessGate.heroTitle')}</h1>
          <p className="site-gate-intro-copy">
            {t('accessGate.heroCopy')}
          </p>

          <ul className="site-gate-value-list" aria-label={t('accessGate.highlightsLabel')}>
            <li>{t('accessGate.bullets.post')}</li>
            <li>{t('accessGate.bullets.coordinate')}</li>
            <li>{t('accessGate.bullets.spot')}</li>
          </ul>

          <p className="site-gate-trust">{t('accessGate.trust')}</p>
        </section>

        <div className="site-gate-card">
          <div className="site-gate-badge">{t('accessGate.badge')}</div>
          <h2>{t('accessGate.title')}</h2>
          <p>{t('accessGate.subtitle')}</p>

          <form className="site-gate-form" onSubmit={handleSubmit}>
            <label htmlFor="site-password">{t('accessGate.label')}</label>
            <input
              id="site-password"
              type="password"
              value={inputPassword}
              onChange={(event) => {
                setInputPassword(event.target.value)
                if (error) {
                  setError('')
                }
              }}
              placeholder={t('accessGate.placeholder')}
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? 'site-password-error' : undefined}
            />
            {error ? <p id="site-password-error" className="site-gate-error">{error}</p> : null}
            <button type="submit" disabled={!inputPassword.trim()}>{t('accessGate.button')}</button>
          </form>
        </div>
      </div>
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      {/* Home page - role selection */}
      <Route path="/" element={<HomePage />} />
      <Route path="/roles" element={<HomePage />} />

      {/* Donor flow: workspace -> post / hotspots / listings */}
      <Route path="/postcode" element={<PostcodeInputPage />} />
      <Route path="/donor" element={<DonorDashboardPage />} />
      <Route path="/donor/post" element={<DonationFormPage />} />
      <Route path="/donor/listings" element={<PostFeedPage />} />
      <Route path="/donor/hotspots" element={<DonorHotspotsPage />} />
      <Route path="/feed/:postcode" element={<PostFeedPage />} />
      <Route path="/hotspots/:postcode" element={<DonorHotspotsPage />} />

      {/* Form with optional postcode param so we can redirect back to feed */}
      <Route path="/form/:postcode" element={<DonationFormPage />} />
      <Route path="/form" element={<DonationFormPage />} />

      {/* Organization flow: code -> listings + alerts */}
      <Route path="/org/code" element={<OrgCodeInputPage />} />
      <Route path="/org/listings" element={<LiveListingBoard />} />
      <Route path="/org/alerts" element={<OrgAlertsPage />} />
      <Route path="/org/gaps" element={<OrgSupplyGapPage />} />

      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  const expectedPassword = useMemo(
    () => import.meta.env.VITE_SITE_PASSWORD?.trim() || '',
    [],
  )

  return (
    <BrowserRouter>
      <PasswordGate expectedPassword={expectedPassword}>
        <AppRoutes />
      </PasswordGate>
    </BrowserRouter>
  )
}

export default App
