import { useEffect, useState } from 'react'
import { fullScreenHeight } from './viewport'

/** Returns true when the mobile virtual keyboard is open. */
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const THRESHOLD = 150 // px: keyboard is typically 200-400px tall
    // Compare against the full screen height rather than innerHeight: an
    // installed iPhone app may shrink innerHeight with the keyboard too.
    const check = () => setVisible(fullScreenHeight() - vv.height > THRESHOLD)

    vv.addEventListener('resize', check)
    return () => vv.removeEventListener('resize', check)
  }, [])

  return visible
}
