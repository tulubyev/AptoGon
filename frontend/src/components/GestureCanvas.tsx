'use client'
import { useRef, useEffect, useCallback, useState } from 'react'

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
  const [strokeCount, setStrokeCount] = useState(0)
  const [isDone, setIsDone] = useState(false)

  const getPos = useCallback((e: MouseEvent | Touch, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    return {
      x: (('clientX' in e ? e.clientX : e.clientX) - rect.left) / rect.width,
      y: (('clientY' in e ? e.clientY : e.clientY) - rect.top) / rect.height,
      pressure: 'force' in e ? (e as Touch).force || 0.5 : 0.5,
    }
  }, [])

  const recordPoint = useCallback((x: number, y: number, pressure: number) => {
    const now = Date.now()
    const pauseAfter = lastTimeRef.current ? now - lastTimeRef.current : 0
    lastTimeRef.current = now

    const startTime = eventsRef.current[0]?.timestamp_ms || now
    eventsRef.current.push({
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      pressure,
      timestamp_ms: now - startTime,
      pause_after_ms: pauseAfter,
    })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    // Retina display
    const dpr = window.devicePixelRatio || 1
    canvas.width = canvas.offsetWidth * dpr
    canvas.height = canvas.offsetHeight * dpr
    ctx.scale(dpr, dpr)

    // Styles
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const startDraw = (e: MouseEvent | TouchEvent) => {
      if (disabled || isDone) return
      e.preventDefault()
      isDrawingRef.current = true
      eventsRef.current = []
      lastTimeRef.current = 0
      setStrokeCount(c => c + 1)

      const point = 'touches' in e ? e.touches[0] : e
      const pos = getPos(point, canvas)
      ctx.beginPath()
      ctx.moveTo(pos.x * canvas.offsetWidth, pos.y * canvas.offsetHeight)
      recordPoint(pos.x, pos.y, pos.pressure)
    }

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawingRef.current || disabled) return
      e.preventDefault()
      const point = 'touches' in e ? e.touches[0] : e
      const pos = getPos(point, canvas)
      ctx.lineTo(pos.x * canvas.offsetWidth, pos.y * canvas.offsetHeight)
      ctx.stroke()
      recordPoint(pos.x, pos.y, pos.pressure)
    }

    const endDraw = () => {
      if (!isDrawingRef.current) return
      isDrawingRef.current = false
      ctx.closePath()

      if (eventsRef.current.length >= 10) {
        setIsDone(true)
        onComplete(eventsRef.current)
      }
    }

    canvas.addEventListener('mousedown', startDraw)
    canvas.addEventListener('mousemove', draw)
    canvas.addEventListener('mouseup', endDraw)
    canvas.addEventListener('touchstart', startDraw, { passive: false })
    canvas.addEventListener('touchmove', draw, { passive: false })
    canvas.addEventListener('touchend', endDraw)

    return () => {
      canvas.removeEventListener('mousedown', startDraw)
      canvas.removeEventListener('mousemove', draw)
      canvas.removeEventListener('mouseup', endDraw)
      canvas.removeEventListener('touchstart', startDraw)
      canvas.removeEventListener('touchmove', draw)
      canvas.removeEventListener('touchend', endDraw)
    }
  }, [disabled, isDone, getPos, recordPoint, onComplete])

  const reset = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    eventsRef.current = []
    setStrokeCount(0)
    setIsDone(false)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full">
        <canvas
          ref={canvasRef}
          className={`
            gesture-canvas w-full h-48 rounded-xl border-2 bg-[#0d1525]
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${isDone ? 'border-green-500' : 'border-blue-500/50 hover:border-blue-400'}
          `}
          style={{ display: 'block' }}
        />
        {!isDone && !disabled && strokeCount === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-slate-500 text-sm">
              ✏️ Нарисуй любой символ мышью или пальцем
            </p>
          </div>
        )}
        {isDone && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-green-500/20 border border-green-500/50 rounded-lg px-4 py-2">
              <span className="text-green-400 font-bold">✓ Жест записан — {eventsRef.current.length} точек</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={reset}
          disabled={disabled}
          className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg transition-colors disabled:opacity-50"
        >
          ↺ Очистить
        </button>
        {isDone && (
          <span className="px-4 py-2 text-sm text-green-400 font-medium">
            {eventsRef.current.length} точек · готово к анализу
          </span>
        )}
      </div>
    </div>
  )
}
