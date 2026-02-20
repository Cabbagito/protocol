import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense, Component, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/Layout'
import PageLoader from './components/PageLoader'
import SplashScreen from './components/SplashScreen'
import { getToken } from './lib/auth'

// Wrap React.lazy to auto-reload on chunk load errors (stale deploys)
function lazyWithRetry(importFn: () => Promise<{ default: React.ComponentType<any> }>) {
  return lazy(() =>
    importFn().catch(() => {
      const hasReloaded = sessionStorage.getItem('chunk_reload')
      if (!hasReloaded) {
        sessionStorage.setItem('chunk_reload', '1')
        window.location.reload()
        return new Promise(() => {}) // never resolves — page is reloading
      }
      sessionStorage.removeItem('chunk_reload')
      return Promise.reject(new Error('Failed to load page after reload'))
    })
  )
}

// Clear reload flag on successful page loads
sessionStorage.removeItem('chunk_reload')

const Login = lazyWithRetry(() => import('./pages/Login'))
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'))
const Exercises = lazyWithRetry(() => import('./pages/Exercises'))
const Splits = lazyWithRetry(() => import('./pages/Splits'))
const SplitDetail = lazyWithRetry(() => import('./pages/SplitDetail'))
const Mesocycles = lazyWithRetry(() => import('./pages/Mesocycles'))
const MesocycleDetail = lazyWithRetry(() => import('./pages/MesocycleDetail'))
const WorkoutHub = lazyWithRetry(() => import('./pages/WorkoutHub'))
const Workout = lazyWithRetry(() => import('./pages/Workout'))
const WorkoutDetail = lazyWithRetry(() => import('./pages/WorkoutDetail'))
const Progress = lazyWithRetry(() => import('./pages/Progress'))
const Settings = lazyWithRetry(() => import('./pages/Settings'))

// Error boundary for chunk load failures that persist after reload
class ChunkErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-slate-300 mb-4">A new version is available.</p>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary"
            >
              Reload app
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

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
    return <PageLoader className="min-h-screen" />
  }

  return (
    <SplashScreen>
    <QueryClientProvider client={queryClient}>
      <ChunkErrorBoundary>
      <Suspense fallback={<PageLoader className="min-h-[60vh]" />}>
        <Routes>
          <Route path="/login" element={<Login onLogin={() => setIsAuthenticated(true)} />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Suspense fallback={<PageLoader className="min-h-[60vh]" />}>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/exercises" element={<Exercises />} />
                      <Route path="/splits" element={<Splits />} />
                      <Route path="/splits/:id" element={<SplitDetail />} />
                      <Route path="/mesocycles" element={<Mesocycles />} />
                      <Route path="/mesocycles/:id" element={<MesocycleDetail />} />
                      <Route path="/workout" element={<WorkoutHub />} />
                      <Route path="/workout/:mesocycleId" element={<Workout />} />
                      <Route path="/workouts/:mesocycleId/:weekIndex/:sessionIndex" element={<WorkoutDetail />} />
                      <Route path="/progress" element={<Progress />} />
                      <Route path="/settings" element={<Settings />} />
                    </Routes>
                  </Suspense>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
      </ChunkErrorBoundary>
    </QueryClientProvider>
    </SplashScreen>
  )
}
