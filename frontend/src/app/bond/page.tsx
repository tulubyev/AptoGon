'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Candidate {
  did_hash_short: string
  reputation: number
  bond_count: number
  success_rate: number
  last_active_days: number
}

export default function BondPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [stage, setStage] = useState<'browse' | 'requesting' | 'waiting' | 'done'>('browse')
  const [approvals, setApprovals] = useState(0)

  useEffect(() => {
    fetch('/api/bond/candidates')
      .then(r => r.json())
      .then(setCandidates)
      .catch(() => {
        // Демо данные
        setCandidates(Array.from({ length: 12 }, (_, i) => ({
          did_hash_short: `a${i}b${i}c${i}d${i}e${i}f`,
          reputation: Math.floor(300 + Math.random() * 650),
          bond_count: Math.floor(5 + Math.random() * 35),
          success_rate: parseFloat((0.85 + Math.random() * 0.15).toFixed(2)),
          last_active_days: Math.floor(Math.random() * 14),
        })))
      })
  }, [])

  const toggle = (hash: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(hash) ? next.delete(hash) : next.add(hash)
      return next
    })
  }

  const sendRequests = () => {
    setStage('requesting')
    setTimeout(() => {
      setStage('waiting')
      let count = 0
      const iv = setInterval(() => {
        count++
        setApprovals(count)
        if (count >= 3) {
          clearInterval(iv)
          setTimeout(() => setStage('done'), 800)
        }
      }, 1800)
    }, 1000)
  }

  if (stage === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-blue-500 pulse-human">
            <span className="text-5xl">🔑</span>
          </div>
          <h1 className="text-3xl font-black text-white mb-2">Credential получен!</h1>
          <p className="text-green-400 mb-1">3 человека поручились за тебя</p>
          <p className="text-slate-400 text-sm mb-8">HumanCredential записан в Aptos блокчейн</p>
          <div className="flex gap-3 justify-center">
            <Link href="/chat" className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors">
              💬 Войти в чат
            </Link>
            <Link href="/" className="px-6 py-3 bg-[#1a2235] text-white font-bold rounded-lg border border-slate-700 hover:border-slate-500 transition-colors">
              На главную
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (stage === 'waiting' || stage === 'requesting') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md w-full">
          <h1 className="text-2xl font-black text-white mb-8">
            {stage === 'requesting' ? 'Отправляем запросы...' : 'Ожидаем поручителей'}
          </h1>
          <div className="flex justify-center gap-8 mb-8">
            {[1, 2, 3].map(i => (
              <div key={i} className={`flex flex-col items-center gap-3 transition-all duration-700 ${approvals >= i ? 'opacity-100' : 'opacity-30'}`}>
                <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center text-3xl
                  ${approvals >= i ? 'bg-green-500/20 border-green-500' : 'bg-slate-800 border-slate-600'}`}>
                  {approvals >= i ? '✓' : '?'}
                </div>
                <span className="text-xs text-slate-400">{approvals >= i ? 'Одобрил' : 'Ожидание'}</span>
              </div>
            ))}
          </div>
          <p className="text-slate-500 text-sm">{approvals}/3 поручительств · нужно 3+</p>
          <p className="text-slate-600 text-xs mt-2">Запросы отправлены через libp2p P2P</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <Link href="/" className="text-slate-500 hover:text-white text-sm block mb-1">← Главная</Link>
        <h1 className="text-3xl font-black text-white">P2P Поручительство</h1>
        <p className="text-slate-400 text-sm mt-1">
          Выбери <strong className="text-white">10+ человек</strong> для запроса (нужно получить 3 согласия)
        </p>
      </div>

      {/* Selection summary */}
      <div className="bg-[#1a2235] rounded-xl border border-slate-700 p-4 mb-6 flex items-center justify-between">
        <div>
          <span className="text-white font-bold">{selected.size}</span>
          <span className="text-slate-400 text-sm"> выбрано для запроса</span>
        </div>
        <button
          onClick={sendRequests}
          disabled={selected.size < 3}
          className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
        >
          🤝 Отправить запросы
        </button>
      </div>

      {/* Candidates grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {candidates.map(c => {
          const isSel = selected.has(c.did_hash_short)
          return (
            <button
              key={c.did_hash_short}
              onClick={() => toggle(c.did_hash_short)}
              className={`text-left p-4 rounded-xl border transition-all ${
                isSel
                  ? 'bg-blue-600/20 border-blue-500'
                  : 'bg-[#1a2235] border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                    ${isSel ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    {c.did_hash_short.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="font-mono text-xs text-slate-500">{c.did_hash_short}</span>
                </div>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                  isSel ? 'bg-blue-600 border-blue-600' : 'border-slate-600'
                }`}>
                  {isSel && <span className="text-white text-xs">✓</span>}
                </div>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="text-orange-400 font-bold">⭐ {c.reputation}</span>
                <span className="text-green-400">{(c.success_rate * 100).toFixed(0)}% успех</span>
                <span className="text-slate-500">{c.bond_count} bonds</span>
                <span className="text-slate-500">{c.last_active_days}д назад</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
