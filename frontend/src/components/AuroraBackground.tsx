/**
 * AuroraBackground — four animated blobs + two panning stripe sheets +
 * a film-grain layer, all reading colors from the active theme's
 * --wave-c1..c4 CSS vars. Drops into any page that wants the v5 bg.
 *
 * Honors `data-motion` on <html> (set by lib/motion.ts): aurora / pulse /
 * still / none. CSS lives in src/index.css.
 *
 * Usage: drop as the first child of a position:relative page wrapper.
 */
export default function AuroraBackground() {
  return (
    <div className="wave-bg" aria-hidden="true">
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />
      <div className="blob b4" />
      <div className="aurora" />
      <div className="aurora-2" />
      <div className="grain" />
    </div>
  )
}
