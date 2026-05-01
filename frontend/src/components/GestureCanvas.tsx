'use client'
import { useRef, useEffect, useState } from 'react'

export interface TouchEventData {
  x: number           // normalized 0-1
  y: number           // normalized 0-1
  pressure: number
  timestamp_ms: number
  pause_after_ms: number
}

interface Props {
  onComplete: (events: TouchEventData[]) => void
  disabled?: boolean
}

// Record a point at most every THROTTLE_MS ms (avoids 60fps flood with identical intervals)
const THROTTLE_MS = 45
// Minimum normalized distance to bother recording a new point
const MIN_DIST = 0.004
// How often to check for pauses during drawing (ms)
const PAUSE_POLL_MS = 120

export function GestureCanvas({ onComplete, disabled = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const eventsRef = useRef<TouchEventData[]>([])
  const gestureStartRef = useRef<number>(0)   // wall clock of gesture start
  const lastRecordedRef = useRef<number>(0)   // wall clock of last recorded point
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)
  const isDrawingRef = useRef(false)
  const pauseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [isDone, setIsDone] = useState(false)
  const [pointCount, setPointCount] = useState(0)

  const syncSize = (canvas: HTMLCanvasElement) => {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    syncSize(canvas)
    ctx.strokeStyle = '#1d4ed8'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const getXY = (e: MouseEvent | Touch) => {
      syncSize(canvas)
      const rect = canvas.getBoundingClientRect()
      return {
        cx: e.clientX - rect.left,
        cy: e.clientY - rect.top,
        nx: (e.clientX - rect.left) / rect.width,
        ny: (e.clientY - rect.top) / rect.height,
        pressure: 'force' in e ? (e as Touch).force || 0.5 : 0.5,
      }
    }

    // ── Push a recorded point ───────────────────────────────────────────────
    const pushPoint = (x: number, y: number, pressure: number) => {
      const now = Date.now()
      const ts = now - gestureStartRef.current
      const pause = lastRecordedRef.current ? now - lastRecordedRef.current : 0
      lastRecordedRef.current = now
      lastPosRef.current = { x, y }
      eventsRef.current.push({ x, y, pressure, timestamp_ms: ts, pause_after_ms: pause })
      setPointCount(eventsRef.current.length)
    }

    // ── Pause detector: fires every PAUSE_POLL_MS while drawing ────────────
    const startPauseTimer = () => {
      if (pauseTimerRef.current) clearInterval(pauseTimerRef.current)
      pauseTimerRef.current = setInterval(() => {
        if (!isDrawingRef.current) return
        const now = Date.now()
        const silence = now - lastRecordedRef.current
        // If user has been still for >= PAUSE_POLL_MS, record a pause stamp
        if (silence >= PAUSE_POLL_MS && lastPosRef.current) {
          const { x, y } = lastPosRef.current
          const ts = now - gestureStartRef.current
          // Don't update lastRecordedRef — so next real move will show accumulated pause
          eventsRef.current.push({
            x, y,
            pressure: 0.5,
            timestamp_ms: ts,
            pause_after_ms: silence,
          })
          // Move lastRecordedRef so we don't double-count this pause
          lastRecordedRef.current = now
          setPointCount(eventsRef.current.length)
        }
      }, PAUSE_POLL_MS)
    }

    const stopPauseTimer = () => {
      if (pauseTimerRef.current) {
        clearInterval(pauseTimerRef.current)
        pauseTimerRef.current = null
      }
    }

    // ── Event handlers ──────────────────────────────────────────────────────
    const onStart = (e: MouseEvent | TouchEvent) => {
      if (disabled || isDone) return
      e.preventDefault()
      isDrawingRef.current = true
      eventsRef.current = []
      gestureStartRef.current = Date.now()
      lastRecordedRef.current = 0
      lastPosRef.current = null
      setPointCount(0)
      syncSize(canvas)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const ev = 'touches' in e ? e.touches[0] : (e as MouseEvent)
      const { cx, cy, nx, ny, pressure } = getXY(ev)
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      pushPoint(Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny)), pressure)
      startPauseTimer()
    }

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!isDrawingRef.current || disabled) return
      e.preventDefault()
      const ev = 'touches' in e ? e.touches[0] : (e as MouseEvent)
      const { cx, cy, nx, ny, pressure } = getXY(ev)
      ctx.lineTo(cx, cy)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx, cy)

      const x = Math.max(0, Math.min(1, nx))
      const y = Math.max(0, Math.min(1, ny))
      const now = Date.now()
      const dt = now - lastRecordedRef.current
      const last = lastPosRef.current
      const dist = last ? Math.sqrt((x - last.x) ** 2 + (y - last.y) ** 2) : 1

      // Throttle: only record if enough time passed OR moved enough
      if (dt >= THROTTLE_MS || dist >= MIN_DIST * 3) {
        pushPoint(x, y, pressure)
      }
    }

    const onEnd = () => {
      if (!isDrawingRef.current) return
      isDrawingRef.current = false
      stopPauseTimer()
      if (eventsRef.current.length >= 10) {
        setIsDone(true)
        onComplete(eventsRef.current)
      }
    }

    canvas.addEventListener('mousedown', onStart)
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseup', onEnd)
    canvas.addEventListener('mouseleave', onEnd)
    canvas.addEventListener('touchstart', onStart, { passive: false })
    canvas.addEventListener('touchmove', onMove, { passive: false })
    canvas.addEventListener('touchend', onEnd)

    return () => {
      canvas.removeEventListener('mousedown', onStart)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseup', onEnd)
      canvas.removeEventListener('mouseleave', onEnd)
      canvas.removeEventListener('touchstart', onStart)
      canvas.removeEventListener('touchmove', onMove)
      canvas.removeEventListener('touchend', onEnd)
      stopPauseTimer()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, isDone, onComplete])

  const reset = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    eventsRef.current = []
    setPointCount(0)
    setIsDone(false)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        className={[
          'gesture-canvas w-full rounded-xl',
          'border-2 transition-colors',
          disabled       ? 'opacity-50 cursor-not-allowed border-slate-300 bg-slate-100' :
          isDone         ? 'border-green-500 bg-white' :
                           'border-blue-400 bg-white hover:border-blue-600',
        ].join(' ')}
        style={{ height: 260, display: 'block' }}
      />

      <div className="w-full flex items-center justify-between text-sm">
        <span className="text-slate-500">
          {isDone
            ? `✓ ${pointCount} точек — готово`
            : pointCount > 0
              ? `${pointCount} точек...`
              : disabled ? '' : '✏️  рисуй здесь мышью или пальцем'}
        </span>
        <button
          onClick={reset}
          disabled={disabled}
          className="text-slate-500 hover:text-slate-300 underline text-xs disabled:opacity-30"
        >
          очистить
        </button>
      </div>
    </div>
  )
}
