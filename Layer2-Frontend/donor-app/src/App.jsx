import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'

// Pages
import HomePage from './pages/HomePage'
import PostcodeInputPage from './pages/PostcodeInputPage'
import PostFeedPage from './pages/PostFeedPage'
import DonationFormPage from './pages/DonationFormPage'
import OrgCodeInputPage from './pages/OrgCodeInputPage'
import LiveListingBoard from './pages/LiveListingBoard'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route path="/postcode" element={<PostcodeInputPage />} />
        <Route path="/feed/:postcode" element={<PostFeedPage />} />
        <Route path="/form/:postcode" element={<DonationFormPage />} />
        <Route path="/form" element={<Navigate to="/postcode" replace />} />

        <Route path="/org/code" element={<OrgCodeInputPage />} />
        <Route path="/org/dashboard" element={<LiveListingBoard />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
