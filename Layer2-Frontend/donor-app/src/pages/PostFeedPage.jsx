import React from 'react'
import { useNavigate } from 'react-router-dom'
import DonationForm from '../components/DonationForm'
import '../styles/DonationFormPage.css'

const DonationFormPage = () => {
  const navigate = useNavigate()

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
        <h1>Post Surplus</h1>
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
