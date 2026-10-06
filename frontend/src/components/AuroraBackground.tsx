/**
 * Static page background: soft theme-colored blobs and aurora stripes,
 * painted as layered gradients on one fixed element (CSS: `.app-bg` in
 * src/index.css). Nothing animates, so it costs nothing after first paint.
 *
 * Usage: drop as the first child of a position:relative page wrapper.
 */
export default function AuroraBackground() {
  return <div className="app-bg" aria-hidden="true" />
}
