import { useEffect, useState } from 'react'

/** Returns true when the mobile virtual keyboard is open. */
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const THRESHOLD = 150 // px: keyboard is typically 200-400px tall
    const check = () => {
      const keyboardOpen = window.innerHeight - vv.height > THRESHOLD
      setVisible(keyboardOpen)
    }

    vv.addEventListener('resize', check)
    return () => vv.removeEventListener('resize', check)
  }, [])

  return visible
}
