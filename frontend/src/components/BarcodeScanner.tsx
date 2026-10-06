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
    body: 'Allow camera access for Protocol in your device settings, or type the barcode below.',
  },
  'no-camera': {
    title: 'No camera found',
    body: 'This device has no usable camera. Type the barcode below.',
  },
  unavailable: {
    title: 'Camera unavailable',
    body: 'The camera could not be started (it may be in use by another app). Type the barcode below.',
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

export default function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [camera, setCamera] = useState<CameraState>('starting')
  const [manualCode, setManualCode] = useState('')
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

  const manualValid = BARCODE_PATTERN.test(manualCode)
  const failure = camera === 'starting' || camera === 'live' ? null : CAMERA_MESSAGES[camera]

  // No camera: put the cursor straight into the manual field.
  const manualInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (failure) manualInputRef.current?.focus()
  }, [failure])

  function submitManual(e: React.FormEvent) {
    e.preventDefault()
    if (manualValid) onDetectedRef.current(manualCode)
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan barcode"
      className="fixed inset-0 z-[103] flex flex-col"
      style={{ background: '#000', color: 'white' }}
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

      {/* Header */}
      <div
        className="relative z-10 flex items-center justify-between px-5 pb-3"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 14px)',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.7), transparent)',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontFamily: MONO,
          }}
        >
          Scan barcode
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close scanner"
          className="w-10 h-10 flex items-center justify-center rounded-full"
          style={{ background: 'rgba(255,255,255,0.14)', color: 'white' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Scan window / status */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8">
        {failure ? (
          <div className="max-w-xs text-center" role="alert">
            <div className="text-[15px] font-semibold">{failure.title}</div>
            <div className="text-[13px] mt-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {failure.body}
            </div>
          </div>
        ) : (
          <>
            <div className="relative w-[80%] max-w-[300px]" style={{ aspectRatio: '3 / 2' }}>
              {/* Dim everything outside the window */}
              <div
                className="absolute inset-0 rounded-2xl"
                style={{ boxShadow: '0 0 0 100vmax rgba(0,0,0,0.55)' }}
              />
              <ScanCorners />
              {camera === 'starting' && (
                <div
                  className="absolute inset-0 flex items-center justify-center text-[12px]"
                  style={{ color: 'rgba(255,255,255,0.6)', fontFamily: MONO, letterSpacing: '0.12em' }}
                >
                  STARTING CAMERA…
                </div>
              )}
            </div>
            <div
              className="mt-5 text-[12px] text-center"
              style={{ color: 'rgba(255,255,255,0.8)' }}
            >
              Line up the barcode inside the frame
            </div>
          </>
        )}
      </div>

      {/* Manual entry — always available */}
      <form
        onSubmit={submitManual}
        className="relative z-10 px-5 pt-4"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 18px)',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 60%, transparent)',
        }}
      >
        <label
          htmlFor="manual-barcode"
          className="block mb-2"
          style={{
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontFamily: MONO,
            color: 'rgba(255,255,255,0.6)',
          }}
        >
          Or type the barcode
        </label>
        <div className="flex gap-2">
          <input
            ref={manualInputRef}
            id="manual-barcode"
            type="text"
            inputMode="numeric"
            pattern="\d*"
            autoComplete="off"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ''))}
            placeholder="8–14 digits"
            className="flex-1 min-w-0 rounded-xl px-3 text-center"
            style={{
              height: 46,
              fontFamily: MONO,
              fontSize: 16,
              color: 'white',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.18)',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={!manualValid}
            className="btn-primary rounded-xl px-4 disabled:opacity-40"
            style={{ height: 46, fontSize: 13 }}
          >
            Look up
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

function ScanCorners() {
  const corner = 'absolute w-7 h-7'
  const line = '3px solid rgba(255,255,255,0.95)'
  return (
    <>
      <span className={`${corner} top-0 left-0 rounded-tl-2xl`} style={{ borderTop: line, borderLeft: line }} />
      <span className={`${corner} top-0 right-0 rounded-tr-2xl`} style={{ borderTop: line, borderRight: line }} />
      <span className={`${corner} bottom-0 left-0 rounded-bl-2xl`} style={{ borderBottom: line, borderLeft: line }} />
      <span className={`${corner} bottom-0 right-0 rounded-br-2xl`} style={{ borderBottom: line, borderRight: line }} />
    </>
  )
}
