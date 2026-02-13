import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type {
  Exercise,
  Split,
  SplitListItem,
  Mesocycle,
  MesocycleListItem,
  WorkoutListItem,
  WorkoutLog,
  WorkoutTemplate,
} from '../types'

// --- Query Keys ---

export const queryKeys = {
  exercises: {
    all: ['exercises'] as const,
  },
  splits: {
    all: ['splits'] as const,
    detail: (id: string) => ['splits', id] as const,
  },
  mesocycles: {
    all: ['mesocycles'] as const,
    active: ['mesocycles', 'active'] as const,
    detail: (id: string) => ['mesocycles', id] as const,
  },
  workouts: {
    all: ['workouts'] as const,
    list: (params: { mesocycleId?: string; limit?: number }) =>
      ['workouts', 'list', params] as const,
    detail: (id: string) => ['workouts', id] as const,
    template: (mesocycleId: string, sessionId: string) =>
      ['workouts', 'template', mesocycleId, sessionId] as const,
    progress: (exerciseId: string) => ['workouts', 'progress', exerciseId] as const,
  },
}

// --- Exercise Hooks ---

export function useExercises() {
  return useQuery({
    queryKey: queryKeys.exercises.all,
    queryFn: () => api.get<Exercise[]>('/exercises'),
  })
}

export function useCreateExercise() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; muscle_groups: string[]; equipment_type: string }) =>
      api.post('/exercises', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exercises.all })
    },
  })
}

// --- Split Hooks ---

export function useSplits() {
  return useQuery({
    queryKey: queryKeys.splits.all,
    queryFn: () => api.get<SplitListItem[]>('/splits'),
  })
}

export function useSplit(id: string) {
  return useQuery({
    queryKey: queryKeys.splits.detail(id),
    queryFn: () => api.get<Split>(`/splits/${id}`),
    enabled: !!id,
  })
}

export function useCreateSplit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string }) => api.post('/splits', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.splits.all })
    },
  })
}

export function useUpdateSplit(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string }) => api.put(`/splits/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.splits.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.splits.all })
    },
  })
}

export function useDeleteSplit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/splits/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.splits.all })
    },
  })
}

// Session mutations
export function useAddSession(splitId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => api.post(`/splits/${splitId}/sessions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.splits.detail(splitId) })
    },
  })
}

export function useUpdateSession(splitId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: string; data: unknown }) =>
      api.put(`/splits/${splitId}/sessions/${sessionId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.splits.detail(splitId) })
    },
  })
}

export function useDeleteSession(splitId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) =>
      api.delete(`/splits/${splitId}/sessions/${sessionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.splits.detail(splitId) })
    },
  })
}

export function useReorderSessions(splitId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionIds: string[]) =>
      api.put(`/splits/${splitId}/sessions/reorder`, { session_ids: sessionIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.splits.detail(splitId) })
    },
  })
}

// --- Mesocycle Hooks ---

export function useMesocycles() {
  return useQuery({
    queryKey: queryKeys.mesocycles.all,
    queryFn: () => api.get<MesocycleListItem[]>('/mesocycles'),
  })
}

export function useActiveMesocycle() {
  return useQuery({
    queryKey: queryKeys.mesocycles.active,
    queryFn: () => api.get<Mesocycle | null>('/mesocycles/active'),
  })
}

export function useMesocycle(id: string) {
  return useQuery({
    queryKey: queryKeys.mesocycles.detail(id),
    queryFn: () => api.get<Mesocycle>(`/mesocycles/${id}`),
    enabled: !!id,
  })
}

export function useCreateMesocycle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; split_id: string; total_weeks: number }) =>
      api.post('/mesocycles', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.active })
    },
  })
}

export function useUpdateMesocycle(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name?: string; current_week?: number; is_active?: boolean }) =>
      api.put<Mesocycle>(`/mesocycles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.active })
    },
  })
}

export function useAdvanceWeek(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<Mesocycle>(`/mesocycles/${id}/advance-week`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.active })
    },
  })
}

export function useDeleteMesocycle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/mesocycles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.active })
    },
  })
}

// --- Workout Hooks ---

export function useWorkouts(params: { mesocycleId?: string; limit?: number } = {}) {
  const searchParams = new URLSearchParams()
  if (params.mesocycleId) searchParams.set('mesocycle_id', params.mesocycleId)
  if (params.limit) searchParams.set('limit', String(params.limit))
  const query = searchParams.toString()
  const endpoint = `/workouts${query ? `?${query}` : ''}`

  return useQuery({
    queryKey: queryKeys.workouts.list(params),
    queryFn: () => api.get<WorkoutListItem[]>(endpoint),
    enabled: params.mesocycleId !== undefined ? !!params.mesocycleId : true,
  })
}

export function useWorkout(id: string) {
  return useQuery({
    queryKey: queryKeys.workouts.detail(id),
    queryFn: () => api.get<WorkoutLog>(`/workouts/${id}`),
    enabled: !!id,
  })
}

export function useWorkoutTemplate(mesocycleId: string, sessionId: string) {
  return useQuery({
    queryKey: queryKeys.workouts.template(mesocycleId, sessionId),
    queryFn: () =>
      api.get<WorkoutTemplate>(`/workouts/template/${mesocycleId}/${sessionId}`),
    enabled: !!mesocycleId && !!sessionId,
  })
}

export function useExerciseProgress(exerciseId: string) {
  return useQuery({
    queryKey: queryKeys.workouts.progress(exerciseId),
    queryFn: () =>
      api.get<
        {
          date: string
          week_number: number
          max_weight: number
          total_reps: number
          total_sets: number
          volume: number
        }[]
      >(`/workouts/progress/${exerciseId}`),
    enabled: !!exerciseId,
  })
}

export function useCreateWorkout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      mesocycle_id: string
      session_id: string
      notes?: string | null
      sets: unknown[]
    }) => api.post('/workouts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.active })
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })
    },
  })
}

export function useDeleteWorkout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workouts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.active })
    },
  })
}
