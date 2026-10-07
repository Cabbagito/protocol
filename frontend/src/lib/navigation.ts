import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Back buttons go one step up the menu: each page names its parent
 * (Mesocycle → Mesocycles → Settings → Home), so a page's back button always
 * lands in the same place, never on "the previous page".
 *
 * The shell records which path sits at each history index. When the parent
 * is the entry right below the current one, going back pops it, so history
 * doesn't grow; a page reached any other way (a shortcut, a tab) is replaced
 * by its parent.
 */
const pathsByIndex: string[] = []

/** React Router keeps the history index in `history.state.idx`. */
function historyIndex(): number | null {
  const idx = (window.history.state as { idx?: unknown } | null)?.idx
  return typeof idx === 'number' ? idx : null
}

export function recordLocation(pathname: string): void {
  const idx = historyIndex()
  if (idx === null) return
  pathsByIndex[idx] = pathname
  pathsByIndex.length = idx + 1
}

/** Go up to `parent` (a pathname). */
export function useBack(parent: string): () => void {
  const navigate = useNavigate()
  return useCallback(() => {
    const idx = historyIndex()
    if (idx !== null && idx > 0 && pathsByIndex[idx - 1] === parent) navigate(-1)
    else navigate(parent, { replace: true })
  }, [navigate, parent])
}
