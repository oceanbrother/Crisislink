import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/OrgCodeInputPage.css'

const OrgCodeInputPage = () => {
  const navigate = useNavigate()
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
      setError('Please enter your organisation code')
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
        <button 
          onClick={() => navigate('/')}
          className="back-link"
        >
          ← Back
        </button>

        <div className="logo-section">
          <div className="logo">🥬</div>
          <div className="logo-text">CrisisLink</div>
        </div>

        <div className="tagline">
          Move surplus food to the people<br />
          who need it most — in seconds
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

      {/* Main Card */}
      <main className="org-code-main">
        <div className="card">
          <div className="card-icon">👥</div>
          
          <h1 className="card-title">Organisation code</h1>
          <p className="card-subtitle">Issued with your FoodSafe registration</p>

          <form onSubmit={handleSubmit} className="form-group">
            <div className="input-wrapper">
              <input 
                type="text" 
                value={orgCode}
                onChange={handleInputChange}
                placeholder="HCFB-2841"
                maxLength="20"
                autoComplete="off"
                autoFocus
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" className="submit-btn">
              Go to dashboard →
            </button>
          </form>

          <button 
            onClick={handleDemoLogin}
            className="demo-link"
          >
            Demo as Sarah · Harvest City Food Bank →
          </button>
        </div>
      </main>
    </div>
  )
}

export default OrgCodeInputPage
