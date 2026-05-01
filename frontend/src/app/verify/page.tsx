'use client'
import { useState } from 'react'
import Link from 'next/link'
import { GestureCanvas, TouchEventData } from '@/components/GestureCanvas'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, XCircle, Loader2, Brain, Key, Link2, Shield, ArrowRight, Pencil, Sparkles } from 'lucide-react'

type Stage = 'draw' | 'analyzing' | 'success' | 'failed' | 'bonding' | 'complete'

interface DebugPattern {
  velocity_std: number
  velocity_mean: number
  pause_entropy: number
  correction_count: number
  rhythm_irregularity: number
  total_duration_ms: number
  point_count: number
  possible_motor_difficulty: boolean
}

interface VerifyResult {
  is_human: boolean
  confidence: number
  passed: boolean
  reasoning: string
  via_fallback?: boolean
  anomalies?: string[]
  did?: string
  private_key_b64?: string
  expression_proof?: string
  tx_hash?: string
  debug?: DebugPattern
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
        localStorage.setItem('aptogon_did', data.did)
        if (data.private_key_b64) localStorage.setItem('aptogon_key', data.private_key_b64)
        // Save in HSI browser extension format
        localStorage.setItem('hsi_did', data.did)
        const hsiCred = JSON.stringify({
          ...(data.credential ?? {}),
          issuanceDate: new Date().toISOString(),
          expirationDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
          credentialSubject: {
            ...(data.credential?.credentialSubject ?? {}),
            id: data.did,
            isHuman: true,
            confidence: data.confidence,
            expressionProof: data.expression_proof,
            txHash: data.tx_hash,
          },
        })
        localStorage.setItem('hsi_credential', hsiCred)
        // Fire custom event so content.js can push to extension storage immediately
        window.dispatchEvent(new CustomEvent('hsi:verified', {
          detail: { cred: hsiCred, did: data.did }
        }))
        setStage('success')
      } else {
        setStage('failed')
      }
    } catch {
      setError('Бэкенд недоступен')
      setStage('draw')
    }
  }

  const simulateBonds = () => {
    setStage('bonding')
    let n = 0
    const iv = setInterval(() => {
      n++; setBondCount(n)
      if (n >= 3) { clearInterval(iv); setTimeout(() => setStage('complete'), 800) }
    }, 1400)
  }

  return (
    <div className="min-h-screen bg-white">

      {/* ── HERO ── */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 px-6 py-12 text-white text-center">
        <Link href="/" className="text-blue-300 hover:text-white text-sm mb-6 inline-block">← APTOGON</Link>
        <h1 className="text-4xl md:text-5xl font-black mb-3 leading-tight">
          Подтверди, что ты <span className="text-cyan-400">человек</span>
        </h1>
        <p className="text-blue-200 text-lg max-w-lg mx-auto">
          Без паспорта · Без камеры · Без личных данных
        </p>
      </div>

      {/* ── КАК ЭТО РАБОТАЕТ ── */}
      <div className="px-6 py-10 bg-gray-50">
        <p className="text-center text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Как работает верификация</p>
        <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-3">

          <div className="bg-purple-600 rounded-2xl p-5 text-white">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
              <Pencil className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold uppercase tracking-wide opacity-70 mb-1">Шаг 1</div>
            <div className="font-black text-lg mb-2">Нарисуй символ</div>
            <p className="text-sm opacity-80">Любой — букву, цифру, завиток. AI смотрит <em>как</em> ты рисуешь, не <em>что</em></p>
          </div>

          <div className="bg-pink-500 rounded-2xl p-5 text-white">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
              <Brain className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold uppercase tracking-wide opacity-70 mb-1">Шаг 2</div>
            <div className="font-black text-lg mb-2">Gonka AI</div>
            <p className="text-sm opacity-80">Анализирует ритм, скорость, паузы. Боты двигаются слишком ровно — это их выдаёт</p>
          </div>

          <div className="bg-cyan-500 rounded-2xl p-5 text-white">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
              <Key className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold uppercase tracking-wide opacity-70 mb-1">Шаг 3</div>
            <div className="font-black text-lg mb-2">Твой DID</div>
            <p className="text-sm opacity-80">Цифровой ключ создаётся прямо в браузере. Это твой анонимный ID — как паспорт, но без имени</p>
          </div>

          <div className="bg-blue-600 rounded-2xl p-5 text-white">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
              <Link2 className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold uppercase tracking-wide opacity-70 mb-1">Шаг 4</div>
            <div className="font-black text-lg mb-2">Aptos</div>
            <p className="text-sm opacity-80">Факт верификации записывается в блокчейн. Не данные — только криптодоказательство</p>
          </div>

        </div>
      </div>

      {/* ── ОСНОВНОЙ КОНТЕНТ ── */}
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">

        {/* ══ DRAW / FAILED ══ */}
        {(stage === 'draw' || stage === 'failed') && (<>

          {/* Canvas Card */}
          <div className="rounded-3xl border-2 border-dashed border-purple-300 bg-purple-50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
                <Pencil className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-black text-gray-900 text-lg">Нарисуй что-нибудь</h2>
                <p className="text-gray-500 text-sm">мышью или пальцем — любой символ</p>
              </div>
            </div>
            <GestureCanvas onComplete={handleGesture} />
            <div className="mt-4 flex flex-wrap gap-2">
              {['ритм движения', 'скорость', 'паузы', 'нажатие', 'исправления'].map(tag => (
                <span key={tag} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Failed result */}
          {stage === 'failed' && result && (
            <div className="space-y-3">
              <div className="rounded-3xl border-2 border-red-200 bg-red-50 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <XCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
                  <div>
                    <h3 className="font-black text-red-700 text-lg">Не прошло</h3>
                    <p className="text-red-500 text-sm">{result.reasoning}</p>
                  </div>
                </div>
                <div className="mb-2 flex justify-between text-sm font-medium">
                  <span className="text-gray-600">
                    Уверенность AI {result.via_fallback && <span className="text-orange-500 text-xs">(fallback)</span>}
                  </span>
                  <span className="text-red-600 font-bold">{Math.round(result.confidence * 100)}%</span>
                </div>
                <Progress value={result.confidence * 100} className="h-3 mb-2" />
                <div className="flex justify-between text-xs text-gray-400 mb-4">
                  <span>0%</span>
                  <span className="text-orange-400 font-medium">порог {result.via_fallback ? '70' : '85'}%</span>
                  <span className="text-green-500 font-medium">100%</span>
                </div>
                {result.anomalies && result.anomalies.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1">
                    {result.anomalies.map(a => (
                      <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">{a}</span>
                    ))}
                  </div>
                )}
                <p className="text-sm text-gray-600 bg-white rounded-xl p-3 border border-red-100">
                  💡 <strong>Совет:</strong> рисуй дольше (1–3 сек), делай паузы между точками — неравномерность ритма сигнализирует о человеке
                </p>
              </div>

              {/* Debug panel */}
              {result.debug && (
                <details className="rounded-2xl border border-gray-200 bg-gray-50 text-xs overflow-hidden">
                  <summary className="px-4 py-3 cursor-pointer font-mono text-gray-500 hover:text-gray-700 select-none">
                    🔬 Данные паттерна (отладка)
                  </summary>
                  <div className="px-4 pb-4 grid grid-cols-2 gap-x-6 gap-y-1 font-mono">
                    {[
                      ['velocity_std', result.debug.velocity_std, '> 0.01 = human'],
                      ['velocity_mean', result.debug.velocity_mean, ''],
                      ['pause_entropy', result.debug.pause_entropy, '> 1.0 = human'],
                      ['corrections', result.debug.correction_count, '> 0 = human'],
                      ['rhythm_irr.', result.debug.rhythm_irregularity, '> 0.3 = human'],
                      ['duration_ms', result.debug.total_duration_ms, '> 500ms'],
                      ['points', result.debug.point_count, '> 10'],
                      ['motor_diff', String(result.debug.possible_motor_difficulty), ''],
                    ].map(([k, v, hint]) => (
                      <div key={String(k)} className="flex gap-2 items-baseline py-0.5 border-b border-gray-100">
                        <span className="text-gray-400 w-28 flex-shrink-0">{k}</span>
                        <span className="font-bold text-gray-700">{typeof v === 'number' ? v.toFixed(4) : String(v)}</span>
                        {hint && <span className="text-gray-400 text-[10px] ml-1">{hint}</span>}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-2xl bg-orange-50 border border-orange-200 p-4">
              <p className="text-orange-700 text-sm font-mono">{error}</p>
            </div>
          )}
        </>)}

        {/* ══ ANALYZING ══ */}
        {stage === 'analyzing' && (
          <div className="rounded-3xl border-2 border-pink-200 bg-pink-50 p-10 text-center">
            <div className="w-16 h-16 bg-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-1">Gonka AI анализирует...</h2>
            <p className="text-gray-500 text-sm mb-8">Модель изучает паттерн твоего жеста</p>
            <div className="max-w-xs mx-auto space-y-3 text-left">
              {[
                { label: 'Вариативность скорости', color: 'bg-purple-400' },
                { label: 'Энтропия пауз',          color: 'bg-pink-400'   },
                { label: 'Количество поправок',    color: 'bg-rose-400'   },
                { label: 'Нерегулярность ритма',   color: 'bg-orange-400' },
                { label: 'Генерация ExpressionProof', color: 'bg-green-400' },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-3 text-sm text-gray-600">
                  <div className={`w-2.5 h-2.5 rounded-full ${s.color} animate-pulse flex-shrink-0`}
                    style={{ animationDelay: `${i * 0.25}s` }} />
                  {s.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ SUCCESS ══ */}
        {stage === 'success' && result && (
          <div className="space-y-4">

            {/* Главный результат */}
            <div className="rounded-3xl bg-gradient-to-br from-green-500 to-emerald-600 p-6 text-white">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-black">Ты — человек ✓</h2>
                  <p className="text-green-100 text-sm">Gonka AI подтвердил верификацию</p>
                </div>
              </div>
              <div className="bg-white/20 rounded-2xl p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-green-100">Уверенность AI</span>
                  <span className="font-black text-lg">{Math.round(result.confidence * 100)}%</span>
                </div>
                <Progress value={result.confidence * 100} className="h-3 bg-white/30" />
                <div className="flex justify-between text-xs mt-2 text-green-200">
                  <span>0%</span><span>порог 70%</span><span>85%+ отлично</span><span>100%</span>
                </div>
              </div>
            </div>

            {/* DID */}
            <div className="rounded-3xl border-2 border-cyan-200 bg-cyan-50 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-cyan-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Key className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-gray-900">Твой цифровой ID создан</h3>
                  <p className="text-cyan-600 text-xs font-medium">W3C did:key — международный стандарт</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-3 border border-cyan-200 mb-4">
                <p className="text-xs text-gray-400 mb-1">Идентификатор (DID):</p>
                <p className="font-mono text-xs text-gray-700 break-all leading-relaxed">{result.did?.slice(0, 50)}...</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                <div className="bg-white rounded-xl p-3 border border-cyan-100">
                  <span className="text-cyan-500 font-bold block mb-0.5">Что это?</span>
                  Как паспорт, но цифровой и полностью анонимный
                </div>
                <div className="bg-white rounded-xl p-3 border border-cyan-100">
                  <span className="text-cyan-500 font-bold block mb-0.5">Где хранится?</span>
                  Только в твоём браузере (localStorage). Нигде на серверах
                </div>
                <div className="bg-white rounded-xl p-3 border border-cyan-100">
                  <span className="text-cyan-500 font-bold block mb-0.5">Приватный ключ</span>
                  Только у тебя. Никто не может его использовать
                </div>
                <div className="bg-white rounded-xl p-3 border border-cyan-100">
                  <span className="text-cyan-500 font-bold block mb-0.5">Генерируется</span>
                  Прямо в браузере, за 1мс, без запроса на сервер
                </div>
              </div>
            </div>

            {/* Aptos */}
            <div className="rounded-3xl border-2 border-blue-200 bg-blue-50 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Link2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-gray-900">Запись в блокчейн Aptos</h3>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${result.tx_hash ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                    {result.tx_hash ? 'on-chain ✓' : 'local store'}
                  </span>
                </div>
              </div>
              {result.tx_hash ? (
                <div className="bg-white rounded-xl p-3 border border-blue-200 mb-3">
                  <p className="text-xs text-gray-400 mb-1">Transaction hash:</p>
                  <p className="font-mono text-xs text-blue-700 break-all">{result.tx_hash}</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl p-3 border border-blue-100 mb-3 text-sm text-gray-500">
                  Credential сохранён локально. Добавь <code className="bg-gray-100 px-1 rounded">APTOS_PRIVATE_KEY</code> для on-chain записи.
                </div>
              )}
              <p className="text-xs text-blue-700 bg-blue-100 rounded-xl p-3">
                📌 В блокчейн записан только <strong>факт</strong> верификации — никаких личных данных, только хеш
              </p>
            </div>

            {/* Поручительство */}
            <div className="rounded-3xl border-2 border-indigo-200 bg-indigo-50 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-gray-900">Последний шаг — поручительство</h3>
                  <p className="text-indigo-600 text-xs">3 верифицированных человека подтверждают тебя</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Это защищает от ботов, которые прошли жест-тест. Поручители — живые люди из сети HSI, которые ручаются своей репутацией.
              </p>
              <button onClick={simulateBonds}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all flex items-center justify-center gap-2 text-base shadow-lg shadow-indigo-200">
                🤝 Запросить поручительство
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ══ BONDING ══ */}
        {stage === 'bonding' && (
          <div className="rounded-3xl border-2 border-indigo-200 bg-indigo-50 p-10 text-center">
            <h2 className="text-2xl font-black text-gray-900 mb-2">Ожидаем поручителей...</h2>
            <p className="text-gray-500 text-sm mb-10">Gonka BondMatcher подбирает людей по репутации в сети</p>
            <div className="flex justify-center gap-8 mb-8">
              {[1, 2, 3].map(i => (
                <div key={i} className={`flex flex-col items-center gap-3 transition-all duration-500 ${bondCount >= i ? 'scale-110' : 'opacity-40'}`}>
                  <div className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-2xl transition-all duration-500
                    ${bondCount >= i ? 'bg-green-100 border-green-400 shadow-lg shadow-green-100' : 'bg-white border-gray-200'}`}>
                    {bondCount >= i ? '✅' : '👤'}
                  </div>
                  <span className={`text-xs font-bold ${bondCount >= i ? 'text-green-600' : 'text-gray-400'}`}>
                    {bondCount >= i ? 'Поручился' : '...'}
                  </span>
                </div>
              ))}
            </div>
            <Progress value={(bondCount / 3) * 100} className="max-w-xs mx-auto h-3 mb-3" />
            <p className="text-gray-400 text-sm">{bondCount} из 3</p>
          </div>
        )}

        {/* ══ COMPLETE ══ */}
        {stage === 'complete' && (
          <div className="space-y-4">
            <div className="rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-8 text-white text-center">
              <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-5">
                <Sparkles className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-black mb-2">Верификация завершена!</h2>
              <p className="text-blue-200 mb-6">Ты — полноправный участник сети HSI</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { emoji: '🧠', title: 'Gonka AI', desc: 'жест проверен' },
                  { emoji: '🔑', title: 'DID создан', desc: 'в браузере' },
                  { emoji: '⛓️', title: 'Aptos', desc: 'факт записан' },
                ].map(b => (
                  <div key={b.title} className="bg-white/15 rounded-2xl p-3">
                    <div className="text-2xl mb-1">{b.emoji}</div>
                    <div className="font-bold text-sm">{b.title}</div>
                    <div className="text-blue-200 text-xs">{b.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 rounded-3xl border border-gray-200 p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Что сохранено в браузере</p>
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-start gap-2"><span>🔑</span><div><strong>aptogon_did</strong> — твой анонимный идентификатор</div></div>
                <div className="flex items-start gap-2"><span>🔐</span><div><strong>aptogon_key</strong> — приватный ключ (только у тебя)</div></div>
                <div className="flex items-start gap-2"><span>⛓️</span><div><strong>HumanCredential</strong> — подтверждение верификации</div></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link href="/chat" className="flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-colors text-sm shadow-lg shadow-blue-100">
                💬 Защищённый чат
              </Link>
              <Link href="/bond" className="flex items-center justify-center gap-2 py-4 bg-white hover:bg-gray-50 text-indigo-600 font-black rounded-2xl border-2 border-indigo-200 hover:border-indigo-400 transition-colors text-sm">
                🤝 Поручиться
              </Link>
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-gray-400 pb-8">
        🔒 Координаты уничтожаются в браузере · в сеть уходит только математика · без биометрии
      </p>
    </div>
  )
}
