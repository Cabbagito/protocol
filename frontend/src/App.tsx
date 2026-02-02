import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Exercises from './pages/Exercises'
import { getToken } from './lib/auth'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = getToken()
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    setIsAuthenticated(!!getToken())
  }, [])

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Login onLogin={() => setIsAuthenticated(true)} />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/exercises" element={<Exercises />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
