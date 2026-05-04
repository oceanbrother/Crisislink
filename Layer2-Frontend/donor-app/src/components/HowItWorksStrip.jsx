import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function HowItWorksStrip({ role = 'donor', onNavigate }) {
  const { t } = useTranslation()
  const storageKey = `crisislink-hiw-dismissed-${role}`
  const [dismissed, setDismissed] = useState(() => {
    try { return window.localStorage.getItem(storageKey) === '1' } catch { return false }
  })

  if (dismissed) return null

  const color = role === 'donor' ? '#b86e10' : '#1a7c54'
  const softBg = role === 'donor' ? '#fff8ee' : '#f0faf5'
  const borderColor = role === 'donor' ? 'rgba(184,110,16,0.14)' : 'rgba(26,124,84,0.14)'
  const ns = role === 'donor' ? 'donor' : 'org'

  const steps = role === 'donor'
    ? [
        { icon: 'add_photo_alternate', title: t(`hiw.donor.step1Title`), desc: t(`hiw.donor.step1Desc`), cta: t(`hiw.donor.step1Cta`), path: '/donor/post' },
        { icon: 'notifications_active', title: t(`hiw.donor.step2Title`), desc: t(`hiw.donor.step2Desc`), cta: null, path: null },
        { icon: 'local_shipping',       title: t(`hiw.donor.step3Title`), desc: t(`hiw.donor.step3Desc`), cta: null, path: null },
        { icon: 'check_circle',         title: t(`hiw.donor.step4Title`), desc: t(`hiw.donor.step4Desc`), cta: t(`hiw.donor.step4Cta`), path: '/donor/post' },
      ]
    : [
        { icon: 'search',             title: t(`hiw.org.step1Title`), desc: t(`hiw.org.step1Desc`), cta: null, path: null },
        { icon: 'handshake',          title: t(`hiw.org.step2Title`), desc: t(`hiw.org.step2Desc`), cta: null, path: null },
        { icon: 'directions_car',     title: t(`hiw.org.step3Title`), desc: t(`hiw.org.step3Desc`), cta: null, path: null },
        { icon: 'volunteer_activism', title: t(`hiw.org.step4Title`), desc: t(`hiw.org.step4Desc`), cta: null, path: null },
      ]

  const dismiss = () => {
    try { window.localStorage.setItem(storageKey, '1') } catch {}
    setDismissed(true)
  }

  return (
    <div style={{
      background: softBg,
      border: `1px solid ${borderColor}`,
      borderRadius: '1rem',
      padding: '0.85rem 1rem 0.9rem',
      marginBottom: '0.25rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
        <span style={{ fontSize: '0.68rem', fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.09em' }}>
          {t('hiw.label')}
        </span>
        <button
          type="button"
          onClick={dismiss}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#a0aec0', fontSize: '0.72rem', fontWeight: 600, padding: '2px 6px',
            borderRadius: '4px',
          }}
          aria-label="Dismiss how it works"
        >
          {t('hiw.dismiss')}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem' }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%',
                background: color, color: '#fff',
                fontSize: '0.62rem', fontWeight: 800, flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {i + 1}
              </span>
              <span className="material-symbols-outlined" style={{ fontSize: '0.95rem', color }}>
                {step.icon}
              </span>
              <span style={{ fontSize: '0.73rem', fontWeight: 700, color: '#2d3748', lineHeight: 1.2 }}>
                {step.title}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.67rem', color: '#718096', lineHeight: 1.45, paddingLeft: '26px' }}>
              {step.desc}
            </p>
            {step.cta && step.path && onNavigate ? (
              <button
                type="button"
                onClick={() => onNavigate(step.path)}
                style={{
                  marginLeft: '26px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color, fontSize: '0.67rem', fontWeight: 600, padding: 0,
                  textAlign: 'left',
                }}
              >
                {step.cta} →
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
