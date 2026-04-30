'use client'
import { useState } from 'react'
import { GestureCanvas, TouchEventData } from '@/components/GestureCanvas'
import Link from 'next/link'

type Stage = 'draw' | 'analyzing' | 'success' | 'bonding' | 'complete' | 'failed'

interface VerifyResult {
  is_human: boolean
  confidence: number
  passed: boolean
  reasoning: string
  did?: string
  private_key_b64?: string
  expression_proof?: string
  tx_hash?: string
}

export default function VerifyPage() {
  const [stage, setStage] = useState<Stage>('draw')
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [bondCount, setBondCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [sessionId] = useState(() => crypto.randomUUID())

  const handleGesture = async (events: TouchEventData[]) => {
    setStage('analyzing')
    setError(null)
    try {
      const res = await fetch('/api/verify/expression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events, session_id: sessionId }),
      })
      const data: VerifyResult = await res.json()
      setResult(data)
      if (data.passed && data.did) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('aptogon_did', data.did)
          if (data.private_key_b64) localStorage.setItem('aptogon_key', data.private_key_b64)
        }
        setStage('success')
      } else {
        setStage('failed')
      }
    } catch {
      setError('Бэкенд недоступен — запусти: uvicorn main:app --reload --port 8000')
      setStage('draw')
    }
  }

  const simulateBonds = () => {
    setStage('bonding')
    let n = 0
    const iv = setInterval(() => {
      n++; setBondCount(n)
      if (n >= 3) { clearInterval(iv); setTimeout(() => setStage('complete'), 600) }
    }, 1500)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <Link href="/" className="text-slate-500 hover:text-slate-300 text-sm mb-3 block">← APTOGON</Link>
          <h1 className="text-3xl font-black text-white">Верификация человека</h1>
          <div className="flex justify-center gap-2 mt-3">
            {['Gonka AI', 'did:key', 'Aptos'].map((t, i) => (
              <span key={t} className={`text-xs px-3 py-1 rounded-full border font-medium
                ${i===0 ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                : i===1 ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}>{t}</span>
            ))}
          </div>
        </div>

        <div className="bg-[#1a2235] rounded-2xl border border-slate-700/50 p-6">

          {(stage === 'draw' || stage === 'failed') && (
            <>
              <h2 className="font-bold text-white mb-1">Нарисуй произвольный символ</h2>
              <p className="text-slate-400 text-sm mb-4">Gonka AI анализирует <strong className="text-cyan-400">паттерн</strong>, не рисунок</p>
              <GestureCanvas onComplete={handleGesture} />
              {stage === 'failed' && result && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm">
                  <p className="text-red-400 font-medium">✗ {result.reasoning}</p>
                  <p className="text-slate-500 text-xs mt-1">Рисуй медленнее, с паузами</p>
                </div>
              )}
              {error && <p className="mt-3 text-orange-400 text-sm">{error}</p>}
            </>
          )}

          {stage === 'analyzing' && (
            <div className="text-center py-8">
              <div className="w-14 h-14 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <h2 className="font-bold text-white mb-2">Gonka AI анализирует...</h2>
              <div className="text-xs text-slate-500 space-y-1">
                <div>→ velocity variance</div><div>→ pause entropy</div><div>→ corrections</div>
              </div>
            </div>
          )}

          {stage === 'success' && result && (
            <>
              <div className="text-center mb-5">
                <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-green-500">
                  <span className="text-2xl">🧠</span>
                </div>
                <h2 className="text-lg font-black text-green-400">Gonka: ты человек</h2>
                <p className="text-slate-400 text-sm">{(result.confidence * 100).toFixed(0)}% уверенность</p>
              </div>
              <div className="bg-[#0d1525] rounded-xl p-4 border border-cyan-500/20 mb-4">
                <p className="text-xs font-bold text-cyan-400 mb-1">did:key создан <span className="text-slate-600 font-normal">(без Ceramic, без серверов)</span></p>
                <p className="font-mono text-xs text-slate-400 break-all">{result.did?.slice(0, 35)}...</p>
                <p className="text-xs text-slate-600 mt-1">🔒 Сохранён в localStorage</p>
              </div>
              {result.tx_hash && (
                <div className="bg-[#0d1525] rounded-xl p-3 border border-blue-500/20 mb-4">
                  <span className="text-xs text-blue-400 font-bold">Aptos TX: </span>
                  <span className="font-mono text-xs text-slate-500">{result.tx_hash.slice(0, 24)}...</span>
                </div>
              )}
              <div className="border-t border-slate-700 pt-4">
                <h3 className="font-bold text-white mb-2 text-sm">Шаг 2: Поручительство (3 человека)</h3>
                <button onClick={simulateBonds} className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-colors">
                  🤝 Запросить поручительство
                </button>
              </div>
            </>
          )}

          {stage === 'bonding' && (
            <div className="text-center py-4">
              <h2 className="font-bold text-white mb-6">Ожидаем поручителей...</h2>
              <div className="flex justify-center gap-8">
                {[1,2,3].map(i => (
                  <div key={i} className={`flex flex-col items-center gap-2 transition-all duration-500 ${bondCount >= i ? 'opacity-100' : 'opacity-30'}`}>
                    <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center text-2xl
                      ${bondCount >= i ? 'bg-green-500/20 border-green-500' : 'bg-slate-800 border-slate-600'}`}>
                      {bondCount >= i ? '✓' : '?'}
                    </div>
                    <span className="text-xs text-slate-400">{bondCount >= i ? 'Поручился' : '...'}</span>
                  </div>
                ))}
              </div>
              <p className="text-slate-500 text-sm mt-6">{bondCount}/3</p>
            </div>
          )}

          {stage === 'complete' && (
            <div className="text-center py-2">
              <div className="pulse-human w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-blue-500">
                <span className="text-4xl">🔑</span>
              </div>
              <h2 className="text-2xl font-black text-white mb-2">Верифицирован в APTOGON</h2>
              <div className="flex justify-center gap-3 text-xs mb-6">
                <span className="text-green-400">✓ Gonka AI</span>
                <span className="text-cyan-400">✓ did:key</span>
                <span className="text-blue-400">✓ Aptos</span>
              </div>
              <div className="flex gap-3">
                <Link href="/chat" className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors text-center">💬 Чат</Link>
                <Link href="/bond" className="flex-1 py-3 bg-[#0d1525] text-cyan-400 font-bold rounded-lg border border-cyan-500/30 hover:border-cyan-500/60 transition-colors text-center">🤝 Поручиться</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
