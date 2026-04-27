import React, { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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

const ACCESS_STORAGE_KEY = 'crisislink-site-access-granted'

function PasswordGate({ expectedPassword, children }) {
  const [inputPassword, setInputPassword] = useState('')
  const [error, setError] = useState('')
  const [isUnlocked, setIsUnlocked] = useState(false)

  useEffect(() => {
    if (!expectedPassword) {
      setIsUnlocked(true)
      return
    }

    // Remove the legacy persistent unlock so the gate only lasts for the current browser session.
    window.localStorage.removeItem(ACCESS_STORAGE_KEY)

    const savedAccess = window.sessionStorage.getItem(ACCESS_STORAGE_KEY)
    if (savedAccess === 'true') {
      setIsUnlocked(true)
    }
  }, [expectedPassword])

  const handleSubmit = (event) => {
    event.preventDefault()

    if (inputPassword.trim() === expectedPassword) {
      window.sessionStorage.setItem(ACCESS_STORAGE_KEY, 'true')
      setIsUnlocked(true)
      setError('')
      return
    }

    setError('Incorrect password. Please try again.')
  }

  if (isUnlocked) {
    return children
  }

  return (
    <div className="site-gate-shell">
      <div className="site-gate-card">
        <div className="site-gate-badge">CrisisLink Access</div>
        <h1>Protected Demo Site</h1>
        <p>
          This website is currently restricted for teaching, mentor review, and
          project demonstration purposes.
        </p>

        <form className="site-gate-form" onSubmit={handleSubmit}>
          <label htmlFor="site-password">Enter password</label>
          <input
            id="site-password"
            type="password"
            value={inputPassword}
            onChange={(event) => setInputPassword(event.target.value)}
            placeholder="Project access password"
          />
          {error ? <p className="site-gate-error">{error}</p> : null}
          <button type="submit">Enter site</button>
        </form>
      </div>
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      {/* Home page - role selection */}
      <Route path="/" element={<HomePage />} />

      {/* Donor flow: workspace -> post / hotspots / listings */}
      <Route path="/postcode" element={<PostcodeInputPage />} />
      <Route path="/donor" element={<DonorDashboardPage />} />
      <Route path="/donor/post" element={<DonationFormPage />} />
      <Route path="/donor/listings" element={<PostFeedPage />} />
      <Route path="/donor/hotspots" element={<DonorHotspotsPage />} />
      <Route path="/feed/:postcode" element={<PostFeedPage />} />

      {/* Legacy aliases kept working for backwards compatibility */}
      <Route path="/form/:postcode" element={<DonationFormPage />} />
      <Route path="/form" element={<DonationFormPage />} />

      {/* Organization flow: code -> listings + alerts */}
      <Route path="/org/code" element={<OrgCodeInputPage />} />
      <Route path="/org/dashboard" element={<LiveListingBoard />} />
      <Route path="/org/listings" element={<LiveListingBoard />} />
      <Route path="/org/alerts" element={<OrgAlertsPage />} />

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
    <PasswordGate expectedPassword={expectedPassword}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </PasswordGate>
  )
}

export default App
