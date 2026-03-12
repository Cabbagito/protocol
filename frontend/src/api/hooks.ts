import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type {
  Exercise,
  Split,
  SplitListItem,
  Mesocycle,
  MesocycleListItem,
  WorkoutTemplate,
  WorkoutHistoryItem,
  WorkoutDetailResponse,
  ProgressEntry,
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
    template: (mesocycleId: string) => ['workouts', 'template', mesocycleId] as const,
    specificTemplate: (mesocycleId: string, weekIndex: number, sessionIndex: number) =>
      ['workouts', 'template', mesocycleId, weekIndex, sessionIndex] as const,
    history: (mesocycleId: string) => ['workouts', 'history', mesocycleId] as const,
    detail: (mesocycleId: string, weekIndex: number, sessionIndex: number) =>
      ['workouts', 'detail', mesocycleId, weekIndex, sessionIndex] as const,
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
    mutationFn: (data: { name: string; muscle_group: string; equipment_type: string }) =>
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
    mutationFn: (data: {
      name: string
      color?: string | null
      days: { name: string; exercises: { exercise_id: string }[] }[]
    }) => api.post('/splits', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.splits.all })
    },
  })
}

export function useUpdateSplit(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      name: string
      color?: string | null
      days: { name: string; exercises: { exercise_id: string }[] }[]
    }) => api.put(`/splits/${id}`, data),
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
    mutationFn: (data: { name?: string; is_active?: boolean }) =>
      api.put<Mesocycle>(`/mesocycles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })
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

export function useWorkoutTemplate(mesocycleId: string) {
  return useQuery({
    queryKey: queryKeys.workouts.template(mesocycleId),
    queryFn: () => api.get<WorkoutTemplate>(`/workouts/template/${mesocycleId}`),
    enabled: !!mesocycleId,
  })
}

export function useSpecificTemplate(mesocycleId: string, weekIndex: number, sessionIndex: number) {
  return useQuery({
    queryKey: queryKeys.workouts.specificTemplate(mesocycleId, weekIndex, sessionIndex),
    queryFn: () =>
      api.get<WorkoutTemplate>(`/workouts/template/${mesocycleId}/${weekIndex}/${sessionIndex}`),
    enabled: !!mesocycleId,
  })
}

export function useWorkoutHistory(mesocycleId: string) {
  return useQuery({
    queryKey: queryKeys.workouts.history(mesocycleId),
    queryFn: () => api.get<WorkoutHistoryItem[]>(`/workouts/history/${mesocycleId}`),
    enabled: !!mesocycleId,
  })
}

export function useWorkoutDetail(mesocycleId: string, weekIndex: number, sessionIndex: number) {
  return useQuery({
    queryKey: queryKeys.workouts.detail(mesocycleId, weekIndex, sessionIndex),
    queryFn: () =>
      api.get<WorkoutDetailResponse>(`/workouts/detail/${mesocycleId}/${weekIndex}/${sessionIndex}`),
    enabled: !!mesocycleId,
  })
}

export function useExerciseProgress(exerciseId: string) {
  return useQuery({
    queryKey: queryKeys.workouts.progress(exerciseId),
    queryFn: () => api.get<ProgressEntry[]>(`/workouts/progress/${exerciseId}`),
    enabled: !!exerciseId,
  })
}

export function useLogSets() {
  return useMutation({
    mutationFn: (data: {
      mesocycle_id: string
      week_index: number
      session_index: number
      sets: { exercise_id: string; set_num: number; weight: number; reps: number; rir?: number | null; set_type?: string | null }[]
      notes?: string | null
      exercise_updates?: { exercise_id: string; skipped?: boolean }[] | null
      complete?: boolean
    }) => api.post('/workouts/log', data),
  })
}

export function useUpdateExerciseNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { mesocycle_id: string; exercise_id: string; note: string | null }) =>
      api.patch('/workouts/exercise-note', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })
    },
  })
}

export function useReplaceExercise() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      mesocycle_id: string
      week_index: number
      session_index: number
      exercise_index: number
      old_exercise_id: string
      new_exercise_id: string
      apply_to_future: boolean
    }) => api.post('/workouts/replace-exercise', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })
    },
  })
}
