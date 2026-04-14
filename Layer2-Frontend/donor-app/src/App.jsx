import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'

// Pages - Donor Flow
import HomePage from './pages/HomePage'
import PostcodeInputPage from './pages/PostcodeInputPage'
import PostFeedPage from './pages/PostFeedPage'
import DonationFormPage from './pages/DonationFormPage'

// Pages - Organization Flow
import OrgCodeInputPage from './pages/OrgCodeInputPage'
import LiveListingBoard from './pages/LiveListingBoard'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home page - role selection */}
        <Route path="/" element={<HomePage />} />

        {/* Donor flow: postcode -> feed -> form */}
        <Route path="/postcode" element={<PostcodeInputPage />} />
        <Route path="/feed/:postcode" element={<PostFeedPage />} />

        {/* Form with optional postcode param so we can redirect back to feed */}
        <Route path="/form/:postcode" element={<DonationFormPage />} />
        <Route path="/form" element={<DonationFormPage />} />

        {/* Organization flow: code -> dashboard */}
        <Route path="/org/code" element={<OrgCodeInputPage />} />
        <Route path="/org/dashboard" element={<LiveListingBoard />} />

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
