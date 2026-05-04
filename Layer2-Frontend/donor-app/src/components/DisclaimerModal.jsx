import React, { useState } from 'react'

const STORAGE_KEY = 'crisislink-disclaimer-v1'

export default function DisclaimerModal() {
  const [visible, setVisible] = useState(() => {
    try { return window.localStorage.getItem(STORAGE_KEY) !== '1' } catch { return true }
  })

  if (!visible) return null

  const accept = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
      window.localStorage.setItem('crisislink-disclaimer-ts', new Date().toISOString())
    } catch {}
    setVisible(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(15,25,20,0.60)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
      backdropFilter: 'blur(3px)',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '1.4rem',
        padding: '2rem 2rem 1.75rem',
        maxWidth: '460px',
        width: '100%',
        boxShadow: '0 28px 64px rgba(0,0,0,0.22)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.1rem' }}>
          <span className="material-symbols-outlined" style={{ color: '#dd6b20', fontSize: '1.7rem' }}>
            info
          </span>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1a202c', letterSpacing: '-0.02em' }}>
            Before you continue
          </h2>
        </div>

        <ul style={{
          margin: '0 0 1.6rem',
          padding: '0 0 0 1.1rem',
          lineHeight: 1.72,
          fontSize: '0.87rem',
          color: '#4a5568',
        }}>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Accuracy:</strong> You are responsible for the accuracy of any food listing you post, including quantity, condition, and allergen information.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Allergen risk:</strong> OutBackShare cannot independently verify allergen declarations. Recipients must exercise their own judgement.
          </li>
          <li>
            <strong>Platform role:</strong> OutBackShare is a coordination platform only. We do not handle, inspect, or accept liability for donated food items.
          </li>
        </ul>

        <button
          type="button"
          onClick={accept}
          style={{
            width: '100%',
            padding: '0.88rem',
            background: '#1a9c67',
            color: '#fff',
            border: 'none',
            borderRadius: '999px',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            letterSpacing: '-0.01em',
          }}
        >
          I understand — continue
        </button>

        <p style={{ margin: '0.75rem 0 0', textAlign: 'center', fontSize: '0.7rem', color: '#a0aec0' }}>
          This acknowledgement is saved locally for your session.
        </p>
      </div>
    </div>
  )
}
