import React from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/HomePage.css'

const HomePage = () => {
  const navigate = useNavigate()

  return (
    <div className="home-page">
      {/* Header */}
      <header className="home-header">
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

      {/* Main Content */}
      <main className="home-main">
        <div className="section-title">What brings you here?</div>

        <div className="cards-container">
          {/* Donor Card (Amber) */}
          <div className="card card-donor">
            <div className="card-top">
              <div className="card-icon">📋</div>
              <div className="badge">⏱️ 60 seconds</div>
            </div>

            <h2 className="card-title">Post surplus</h2>
            <p className="card-description">
              I have food to donate — bakery, produce, prepared meals
            </p>

            <button 
              onClick={() => navigate('/postcode')}
              className="cta-link card-donor"
            >
              Post surplus →
            </button>
          </div>

          {/* Organization Card (Teal) */}
          <div className="card card-org">
            <div className="card-top">
              <div className="card-icon">👥</div>
              <div className="badge">⚡ Smart match</div>
            </div>

            <h2 className="card-title">Go to dashboard</h2>
            <p className="card-description">
              I coordinate a food bank, pantry or community relief program
            </p>

            <button 
              onClick={() => navigate('/org/code')}
              className="cta-link card-org"
            >
              Go to dashboard →
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
