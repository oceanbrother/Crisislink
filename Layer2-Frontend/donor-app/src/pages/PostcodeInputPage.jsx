import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { saveDonorPostcode } from '../utils/donorPostcode'
import logoUrl from '../assets/outbackshare-logo.png'
import produceImg from '../assets/postcode-produce.jpg'
import mapImg from '../assets/postcode-map.jpg'

const PostcodeInputPage = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [location, setLocation] = useState('')
  const [error, setError] = useState('')

  // focus the text input on first render
  useEffect(() => {
    document.getElementById('location-input')?.focus()
  }, [])

  // trim input and clear error on each keystroke
  const handleInputChange = (e) => {
    setLocation(e.target.value.slice(0, 60))
    if (error) setError('')
  }

  // validate postcode or suburb then navigate to listings
  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = location.trim()
    if (!trimmed) {
      setError(t('postcode.empty', 'Please enter a suburb name or 4-digit postcode.'))
      return
    }
    if (/^\d{4}$/.test(trimmed)) {
      saveDonorPostcode(trimmed)
      navigate('/donor/listings', { state: { postcode: trimmed } })
    } else {
      navigate('/donor/listings', { state: { suburb: trimmed } })
    }
  }

  // request browser geolocation and pass coordinates to listings page
  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setError(t('postcode.noGeo', 'Geolocation is not supported by your browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => navigate('/donor/listings', { state: { lat: pos.coords.latitude, lng: pos.coords.longitude } }),
      () => setError(t('postcode.geoFail', 'Unable to get your location. Please enter a suburb or postcode.'))
    )
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif', background: '#f9f9f6', overflow: 'hidden' }}>

      {/* Fixed header */}
      <header style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px', height: 76,
        background: 'rgba(249,249,246,0.92)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid #e8e4dd', zIndex: 50
      }}>
        <button type="button" onClick={() => navigate('/')} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <img src={logoUrl} alt="OutBackShare" style={{ height: 34, width: 'auto', objectFit: 'contain', display: 'block' }} />
        </button>
        <button
          type="button"
          onClick={() => navigate('/register/donor')}
          aria-label="Close"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', color: '#404943', transition: 'background 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.background = '#eeeeeb'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>close</span>
        </button>
      </header>

      {/* Split body */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'row', minHeight: 0 }}>

        {/* Left image panel */}
        <section style={{ position: 'relative', width: '50%', flexShrink: 0, overflow: 'hidden' }}>
          <img
            src={produceImg}
            alt="Community produce sharing"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(15,82,56,0.4), transparent), linear-gradient(to top, rgba(8,24,16,0.72) 0%, transparent 52%)' }} />
          {/* Caption overlay */}
          <div style={{ position: 'absolute', bottom: 52, left: 52, maxWidth: 420 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.93)', backdropFilter: 'blur(12px)', padding: '5px 14px', borderRadius: 999, border: '1px solid #e8e8e5', marginBottom: 18 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#9a442d', fontVariationSettings: "'FILL' 1" }}>favorite</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#9a442d', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Join 12,000+ Stewards</span>
            </span>
            <h2 style={{ fontSize: 'clamp(36px, 4vw, 54px)', fontWeight: 700, color: '#fff', lineHeight: 1.15, letterSpacing: '-0.02em', margin: '0 0 16px', textShadow: '0 2px 20px rgba(0,0,0,0.4)' }}>
              Connecting Abundance to Need.
            </h2>
            <p style={{ fontSize: 'clamp(16px, 1.6vw, 20px)', color: 'rgba(255,255,255,0.92)', lineHeight: 1.65, margin: 0, textShadow: '0 1px 10px rgba(0,0,0,0.25)' }}>
              Your surplus can fill a neighbour's shelf today. Find your local circle to start sharing.
            </p>
          </div>
        </section>

        {/* Right form panel */}
        <section style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f9f9f6', padding: '0 64px', overflowY: 'auto' }}>
          <form
            onSubmit={handleSubmit}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '52px 0 48px' }}
          >

            {/* Heading block */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h1 style={{ fontSize: 'clamp(34px, 3.6vw, 48px)', fontWeight: 700, color: '#1a1c1b', lineHeight: 1.15, letterSpacing: '-0.02em', margin: 0 }}>
                Find your local circle
              </h1>
              <p style={{ fontSize: 'clamp(16px, 1.5vw, 19px)', color: '#404943', lineHeight: 1.65, margin: 0 }}>
                We'll use your location to show you the most active demand alerts and supply gaps in your neighbourhood.
              </p>
            </div>

            {/* Input and action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label htmlFor="location-input" style={{ fontSize: 15, fontWeight: 600, color: '#404943', marginLeft: 2, letterSpacing: '0.01em' }}>
                  Suburb or 4-digit Postcode
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: 20, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                    <span className="material-symbols-outlined" style={{ color: '#707973', fontSize: 24 }}>location_on</span>
                  </div>
                  <input
                    id="location-input"
                    type="text"
                    value={location}
                    onChange={handleInputChange}
                    placeholder="e.g. 3000 or Melbourne"
                    maxLength={60}
                    autoComplete="postal-code"
                    style={{
                      width: '100%', height: 72, paddingLeft: 60, paddingRight: 20,
                      background: '#fff', border: '1px solid #e8e4dd', borderRadius: 14,
                      fontSize: 'clamp(17px, 1.7vw, 20px)', color: '#1a1c1b',
                      outline: 'none', boxSizing: 'border-box',
                      fontFamily: 'Inter, system-ui, sans-serif',
                      transition: 'border-color 0.2s, box-shadow 0.2s'
                    }}
                    onFocus={e => { e.target.style.borderColor = '#0f5238'; e.target.style.boxShadow = '0 0 0 3px rgba(15,82,56,0.12)' }}
                    onBlur={e => { e.target.style.borderColor = '#e8e4dd'; e.target.style.boxShadow = 'none' }}
                  />
                </div>
              </div>

              {error && (
                <div style={{ padding: '12px 18px', borderRadius: 10, background: '#fbe2e5', color: '#9b1e28', fontSize: 15, lineHeight: 1.5 }} role="alert">
                  {error}
                </div>
              )}

              <button
                type="submit"
                style={{ width: '100%', height: 66, background: '#0f5238', color: '#fff', borderRadius: 14, border: 'none', fontWeight: 700, fontSize: 'clamp(16px, 1.5vw, 18px)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', boxShadow: '0 4px 24px rgba(15,82,56,0.22)', transition: 'opacity 0.2s, transform 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.91'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <span>Find Hotspots</span>
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>arrow_forward</span>
              </button>

              <button
                type="button"
                onClick={handleUseLocation}
                style={{ width: '100%', height: 66, background: 'transparent', color: '#0f5238', borderRadius: 14, border: 'none', fontWeight: 700, fontSize: 'clamp(16px, 1.5vw, 18px)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#eeeeeb'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>my_location</span>
                <span>Use Current Location</span>
              </button>
            </div>

            {/* Feature bento grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, paddingTop: 28, borderTop: '1px solid #e8e8e5' }}>
              <div
                style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '18px 16px', borderRadius: 14, transition: 'background 0.2s', cursor: 'default' }}
                onMouseEnter={e => e.currentTarget.style.background = '#eeeeeb'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ background: '#b1f0ce', padding: 10, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#0e5138' }}>notifications_active</span>
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#1a1c1b', margin: '0 0 5px' }}>Demand Alerts</p>
                  <p style={{ fontSize: 14, color: '#404943', margin: 0, lineHeight: 1.55 }}>Know when local food banks are running low.</p>
                </div>
              </div>

              <div
                style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '18px 16px', borderRadius: 14, transition: 'background 0.2s', cursor: 'default' }}
                onMouseEnter={e => e.currentTarget.style.background = '#eeeeeb'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ background: '#ffdbd2', padding: 10, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#7c2e19' }}>inventory_2</span>
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#1a1c1b', margin: '0 0 5px' }}>Supply Gaps</p>
                  <p style={{ fontSize: 14, color: '#404943', margin: 0, lineHeight: 1.55 }}>Fill the gaps in your local community pantry.</p>
                </div>
              </div>
            </div>

            {/* Progress dots */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#0f5238', display: 'block' }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#e2e3e0', display: 'block' }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#e2e3e0', display: 'block' }} />
            </div>

          </form>
        </section>
      </main>

      {/* Map context badge */}
      <div style={{ position: 'fixed', bottom: 16, right: 20, zIndex: 50 }}>
        <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(14px)', border: '1px solid #e8e4dd', padding: 6, borderRadius: 999, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 20px rgba(61,64,91,0.10)' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
            <img src={mapImg} alt="Australia map" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#404943', paddingRight: 12 }}>Currently viewing Australia</span>
        </div>
      </div>

    </div>
  )
}

export default PostcodeInputPage
