import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import UserApp from './UserApp'
import DevApp from './DevApp'
import AdminApp from './AdminApp'

function AppContent() {
  const navigate = useNavigate()

  useEffect(() => {
    // Handle redirect from 404.html
    const redirectPath = sessionStorage.getItem('redirectPath')
    console.log('[AppRoot] Checking for redirectPath:', redirectPath)

    if (redirectPath && redirectPath !== '/') {
      console.log('[AppRoot] Navigating to:', redirectPath)
      sessionStorage.removeItem('redirectPath')
      navigate(redirectPath)
    } else {
      console.log('[AppRoot] No redirect needed, current path:', window.location.pathname)
    }
  }, [navigate])

  return (
    <Routes>
      <Route path="/" element={<UserApp />} />
      <Route path="/admin" element={<AdminApp />} />
      <Route path="/dev" element={<DevApp />} />
    </Routes>
  )
}

export default function AppRoot() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AppContent />
    </BrowserRouter>
  )
}
