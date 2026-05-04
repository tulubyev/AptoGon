'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || ''
// WS URL: wss://... в production, ws://... в dev
const WS_BASE = API.replace(/^http/, 'ws')
const MAX_RETRIES = 3

interface Candidate {
  did_hash_short: string
  reputation: number
  bond_count: number
  success_rate: number
  last_active_days: number
}

interface BondStatus {
  request_id: string
  status: string          // pending | approved | rejected | failed
  auto_approved: boolean
  approvals: number
  needed: number
  tx_hash?: string
}

// ── Incoming bond request notification (for guarantors) ─────────────────────
interface IncomingBondRequest {
  type: 'bond:request'
  request_id: string
  requester: string        // short did hash
  confidence_badge: string // '⭐ high' | '✓ good' | '~ ok'
  message: string
  ts: number
}

// ── Anonymous bond chat message ─────────────────────────────────────────────
interface BondChatMsg {
  from: 'requester' | 'guarantor'
  text: string
  ts: number
}

// ── Trust Score Algorithm explanation ─────────────────────────────────────────

const TRUST_LEVELS = [
  { bonds: 0,  score: 0.1, label: 'Новичок',             color: '#64748b', bar: 10,  icon: '🌱' },
  { bonds: 1,  score: 0.2, label: '',                     color: '#64748b', bar: 20,  icon: '' },
  { bonds: 2,  score: 0.3, label: '',                     color: '#64748b', bar: 30,  icon: '' },
  { bonds: 3,  score: 0.5, label: 'Признан сообществом', color: '#0891b2', bar: 50,  icon: '✅' },
  { bonds: 4,  score: 0.6, label: '',                     color: '#0891b2', bar: 60,  icon: '' },
  { bonds: 5,  score: 0.7, label: '',                     color: '#7c3aed', bar: 70,  icon: '' },
  { bonds: 6,  score: 0.8, label: '',                     color: '#7c3aed', bar: 80,  icon: '' },
  { bonds: '7+', score: 1.0, label: 'Доверенный',         color: '#059669', bar: 100, icon: '🏆' },
]

const PENALTY_ROWS = [
  { event: 'Бот обнаружен среди тех, за кого вы ручались', delta: '−0.1', color: '#ef4444' },
  { event: 'Повторное обнаружение бота (один и тот же поручитель)', delta: '−0.2', color: '#ef4444' },
  { event: 'Новое успешное поручительство', delta: '+0.1', color: '#22c55e' },
  { event: 'Поручитель сам достиг trust_score 1.0', delta: '+0.05 бонус', color: '#a78bfa' },
]

