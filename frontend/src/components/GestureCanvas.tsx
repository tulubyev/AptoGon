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

export function GestureCanvas({ onComplete, disabled = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const eventsRef = useRef<TouchEventData[]>([])
  const lastTimeRef = useRef<number>(0)
  const isDrawingRef = useRef(false)
  const [isDone, setIsDone] = useState(false)
  const [pointCount, setPointCount] = useState(0)

  // Resize canvas buffer to match its CSS size (no DPR scaling — avoids coord mismatch)
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

    const onStart = (e: MouseEvent | TouchEvent) => {
      if (disabled || isDone) return
      e.preventDefault()
      isDrawingRef.current = true
      eventsRef.current = []
      lastTimeRef.current = 0
      setPointCount(0)
      syncSize(canvas)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const { cx, cy, nx, ny, pressure } = getXY('touches' in e ? e.touches[0] : e as MouseEvent)
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      record(nx, ny, pressure)
    }

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!isDrawingRef.current || disabled) return
      e.preventDefault()
      const { cx, cy, nx, ny, pressure } = getXY('touches' in e ? e.touches[0] : e as MouseEvent)
      ctx.lineTo(cx, cy)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      record(nx, ny, pressure)
    }

    const onEnd = () => {
      if (!isDrawingRef.current) return
      isDrawingRef.current = false
      if (eventsRef.current.length >= 10) {
        setIsDone(true)
        onComplete(eventsRef.current)
      }
    }

    const record = (nx: number, ny: number, pressure: number) => {
      const now = Date.now()
      const pause = lastTimeRef.current ? now - lastTimeRef.current : 0
      lastTimeRef.current = now
      const start = eventsRef.current[0]?.timestamp_ms || now
      eventsRef.current.push({
        x: Math.max(0, Math.min(1, nx)),
        y: Math.max(0, Math.min(1, ny)),
        pressure,
        timestamp_ms: now - start,
        pause_after_ms: pause,
      })
      setPointCount(eventsRef.current.length)
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
