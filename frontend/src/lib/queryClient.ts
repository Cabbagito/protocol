import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client'

const DAY = 1000 * 60 * 60 * 24

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      // Must outlive the persisted cache, or restored entries are dropped.
      gcTime: 7 * DAY,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

const CACHE_KEY = 'protocol_query_cache'

// Workout data is persisted so the app opens with the last-known state
// even with no signal (deep inside the gym).
const PERSISTED_ROOTS = new Set(['mesocycles', 'exercises', 'workouts', 'weight-logs', 'daily-targets'])

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: createSyncStoragePersister({
    storage: window.localStorage,
    key: CACHE_KEY,
    throttleTime: 1000,
  }),
  maxAge: 7 * DAY,
  // Bump when cached response shapes change incompatibly.
  buster: 'v2',
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      query.state.status === 'success' && PERSISTED_ROOTS.has(String(query.queryKey[0])),
  },
}

/** Drop every cached server response, in memory and on disk. */
export function resetLocalData(): void {
  queryClient.clear()
  try {
    window.localStorage.removeItem(CACHE_KEY)
  } catch {
    // storage unavailable — nothing persisted either
  }
}
