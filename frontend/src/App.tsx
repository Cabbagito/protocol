import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/Layout'
import { getToken } from './lib/auth'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Exercises = lazy(() => import('./pages/Exercises'))
const Splits = lazy(() => import('./pages/Splits'))
const SplitDetail = lazy(() => import('./pages/SplitDetail'))
const Mesocycles = lazy(() => import('./pages/Mesocycles'))
const MesocycleDetail = lazy(() => import('./pages/MesocycleDetail'))
const Workout = lazy(() => import('./pages/Workout'))
const WorkoutDetail = lazy(() => import('./pages/WorkoutDetail'))
const Progress = lazy(() => import('./pages/Progress'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // Data is fresh for 2 minutes
      gcTime: 1000 * 60 * 10, // Cache kept for 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function PageLoader() {
  return <div className="text-slate-400 text-center py-8 animate-pulse">Loading...</div>
}

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
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login onLogin={() => setIsAuthenticated(true)} />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Suspense fallback={<PageLoader />}>
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
                  </Suspense>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </QueryClientProvider>
  )
}
