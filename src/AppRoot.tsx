import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import UserApp from './UserApp'
import DevApp from './DevApp'

function AppContent() {
  const navigate = useNavigate()

  useEffect(() => {
    // Handle redirect from 404.html
    const redirectPath = sessionStorage.getItem('redirectPath')
    if (redirectPath && redirectPath !== '/') {
      sessionStorage.removeItem('redirectPath')
      navigate(redirectPath)
    }
  }, [navigate])

  return (
    <Routes>
      <Route path="/" element={<UserApp />} />
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
