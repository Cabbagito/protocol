import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Exercises from './pages/Exercises'
import Splits from './pages/Splits'
import SplitDetail from './pages/SplitDetail'
import Mesocycles from './pages/Mesocycles'
import MesocycleDetail from './pages/MesocycleDetail'
import Workout from './pages/Workout'
import WorkoutDetail from './pages/WorkoutDetail'
import Progress from './pages/Progress'
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
                <Route path="/splits" element={<Splits />} />
                <Route path="/splits/:id" element={<SplitDetail />} />
                <Route path="/mesocycles" element={<Mesocycles />} />
                <Route path="/mesocycles/:id" element={<MesocycleDetail />} />
                <Route path="/workout/:mesocycleId/:sessionId" element={<Workout />} />
                <Route path="/workouts/:id" element={<WorkoutDetail />} />
                <Route path="/progress" element={<Progress />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
