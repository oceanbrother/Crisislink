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
        {/* Home page - role selection */}
        <Route path="/" element={<HomePage />} />

        {/* Donor flow: postcode -> feed -> form */}
        <Route path="/postcode" element={<PostcodeInputPage />} />
        <Route path="/feed/:postcode" element={<PostFeedPage />} />
        <Route path="/form" element={<DonationFormPage />} />

        {/* Organization flow: code input -> dashboard */}
        <Route path="/org/code" element={<OrgCodeInputPage />} />
        <Route path="/org/dashboard" element={<LiveListingBoard />} />

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