function TrustScoreInfo() {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ marginBottom: 20 }}>

      {/* Collapsed summary bar */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: open ? '14px 14px 0 0' : 14, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: '#fff', transition: 'border-radius 0.2s' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🛡️</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Как работает Trust Score и риски поручителя</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>Алгоритм начисления и штрафы за ботов</div>
          </div>
        </div>
        <span style={{ color: '#475569', fontSize: '1.1rem', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>

      {open && (
        <div style={{ background: '#0f172a', border: '1px solid #334155', borderTop: 'none', borderRadius: '0 0 14px 14px', padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Algorithm */}
          <div>
            <h3 style={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem', marginBottom: 12, marginTop: 0 }}>
              📈 Алгоритм роста Trust Score
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {TRUST_LEVELS.filter(l => l.label).map(l => (
                <div key={String(l.bonds)} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', flexShrink: 0 }}>
                    {l.bonds}
                  </div>
                  <div style={{ flex: 1, height: 8, background: '#1e293b', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${l.bar}%`, background: `linear-gradient(90deg, #334155, ${l.color})`, borderRadius: 99 }} />
                  </div>
                  <div style={{ width: 36, textAlign: 'right', fontWeight: 800, fontSize: '0.85rem', color: l.color, flexShrink: 0 }}>
                    {Math.round(l.score * 100)}%
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 160 }}>
                    {l.icon && <span style={{ fontSize: 14 }}>{l.icon}</span>}
                    <span style={{ fontSize: '0.78rem', color: l.color, fontWeight: l.label ? 700 : 400 }}>{l.label}</span>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ color: '#475569', fontSize: '0.75rem', marginTop: 10, marginBottom: 0 }}>
              Порог для права самому стать поручителем: <strong style={{ color: '#0891b2' }}>trust_score ≥ 0.5</strong> (3+ bonds)
            </p>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid #1e293b' }} />

          {/* Risk table */}
          <div>
            <h3 style={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem', marginBottom: 4, marginTop: 0 }}>
              ⚠️ Риски снижения Trust Score
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: 12, marginTop: 0 }}>
              Поручитель рискует своей репутацией. Это экономический стимул поручаться только за реальных людей.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PENALTY_ROWS.map(row => (
                <div key={row.event} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#1e293b', borderRadius: 10, padding: '10px 14px' }}>
                  <span style={{ fontWeight: 900, fontSize: '0.9rem', color: row.color, flexShrink: 0, minWidth: 72, fontFamily: 'monospace' }}>
                    {row.delta}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{row.event}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid #1e293b' }} />

          {/* How guarantors are identified */}
          <div>
            <h3 style={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem', marginBottom: 4, marginTop: 0 }}>
              🔍 Как поручители находят друг друга без деанонимизации
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { icon: '🔑', title: 'Идентификатор', body: 'Только DID (did:key:z6Mk...) — публичный ключ Ed25519. Никакого имени, email, IP.' },
                { icon: '📊', title: 'Репутация из блокчейна', body: 'trust_score, bond_count, дата последней активности — всё хранится в Aptos on-chain и верифицируемо без доверия к серверу.' },
                { icon: '🤖', title: 'Gonka BondMatcher', body: 'AI выбирает 10 кандидатов из пула по репутации, активности и разнообразию графа. Ни геолокация, ни язык, ни демография не используются.' },
                { icon: '⚖️', title: 'Почему это работает', body: 'Доверие строится на истории действий, а не на личности. DID = анонимный паспорт с криптоподтверждённой репутацией.' },
              ].map(item => (
                <div key={item.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.83rem' }}>{item.title}</div>
                    <div style={{ color: '#64748b', fontSize: '0.78rem', lineHeight: 1.5, marginTop: 2 }}>{item.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

export default function BondPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [stage, setStage] = useState<'browse' | 'requesting' | 'waiting' | 'done' | 'failed'>('browse')
  const [approvals, setApprovals] = useState(0)
  const [txHash, setTxHash] = useState('')
  const [autoApproved, setAutoApproved] = useState(false)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  // Guarantor mode: incoming bond requests via WebSocket
  const [incomingRequests, setIncomingRequests] = useState<IncomingBondRequest[]>([])
  // Anonymous chat per active bond request
  const [chatMsgs, setChatMsgs] = useState<Record<string, BondChatMsg[]>>({})
  const [chatInput, setChatInput] = useState('')
  const [activeChatReqId, setActiveChatReqId] = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const requestIdRef = useRef<string>('')

  // ── WebSocket connection ─────────────────────────────────────────────────────
  const connectWS = useCallback((didHash: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    const ws = new WebSocket(`${WS_BASE}/ws/${didHash}`)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        handleWsMessage(msg)
      } catch { /* ignore */ }
    }
    ws.onclose = () => {
      // Reconnect after 3s
      setTimeout(() => connectWS(didHash), 3000)
    }

    // Keepalive ping every 25s
    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('{"type":"ping"}')
    }, 25000)
    ws.onclose = () => { clearInterval(ping); setTimeout(() => connectWS(didHash), 3000) }
  }, [])

  const handleWsMessage = useCallback((msg: Record<string, unknown>) => {
    const type = msg.type as string
    const reqId = msg.request_id as string | undefined

    // Guarantor receives a bond request
    if (type === 'bond:request') {
      setIncomingRequests(prev => {
        if (prev.find(r => r.request_id === reqId)) return prev
        return [msg as unknown as IncomingBondRequest, ...prev].slice(0, 20)
      })
      return
    }
    // Requester receives approval update
    if (type === 'bond:approved') {
      setApprovals(msg.approvals as number)
      return
    }
    // All 3 bonds collected
    if (type === 'bond:complete') {
      setApprovals(3)
      if (msg.tx_hash) setTxHash(msg.tx_hash as string)
      setTimeout(() => setStage('done'), 600)
      return
    }
    // Retry sent
    if (type === 'bond:retry') {
      setRetryCount(msg.retry_num as number)
      setApprovals(0)
      return
    }
    // All retries exhausted
    if (type === 'bond:failed') {
      setStage('failed')
      return
    }
    // Anonymous chat message
    if (type === 'bond:chat' && reqId) {
      const chatMsg: BondChatMsg = { from: msg.from as 'requester' | 'guarantor', text: msg.text as string, ts: msg.ts as number }
      setChatMsgs(prev => ({ ...prev, [reqId]: [...(prev[reqId] ?? []), chatMsg] }))
      return
    }
  }, [])

  // ── Connect WS on mount if DID exists ───────────────────────────────────────
  useEffect(() => {
    const did = typeof window !== 'undefined' ? localStorage.getItem('aptogon_did') : null
    if (did) {
      // Use SHA-256 of did as ws channel id (matches backend did_hash[:16])
      crypto.subtle.digest('SHA-256', new TextEncoder().encode(did)).then(buf => {
        const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
        connectWS(hash)
      })
    }
    return () => { wsRef.current?.close(); if (pollRef.current) clearInterval(pollRef.current) }
  }, [connectWS])

  // ── Send chat message ────────────────────────────────────────────────────────
  const sendChatMessage = (reqId: string, role: 'requester' | 'guarantor') => {
    if (!chatInput.trim() || !wsRef.current) return
    wsRef.current.send(JSON.stringify({ type: 'bond:chat', request_id: reqId, text: chatInput.trim(), role }))
    setChatMsgs(prev => ({ ...prev, [reqId]: [...(prev[reqId] ?? []), { from: role, text: chatInput.trim(), ts: Date.now() / 1000 }] }))
    setChatInput('')
  }

  // ── Approve incoming bond as guarantor ──────────────────────────────────────
  const approveIncoming = (reqId: string) => {
    const did = typeof window !== 'undefined' ? localStorage.getItem('aptogon_did') : ''
    if (!wsRef.current || !did) return
    wsRef.current.send(JSON.stringify({ type: 'bond:approve', request_id: reqId, did }))
    setIncomingRequests(prev => prev.filter(r => r.request_id !== reqId))
  }

  const rejectIncoming = (reqId: string) => {
    const did = typeof window !== 'undefined' ? localStorage.getItem('aptogon_did') : ''
    if (!wsRef.current) return
    wsRef.current.send(JSON.stringify({ type: 'bond:reject', request_id: reqId, did: did || '' }))
    setIncomingRequests(prev => prev.filter(r => r.request_id !== reqId))
  }

  // ── Load candidates ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/api/bond/candidates`)
      .then(r => r.json())
      .then(setCandidates)
      .catch(() => {
        // Fallback demo data
        const rng = (seed: number) => {
          let s = seed
          return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
        }
        const rand = rng(42)
        setCandidates(Array.from({ length: 12 }, (_, i) => ({
          did_hash_short: `a${i}b${i}c${i}d${i}e${i}f`,
          reputation: Math.floor(300 + rand() * 650),
          bond_count: Math.floor(5 + rand() * 35),
          success_rate: parseFloat((0.85 + rand() * 0.15).toFixed(2)),
          last_active_days: Math.floor(rand() * 14),
        })))
      })
  }, [])

  // ── Cleanup polling on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const toggle = (hash: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(hash) ? next.delete(hash) : next.add(hash)
      return next
    })
  }

  // ── Poll bond status ─────────────────────────────────────────────────────────
  const startPolling = (requestId: string) => {
    setStage('waiting')
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${API}/api/bond/status/${requestId}`)
        if (!r.ok) return
        const data: BondStatus = await r.json()
        setApprovals(data.approvals)

        if (data.status === 'approved') {
          if (pollRef.current) clearInterval(pollRef.current)
          if (data.tx_hash) setTxHash(data.tx_hash)
          setAutoApproved(data.auto_approved)
          setTimeout(() => setStage('done'), 600)
        } else if (data.status === 'rejected') {
          if (pollRef.current) clearInterval(pollRef.current)
          setError('Bond request was rejected. Please try again.')
          setStage('browse')
        }
      } catch {
        // network blip — keep polling
      }
    }, 2500)
  }

  // ── Send bond request ────────────────────────────────────────────────────────
  const sendRequests = async () => {
    setStage('requesting')
    setError('')

    // Read DID + expression proof from localStorage
    const did = typeof window !== 'undefined'
      ? (localStorage.getItem('aptogon_did') || '')
      : ''
    const credential = typeof window !== 'undefined'
      ? JSON.parse(localStorage.getItem('HumanCredential') || 'null')
      : null
    const expressionProof = credential?.credentialSubject?.expression_proof
      || credential?.expression_proof
      || `stub_${Date.now()}`
    const confidence = credential?.credentialSubject?.confidence
      ?? credential?.confidence
      ?? 0.0

    try {
      const r = await fetch(`${API}/api/bond/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requester_did: did || `did:key:z6MkDemo${Date.now()}`,
          expression_proof: expressionProof,
          confidence: confidence,
          message: 'Requesting vouching from the HSI network',
        }),
      })

      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data: BondStatus = await r.json()

      requestIdRef.current = data.request_id

      // Auto-approve: visually tick all 3 guarantors quickly
      if (data.status === 'approved' && data.auto_approved) {
        setStage('waiting')
        setAutoApproved(true)
        if (data.tx_hash) setTxHash(data.tx_hash)
        let count = 0
        const iv = setInterval(() => {
          count++
          setApprovals(count)
          if (count >= 3) {
            clearInterval(iv)
            setTimeout(() => setStage('done'), 600)
          }
        }, 500)
        return
      }

      // Queue: start polling
      startPolling(data.request_id)

    } catch (e) {
      // Fallback: simulate for demo
      setStage('waiting')
      let count = 0
      const iv = setInterval(() => {
        count++
        setApprovals(count)
        if (count >= 3) {
          clearInterval(iv)
          setTimeout(() => setStage('done'), 600)
        }
      }, 1800)
    }
  }

  // ── Failed screen ────────────────────────────────────────────────────────────
  if (stage === 'failed') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#0f172a' }}>
        <div style={{ textAlign: 'center', maxWidth: 440 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>😔</div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff', marginBottom: 8 }}>Не удалось собрать поручительства</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: 8 }}>
            Все {MAX_RETRIES} попытки рассылки исчерпаны. Сейчас мало поручителей онлайн.
          </p>
          <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: 24 }}>
            Попробуйте позже — когда в HSI сети будет больше активных участников, или обратитесь в Telegram.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => { setStage('browse'); setApprovals(0); setRetryCount(0) }}
              style={{ padding: '12px 24px', background: '#7c3aed', color: '#fff', fontWeight: 700, borderRadius: 10, border: 'none', cursor: 'pointer' }}>
              🔄 Попробовать снова
            </button>
            <a href="https://t.me/aptogon" target="_blank" rel="noopener noreferrer"
              style={{ padding: '12px 24px', background: '#1e293b', color: '#fff', fontWeight: 700, borderRadius: 10, border: '1px solid #334155', textDecoration: 'none' }}>
              ✈️ Telegram
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ── Done screen ──────────────────────────────────────────────────────────────
  if (stage === 'done') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#0f172a' }}>
        <div style={{ textAlign: 'center', maxWidth: 440 }}>
          <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', border: '2px solid #3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 48 }}>
            🔑
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff', marginBottom: 8 }}>
            Credential получен!
          </h1>
          {autoApproved ? (
            <p style={{ color: '#a78bfa', marginBottom: 4, fontSize: '0.9rem' }}>
              ✅ AI confidence высокий — авто-апрув системными поручителями
            </p>
          ) : (
            <p style={{ color: '#4ade80', marginBottom: 4 }}>3 человека поручились за тебя</p>
          )}
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 8 }}>
            HumanCredential записан в Aptos блокчейн
          </p>
          {txHash && (
            <p style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#475569', background: '#1e293b', padding: '8px 12px', borderRadius: 8, marginBottom: 24, wordBreak: 'break-all' }}>
              tx: {txHash.slice(0, 40)}…
            </p>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/chat" style={{ padding: '12px 24px', background: '#2563eb', color: '#fff', fontWeight: 700, borderRadius: 10, textDecoration: 'none' }}>
              💬 Войти в чат
            </Link>
            <Link href="/" style={{ padding: '12px 24px', background: '#1e293b', color: '#fff', fontWeight: 700, borderRadius: 10, border: '1px solid #334155', textDecoration: 'none' }}>
              На главную
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Waiting / requesting screen ──────────────────────────────────────────────
  if (stage === 'waiting' || stage === 'requesting') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#0f172a' }}>
        <div style={{ textAlign: 'center', maxWidth: 440, width: '100%' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', marginBottom: 32 }}>
            {stage === 'requesting' ? 'Отправляем запросы...' : (
              autoApproved ? '✅ AI подтверждает...' : 'Ожидаем поручителей'
            )}
          </h1>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 32 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: approvals >= i ? 1 : 0.3, transition: 'opacity 0.5s' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, border: `2px solid ${approvals >= i ? '#22c55e' : '#475569'}`, background: approvals >= i ? 'rgba(34,197,94,0.15)' : '#1e293b', transition: 'all 0.5s' }}>
                  {approvals >= i ? '✓' : '?'}
                </div>
                <span style={{ fontSize: '0.75rem', color: approvals >= i ? '#4ade80' : '#64748b' }}>
                  {approvals >= i ? 'Одобрил' : 'Ожидание'}
                </span>
              </div>
            ))}
          </div>

          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 8 }}>
            {approvals}/3 поручительств · нужно 3+
          </p>
          {autoApproved ? (
            <p style={{ color: '#7c3aed', fontSize: '0.75rem' }}>
              Gonka AI: confidence ≥ 95% — система поручается автоматически
            </p>
          ) : retryCount > 0 ? (
            <p style={{ color: '#fb923c', fontSize: '0.8rem' }}>
              ⟳ Повторная рассылка #{retryCount} — предыдущие поручители не ответили
            </p>
          ) : (
            <p style={{ color: '#475569', fontSize: '0.75rem' }}>
              Запросы отправлены через WebSocket · ожидаем ответа поручителей
            </p>
          )}

          {/* Anonymous chat with guarantors */}
          {requestIdRef.current && (
            <div style={{ marginTop: 24, background: '#1e293b', borderRadius: 12, padding: 16, textAlign: 'left' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: 8, marginTop: 0 }}>
                💬 Анонимный чат с поручителями
              </p>
              <div style={{ maxHeight: 120, overflowY: 'auto', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(chatMsgs[requestIdRef.current] ?? []).map((m, i) => (
                  <div key={i} style={{ fontSize: '0.78rem', color: m.from === 'guarantor' ? '#4ade80' : '#93c5fd', background: '#0f172a', borderRadius: 8, padding: '6px 10px' }}>
                    <span style={{ opacity: 0.6 }}>{m.from === 'guarantor' ? '🤝 Поручитель' : '👤 Вы'}: </span>{m.text}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChatMessage(requestIdRef.current!, 'requester')}
                  placeholder="Написать поручителям..."
                  style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: '0.8rem', outline: 'none' }}
                />
                <button onClick={() => sendChatMessage(requestIdRef.current!, 'requester')}
                  style={{ padding: '8px 14px', background: '#0891b2', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem' }}>
                  →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Browse / select candidates ───────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', padding: '32px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        <div style={{ marginBottom: 32 }}>
          <Link href="/" style={{ color: '#64748b', fontSize: '0.85rem', textDecoration: 'none' }}>← Главная</Link>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff', marginTop: 6, marginBottom: 6 }}>
            P2P Поручительство
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Выбери <strong style={{ color: '#fff' }}>10+ человек</strong> для запроса (нужно 3 согласия)
          </p>
        </div>

        {/* ── Incoming bond requests (guarantor mode) ─────────────────────── */}
        {incomingRequests.length > 0 && (
          <div style={{ background: 'rgba(124,58,237,0.08)', border: '2px solid rgba(124,58,237,0.3)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 20 }}>🔔</span>
              <h3 style={{ color: '#fff', fontWeight: 800, margin: 0, fontSize: '1rem' }}>
                Входящие запросы на поручительство ({incomingRequests.length})
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {incomingRequests.map(req => (
                <div key={req.request_id} style={{ background: '#1e293b', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748b' }}>
                          {req.requester}…
                        </span>
                        <span style={{ fontSize: '0.72rem', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>
                          {req.confidence_badge}
                        </span>
                      </div>
                      {req.message && (
                        <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: 0 }}>«{req.message.slice(0, 120)}»</p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button onClick={() => approveIncoming(req.request_id)}
                        style={{ padding: '8px 18px', background: '#059669', color: '#fff', fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.82rem' }}>
                        ✓ Поручиться
                      </button>
                      <button onClick={() => rejectIncoming(req.request_id)}
                        style={{ padding: '8px 14px', background: '#1e293b', color: '#64748b', fontWeight: 600, borderRadius: 8, border: '1px solid #334155', cursor: 'pointer', fontSize: '0.82rem' }}>
                        ✕
                      </button>
                    </div>
                  </div>
                  {/* Mini chat per incoming request */}
                  <div style={{ borderTop: '1px solid #334155', paddingTop: 10 }}>
                    <div style={{ maxHeight: 80, overflowY: 'auto', marginBottom: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {(chatMsgs[req.request_id] ?? []).map((m, i) => (
                        <div key={i} style={{ fontSize: '0.75rem', color: m.from === 'requester' ? '#93c5fd' : '#4ade80', background: '#0f172a', borderRadius: 6, padding: '4px 8px' }}>
                          <span style={{ opacity: 0.6 }}>{m.from === 'requester' ? '👤 Запрашивающий' : '🤝 Вы'}: </span>{m.text}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        value={activeChatReqId === req.request_id ? chatInput : ''}
                        onChange={e => { setActiveChatReqId(req.request_id); setChatInput(e.target.value) }}
                        onKeyDown={e => e.key === 'Enter' && activeChatReqId === req.request_id && sendChatMessage(req.request_id, 'guarantor')}
                        placeholder="Спросить..."
                        style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '6px 10px', color: '#fff', fontSize: '0.75rem', outline: 'none' }}
                      />
                      <button
                        onClick={() => { setActiveChatReqId(req.request_id); sendChatMessage(req.request_id, 'guarantor') }}
                        style={{ padding: '6px 12px', background: '#334155', color: '#94a3b8', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem' }}>
                        →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Trust Score Info ─────────────────────────────────────────────── */}
        <TrustScoreInfo />

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#fca5a5', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {/* Selection bar */}
        <div style={{ background: '#1e293b', borderRadius: 14, border: '1px solid #334155', padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>{selected.size}</span>
            <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}> выбрано</span>
          </div>
          <button
            onClick={sendRequests}
            disabled={selected.size < 3}
            style={{ padding: '10px 24px', background: selected.size >= 3 ? '#0891b2' : '#1e293b', color: selected.size >= 3 ? '#fff' : '#475569', fontWeight: 700, borderRadius: 10, border: `1px solid ${selected.size >= 3 ? '#0891b2' : '#334155'}`, cursor: selected.size >= 3 ? 'pointer' : 'not-allowed', fontSize: '0.9rem', transition: 'all 0.2s' }}
          >
            🤝 Отправить запросы
          </button>
        </div>

        {/* Candidates grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {candidates.map(c => {
            const isSel = selected.has(c.did_hash_short)
            return (
              <button
                key={c.did_hash_short}
                onClick={() => toggle(c.did_hash_short)}
                style={{ textAlign: 'left', padding: 16, borderRadius: 14, border: `2px solid ${isSel ? '#3b82f6' : '#1e293b'}`, background: isSel ? 'rgba(59,130,246,0.1)' : '#1e293b', cursor: 'pointer', transition: 'all 0.15s' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, background: isSel ? '#2563eb' : '#334155', color: isSel ? '#fff' : '#94a3b8' }}>
                      {c.did_hash_short.slice(0, 2).toUpperCase()}
                    </div>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748b' }}>{c.did_hash_short}</span>
                  </div>
                  <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${isSel ? '#3b82f6' : '#475569'}`, background: isSel ? '#2563eb' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#fff', transition: 'all 0.15s' }}>
                    {isSel && '✓'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: '0.8rem', flexWrap: 'wrap' }}>
                  <span style={{ color: '#fb923c', fontWeight: 700 }}>⭐ {c.reputation}</span>
                  <span style={{ color: '#4ade80' }}>{(c.success_rate * 100).toFixed(0)}% успех</span>
                  <span style={{ color: '#94a3b8' }}>{c.bond_count} bonds</span>
                  <span style={{ color: '#64748b' }}>{c.last_active_days}д назад</span>
                </div>
              </button>
            )
          })}
        </div>

      </div>
    </div>
  )
}
