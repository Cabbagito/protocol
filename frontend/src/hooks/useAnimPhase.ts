import { useRef, useState, useCallback } from 'react'

export function useAnimPhase() {
  const animPhaseRef = useRef<Map<string, 'saving' | 'success'>>(new Map())
  const [, setAnimTick] = useState(0)
  const bumpAnim = useCallback(() => setAnimTick(n => n + 1), [])
  const setAnimKey = useCallback((exerciseId: string, setNum: number) => `${exerciseId}:${setNum}`, [])
  const clearAnim = useCallback((exerciseId: string, setNum: number) => {
    animPhaseRef.current.delete(`${exerciseId}:${setNum}`)
    bumpAnim()
  }, [bumpAnim])

  return { animPhaseRef, bumpAnim, setAnimKey, clearAnim }
}
