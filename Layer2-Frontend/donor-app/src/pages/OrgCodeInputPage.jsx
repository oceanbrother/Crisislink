import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import logoUrl from '../assets/outbackshare-logo.png'
import textureImg from '../assets/post-food-texture.jpg'
import LanguageSwitcher from '../components/LanguageSwitcher'

const ORG_SESSION_KEY = 'crisislink-org-session'

const OrgCodeInputPage = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [orgCode, setOrgCode] = useState('')
  const [error, setError] = useState('')

  // focus the code input on mount
  useEffect(() => {
    document.getElementById('org-code-input')?.focus()
  }, [])

  // strip invalid characters and clear any previous error on change
  const handleOrgCodeChange = (e) => {
    const value = e.target.value.replace(/[^A-Za-z0-9 -]/g, '').slice(0, 40)
    setOrgCode(value)
    if (error) setError('')
  }

  // validate and save org session then navigate to listings
  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = orgCode.trim()
    if (!trimmed) { setError(t('orgCode.example', 'Please enter your organisation code.')); return }
    const orgSession = { orgCode: trimmed.toUpperCase() }
    window.localStorage.setItem(ORG_SESSION_KEY, JSON.stringify(orgSession))
    navigate('/org/listings', { state: orgSession })
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#1b4332', fontFamily: 'Inter, system-ui, sans-serif', position: 'relative', overflow: 'hidden' }}>

      {/* Bloom effects */}
      <div style={{ position: 'fixed', top: '5%', left: '10%', width: 500, height: 500, borderRadius: '50%', background: 'rgba(45,106,79,0.3)', filter: 'blur(90px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '10%', right: '5%', width: 400, height: 400, borderRadius: '50%', background: 'rgba(45,106,79,0.22)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `url(${textureImg})`, backgroundSize: 'cover', opacity: 0.04, pointerEvents: 'none', zIndex: 0 }} />

      {/* Left story panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 64px', position: 'relative', zIndex: 1 }}>
        <button type="button" onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', marginBottom: 48, width: 'fit-content', padding: 0 }}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
          Back to home
        </button>

        <img src={logoUrl} alt="OutBackShare" style={{ height: 38, width: 'auto', objectFit: 'contain', objectPosition: 'left', filter: 'brightness(0) invert(1)', marginBottom: 48 }} />

        <span style={{ display: 'inline-block', marginBottom: 20, padding: '6px 16px', background: 'rgba(149,212,179,0.12)', border: '1px solid rgba(149,212,179,0.28)', borderRadius: 999, color: '#95d4b3', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', width: 'fit-content' }}>
          Community Workspace
        </span>

        <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 900, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.03em', margin: '0 0 20px' }}>
          Coordinate food<br />where it's needed most.
        </h2>

        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, maxWidth: 400, margin: '0 0 40px' }}>
          Every morning Sarah checks the Live Board to claim listings before her shift starts. One claim can feed 40 families before lunch.
        </p>

        {/* Sarah testimonial */}
        <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(149,212,179,0.18)', borderRadius: 20, padding: '24px 24px', maxWidth: 440 }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, margin: '0 0 16px', fontStyle: 'italic' }}>
            "CrisisLink shows me exactly which suburb needs restocking before I even leave home. I've cut decision time from an hour to under five minutes."
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #95d4b3, #2d6a4f)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#fff' }}>person</span>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Sarah M.</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Community Food Bank Manager · Reservoir, VIC</div>
            </div>
          </div>
        </div>

        {/* Trust badges */}
        <div style={{ display: 'flex', gap: 16, marginTop: 32, flexWrap: 'wrap' }}>
          {[
            { icon: 'security', label: 'Secure access' },
            { icon: 'groups', label: '200+ organisations' },
            { icon: 'volunteer_activism', label: '12,000 meals redirected' },
          ].map(({ icon, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 500 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#95d4b3' }}>{icon}</span>
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Right login card */}
      <div style={{ width: 460, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 48px', position: 'relative', zIndex: 1, borderLeft: '1px solid rgba(149,212,179,0.12)', background: 'rgba(15,40,28,0.5)', backdropFilter: 'blur(20px)' }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(149,212,179,0.15)', border: '1px solid rgba(149,212,179,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#95d4b3' }}>groups</span>
          </div>

          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
            {t('orgCode.title', 'Organisation Workspace')}
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: '0 0 32px', lineHeight: 1.6 }}>
            {t('orgCode.subtitle', 'Enter your organisation code to access the listings board.')}
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label htmlFor="org-code-input" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                Organisation Code
              </label>
              <input
                id="org-code-input"
                type="text"
                value={orgCode}
                onChange={handleOrgCodeChange}
                placeholder={t('orgCode.placeholder', 'e.g. CBO-ABC-1234')}
                maxLength="40"
                autoComplete="organization"
                aria-label={t('orgCode.label', 'Organisation code')}
                style={{ width: '100%', padding: '14px 18px', borderRadius: 14, border: '1px solid rgba(149,212,179,0.2)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 15, fontWeight: 600, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', letterSpacing: '0.05em', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                onFocus={e => { e.target.style.borderColor = '#95d4b3'; e.target.style.boxShadow = '0 0 0 3px rgba(149,212,179,0.15)' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(149,212,179,0.2)'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,180,171,0.12)', color: '#ffb4ab', fontSize: 13, border: '1px solid rgba(255,180,171,0.2)' }} role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              style={{ width: '100%', padding: '15px 24px', borderRadius: 14, border: 'none', background: '#95d4b3', color: '#002114', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit', transition: 'opacity 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              {t('orgCode.button', 'Access workspace')}
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
            </button>

            <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
              {t('common.secure', 'Your code is used only to identify your organisation within the network.')}
            </p>
          </form>

          <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: '0 0 16px', textAlign: 'center' }}>
              {t('orgCode.noCode', "Don't have a code?")}{' '}
              <button
                type="button"
                style={{ color: '#95d4b3', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', padding: 0 }}
                onClick={() => navigate('/register/org')}
              >
                {t('orgCode.registerLink', 'Register your organisation')}
              </button>
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Language</span>
              <LanguageSwitcher dark />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OrgCodeInputPage
