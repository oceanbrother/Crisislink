import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import DonationForm from '../components/DonationForm'
import '../styles/DonationFormPage.css'

const DonationFormPage = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <div className="donation-form-page">
      {/* Header */}
      <header className="form-header">
        <button 
          onClick={() => navigate(-1)}
          className="back-btn"
        >
          ←
        </button>
        <h1>{t('donation.pageTitle')}</h1>
        <div></div>
      </header>

      {/* Main Form */}
      <div className="form-container">
        <DonationForm />
      </div>
    </div>
  )
}

export default DonationFormPage
