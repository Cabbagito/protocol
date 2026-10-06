import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense, Component, type ReactNode } from 'react'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import Layout from './components/Layout'
import PageLoader from './components/PageLoader'
import SplashScreen from './components/SplashScreen'
import { getToken } from './lib/auth'
import { persistOptions, queryClient } from './lib/queryClient'
import { workoutSync } from './lib/workoutSync'

// Clear all service worker caches and unregister SWs so a reload fetches fresh assets
async function clearServiceWorkerCaches() {
  const keys = await caches.keys()
  await Promise.all(keys.map((key) => caches.delete(key)))
  const registrations = await navigator.serviceWorker?.getRegistrations()
  if (registrations) {
    await Promise.all(registrations.map((r) => r.unregister()))
  }
}

// Wrap React.lazy to recover from chunk load errors after a deploy (the
// page references chunks the server no longer has): reload once with fresh
// assets. Offline, a failed chunk is not a stale deploy — keep the caches.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyWithRetry(importFn: () => Promise<{ default: React.ComponentType<any> }>) {
  return lazy(() =>
    importFn()
      .then((mod) => {
        sessionStorage.removeItem('chunk_reload')
        return mod
      })
      .catch(async (err) => {
        if (!navigator.onLine || sessionStorage.getItem('chunk_reload')) throw err
        sessionStorage.setItem('chunk_reload', '1')
        await clearServiceWorkerCaches()
        window.location.reload()
        return new Promise<never>(() => {}) // page is reloading
      })
  )
}

const Login = lazyWithRetry(() => import('./pages/Login'))
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'))
const Diet = lazyWithRetry(() => import('./pages/Diet'))
const Exercises = lazyWithRetry(() => import('./pages/Exercises'))
const Splits = lazyWithRetry(() => import('./pages/Splits'))
const SplitEditor = lazyWithRetry(() => import('./pages/SplitEditor'))
const Mesocycles = lazyWithRetry(() => import('./pages/Mesocycles'))
const MesocycleDetail = lazyWithRetry(() => import('./pages/MesocycleDetail'))
const WorkoutHub = lazyWithRetry(() => import('./pages/WorkoutHub'))
const Workout = lazyWithRetry(() => import('./pages/Workout'))
const WorkoutDetail = lazyWithRetry(() => import('./pages/WorkoutDetail'))
const Progress = lazyWithRetry(() => import('./pages/Progress'))
const Settings = lazyWithRetry(() => import('./pages/Settings'))

// Error boundary for chunk load failures and unexpected runtime errors
class ChunkErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-[var(--text-2)] mb-4">Something went wrong.</p>
            <button
              onClick={() => clearServiceWorkerCaches().then(() => window.location.reload())}
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

// Push any workout changes saved on this phone but not yet on the server.
workoutSync.start()


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
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <ChunkErrorBoundary>
      <Suspense fallback={<PageLoader className="min-h-[60vh]" />}>
        <Routes>
          <Route path="/login" element={<Login onLogin={() => setIsAuthenticated(true)} />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <SplashScreen>
                  <Layout>
                    <Suspense fallback={<PageLoader className="min-h-[60vh]" />}>
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/diet" element={<Diet />} />
                        <Route path="/exercises" element={<Exercises />} />
                        <Route path="/splits" element={<Splits />} />
                        <Route path="/splits/new" element={<SplitEditor />} />
                        <Route path="/splits/:id" element={<SplitEditor />} />
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
                </SplashScreen>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
      </ChunkErrorBoundary>
    </PersistQueryClientProvider>
  )
}
