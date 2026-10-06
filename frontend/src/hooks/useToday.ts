import { useEffect, useState } from 'react'
import { todayIso } from '../lib/dates'

/**
 * Today's local date key (YYYY-MM-DD), kept current while the app stays
 * open: re-checked whenever the PWA comes back to the foreground (iOS can
 * keep it suspended overnight) and at local midnight.
 */
export function useToday(): string {
  const [today, setToday] = useState(todayIso)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined

    function scheduleMidnight() {
      clearTimeout(timer)
      const now = new Date()
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1)
      timer = setTimeout(refresh, next.getTime() - now.getTime())
    }

    function refresh() {
      if (document.visibilityState === 'hidden') return
      setToday(todayIso())
      scheduleMidnight()
    }

    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    scheduleMidnight()
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
    }
  }, [])

  return today
}
