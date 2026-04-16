import { BrowserRouter, Routes, Route } from 'react-router-dom'
import UserApp from './UserApp'
import DevApp from './DevApp'

export default function AppRoot() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<UserApp />} />
        <Route path="/dev" element={<DevApp />} />
      </Routes>
    </BrowserRouter>
  )
}
