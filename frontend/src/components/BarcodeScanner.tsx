import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BarcodeDetector, prepareZXingModule } from 'barcode-detector/ponyfill'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import { useScrollLock } from '../hooks/useScrollLock'

// Self-host the ZXing wasm so the scanner works offline and never hits a CDN.
prepareZXingModule({
  overrides: {
    locateFile: (path: string) => (path.endsWith('.wasm') ? wasmUrl : path),
  },
})

const BARCODE_PATTERN = /^\d{8,14}$/
const DETECT_INTERVAL_MS = 150
const MONO = 'JetBrains Mono, ui-monospace, monospace'

type CameraState = 'starting' | 'live' | 'denied' | 'no-camera' | 'unavailable'

const CAMERA_MESSAGES: Record<Exclude<CameraState, 'starting' | 'live'>, { title: string; body: string }> = {
  denied: {
    title: 'Camera access is blocked',
    body: 'Allow camera access for Protocol in your device settings, or add the product from photos of the pack.',
  },
  'no-camera': {
    title: 'No camera found',
    body: 'This device has no usable camera.',
  },
  unavailable: {
    title: 'Camera unavailable',
    body: 'The camera could not be started; it may be in use by another app.',
  },
}

function classifyCameraError(err: unknown): CameraState {
  const name = err instanceof DOMException || err instanceof Error ? err.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
    return 'denied'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') {
    return 'no-camera'
  }
  return 'unavailable'
}

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void
  onClose: () => void
}

/** The camera, a frame and an exit: point it at a barcode. */
export default function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [camera, setCamera] = useState<CameraState>('starting')
  useScrollLock(true)

  // Parents pass inline callbacks; keep the camera effect independent of
  // their identity so re-renders never restart the stream.
  const onDetectedRef = useRef(onDetected)
  useEffect(() => {
    onDetectedRef.current = onDetected
  }, [onDetected])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let cancelled = false
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    // Require the same value twice in a row to guard against misreads.
    let lastValue: string | null = null

    const detector = new BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'],
    })

    function stop() {
      if (timer) clearTimeout(timer)
      timer = null
      stream?.getTracks().forEach((track) => track.stop())
      stream = null
      if (video) video.srcObject = null
    }

    async function tick() {
      if (cancelled || !video) return
      if (video.readyState >= 2) {
        try {
          const barcodes = await detector.detect(video)
          if (cancelled) return
          const value = barcodes.find((b) => BARCODE_PATTERN.test(b.rawValue))?.rawValue
          if (value && value === lastValue) {
            stop()
            navigator.vibrate?.(80)
            onDetectedRef.current(value)
            return
          }
          lastValue = value ?? null
        } catch {
          // detect() can throw transiently while the stream settles; keep polling
        }
      }
      timer = setTimeout(tick, DETECT_INTERVAL_MS)
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera('unavailable')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
        })
      } catch (err) {
        if (!cancelled) setCamera(classifyCameraError(err))
        return
      }
      if (cancelled || !video) {
        stop()
        return
      }
      video.srcObject = stream
      try {
        await video.play()
      } catch {
        // autoplay interruption (e.g. unmount mid-play) — cleanup handles it
      }
      if (cancelled) return
      setCamera('live')
      tick()
    }

    start()
    return () => {
      cancelled = true
      stop()
    }
  }, [])

  const failure = camera === 'starting' || camera === 'live' ? null : CAMERA_MESSAGES[camera]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan a barcode"
      className="fixed inset-0 z-[103]"
      style={{
        background: 'radial-gradient(ellipse at 50% 42%, #2a3140 0%, #12161d 55%, #05070a 100%)',
        color: '#e2e8f0',
      }}
    >
      {/* Camera feed fills the screen behind everything */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: camera === 'live' ? 1 : 0, transition: 'opacity 0.2s' }}
      />

      <button
        type="button"
        onClick={onClose}
        aria-label="Close the scanner"
        className="absolute z-10 grid place-items-center"
        style={{
          top: 'calc(env(safe-area-inset-top) + 12px)',
          left: 20,
          width: 40,
          height: 40,
          borderRadius: 13,
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.14)',
          color: '#e2e8f0',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <div className="absolute inset-0 flex flex-col items-center justify-center px-8">
        {failure ? (
          <div className="max-w-xs text-center" role="alert">
            <div className="text-[15px] font-semibold">{failure.title}</div>
            <div className="text-[13px] mt-2" style={{ color: 'rgba(226,232,240,0.75)' }}>
              {failure.body}
            </div>
          </div>
        ) : (
          <>
            <div className="relative" style={{ width: 290, maxWidth: '80%', height: 170 }}>
              {/* Dim everything outside the window */}
              <div
                className="absolute inset-0"
                style={{ borderRadius: 22, boxShadow: '0 0 0 100vmax rgba(0,0,0,0.45)' }}
              />
              <ScanCorners />
              <div
                className="absolute"
                style={{
                  left: 24,
                  right: 24,
                  top: '50%',
                  height: 2,
                  background: '#38bdf8',
                  boxShadow: '0 0 12px rgba(56,189,248,0.9)',
                }}
              />
            </div>
            <div
              className="mt-7 text-center"
              style={{
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: '0.2em',
                color: 'rgba(226,232,240,0.85)',
              }}
            >
              {camera === 'starting' ? 'STARTING CAMERA…' : 'POINT AT A BARCODE'}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

function ScanCorners() {
  const corner = 'absolute w-[34px] h-[34px]'
  const line = '3px solid #fff'
  return (
    <>
      <span className={`${corner} top-0 left-0`} style={{ borderTop: line, borderLeft: line, borderTopLeftRadius: 22 }} />
      <span className={`${corner} top-0 right-0`} style={{ borderTop: line, borderRight: line, borderTopRightRadius: 22 }} />
      <span className={`${corner} bottom-0 left-0`} style={{ borderBottom: line, borderLeft: line, borderBottomLeftRadius: 22 }} />
      <span className={`${corner} bottom-0 right-0`} style={{ borderBottom: line, borderRight: line, borderBottomRightRadius: 22 }} />
    </>
  )
}
