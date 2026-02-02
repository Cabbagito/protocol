// Common types for Protocol

export interface Exercise {
  id: string
  name: string
  muscle_groups: string[]
  equipment_type: EquipmentType
}

export type EquipmentType = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight'

export interface ApiError {
  detail: string
}
