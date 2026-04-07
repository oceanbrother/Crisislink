import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import '../styles/PostcodeInputPage.css'

const PostcodeInputPage = () => {
  const navigate = useNavigate()
  const [postcode, setPostcode] = useState('')

  useEffect(() => {
    document.getElementById('postcode-input')?.focus()
  }, [])

  const handleInputChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4)
    setPostcode(value)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (postcode.length === 4) {
      navigate(`/feed/${postcode}`)
    } else {
      alert('Please enter a valid 4-digit postcode')
    }
  }

  return (
    <div className="postcode-page">
      {/* Header */}
      <header className="postcode-header">
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
      <main className="postcode-main">
        <div className="card">
          <div className="card-icon">📍</div>
          
          <h1 className="card-title">What's your postcode?</h1>
          <p className="card-description">So we can show nearby food banks</p>

          <form onSubmit={handleSubmit} className="form-group">
            <div className="input-wrapper">
              <input 
                id="postcode-input"
                type="text" 
                value={postcode}
                onChange={handleInputChange}
                placeholder="3000"
                maxLength="4"
                inputMode="numeric"
                autoComplete="postal-code"
              />
            </div>

            <button type="submit" className="submit-btn">
              Post surplus
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

export default PostcodeInputPage
