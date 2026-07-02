import { useEffect, useRef, useState } from 'react'
import { BarcodeDetector, prepareZXingModule } from 'barcode-detector/ponyfill'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

// Self-host the ZXing wasm so the scanner works offline and never hits a CDN.
prepareZXingModule({
  overrides: {
    locateFile: (path: string) => (path.endsWith('.wasm') ? wasmUrl : path),
  },
})

const BARCODE_PATTERN = /^\d{8,14}$/
const DETECT_INTERVAL_MS = 150

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [manualCode, setManualCode] = useState('')

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
      stream?.getTracks().forEach((track) => track.stop())
    }

    async function tick() {
      if (cancelled || !video) return
      if (video.readyState >= 2) {
        try {
          const barcodes = await detector.detect(video)
          const value = barcodes.find((b) => BARCODE_PATTERN.test(b.rawValue))?.rawValue
          if (value && value === lastValue) {
            stop()
            navigator.vibrate?.(80)
            onDetected(value)
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
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
        })
      } catch {
        if (!cancelled) setError('Camera unavailable. Enter the barcode manually.')
        return
      }
      if (cancelled || !video) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      video.srcObject = stream
      try {
        await video.play()
      } catch {
        // autoplay interruption (e.g. unmount mid-play) — cleanup handles it
      }
      tick()
    }

    start()
    return () => {
      cancelled = true
      stop()
    }
  }, [onDetected])

  const manualValid = BARCODE_PATTERN.test(manualCode)

  return (
    <div className="fixed inset-0 z-[103] flex flex-col" style={{ background: 'rgba(0,0,0,0.92)' }}>
      <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
        <div className="text-sm font-semibold text-white">Scan barcode</div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-full"
          style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        {error ? (
          <div className="px-8 w-full max-w-sm space-y-3 text-center">
            <div className="text-sm text-white/80">{error}</div>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d*"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ''))}
              placeholder="Barcode digits"
              className="input mono text-center"
              autoFocus
            />
            <button
              onClick={() => manualValid && onDetected(manualCode)}
              disabled={!manualValid}
              className="btn btn-primary w-full disabled:opacity-50"
            >
              Look up
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Scan window: dimmed surround with a clear center band */}
            <div className="relative z-10 w-[78%] max-w-xs" style={{ aspectRatio: '3 / 2' }}>
              <div
                className="absolute inset-0 rounded-xl"
                style={{
                  border: '2px solid rgba(255,255,255,0.9)',
                  boxShadow: '0 0 0 100vmax rgba(0,0,0,0.55)',
                }}
              />
            </div>
            <div
              className="absolute z-10 text-[11px] uppercase tracking-wider text-white/70"
              style={{ bottom: 'calc(env(safe-area-inset-bottom) + 32px)' }}
            >
              Point at the barcode
            </div>
          </>
        )}
      </div>
    </div>
  )
}
