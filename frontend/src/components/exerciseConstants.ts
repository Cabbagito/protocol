import type { EquipmentType } from '../types'

export const MUSCLE_GROUPS = [
  'back', 'biceps', 'front delt', 'rear delt', 'side delt',
  'chest', 'triceps', 'quads', 'hamstrings', 'glutes',
  'calves', 'abs', 'traps', 'forearms',
]

export const MUSCLE_GROUP_ROWS: { label: string; groups: string[] }[] = [
  { label: 'Push', groups: ['chest', 'front delt', 'side delt', 'triceps'] },
  { label: 'Pull', groups: ['back', 'rear delt', 'biceps', 'traps', 'forearms'] },
  { label: 'Legs', groups: ['quads', 'hamstrings', 'glutes', 'calves'] },
  { label: 'Core', groups: ['abs'] },
]

export const EQUIPMENT_TYPES: EquipmentType[] = [
  'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight',
]
