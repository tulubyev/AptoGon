'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { GestureCanvas, TouchEventData } from '@/components/GestureCanvas'

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
  credential?: Record<string, unknown>
  debug?: DebugPattern
}

const STEP_COLORS = [
  { color: '#7c3aed', bg: 'linear-gradient(135deg, #7c3aed, #a855f7)' },
  { color: '#db2777', bg: 'linear-gradient(135deg, #db2777, #f472b6)' },
  { color: '#0891b2', bg: 'linear-gradient(135deg, #0891b2, #22d3ee)' },
  { color: '#2563eb', bg: 'linear-gradient(135deg, #2563eb, #60a5fa)' },
]

const ProgressBar = ({ value, color = '#7c3aed' }: { value: number; color?: string }) => (
  <div style={{ background: 'rgba(0,0,0,0.08)', borderRadius: 99, height: 10, overflow: 'hidden' }}>
    <div style={{
      width: `${Math.min(100, Math.max(0, value))}%`,
      height: '100%', background: color, borderRadius: 99, transition: 'width 0.5s ease',
    }} />
  </div>
)

export default function VerifyPage() {
  const t = useTranslations('verify')
  const [stage, setStage] = useState<Stage>('draw')
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [bondCount, setBondCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [sessionId] = useState(() => crypto.randomUUID())

  const steps = t.raw('steps') as Array<{ num: string; title: string; desc: string }>
  const tags = t.raw('tags') as string[]
  const analyzingChecks = t.raw('analyzing_checks') as string[]
  const completeCards = t.raw('complete_cards') as Array<{ emoji: string; title: string; desc: string }>
  const storedItems = t.raw('stored_items') as Array<{ icon: string; key: string; desc: string }>

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
        localStorage.setItem('hsi_did', data.did)
        const hsiCred = JSON.stringify({
          ...(data.credential ?? {}),
          issuanceDate: new Date().toISOString(),
          expirationDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
          credentialSubject: {
            ...(data.credential?.credentialSubject ?? {}),
            id: data.did, isHuman: true,
            confidence: data.confidence,
            expressionProof: data.expression_proof,
            txHash: data.tx_hash,
          },
        })
        localStorage.setItem('hsi_credential', hsiCred)
        window.dispatchEvent(new CustomEvent('hsi:verified', { detail: { cred: hsiCred, did: data.did } }))
        setStage('success')
      } else {
        setStage('failed')
      }
    } catch {
      setError(t('error_backend'))
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
    <div style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── HERO ── */}
      <div style={{
        background: 'linear-gradient(135deg, #ede9fe 0%, #f0f9ff 55%, #fdf4ff 100%)',
        padding: '56px 24px 48px', textAlign: 'center',
        borderBottom: '1px solid rgba(124,58,237,0.1)',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
          borderRadius: 99, padding: '6px 16px', marginBottom: 20,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>{t('hero_badge')}</span>
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 900, lineHeight: 1.15, margin: '0 0 16px', color: '#0f172a', letterSpacing: '-0.03em' }}>
          {t('hero_title')}{' '}
          <span style={{ background: 'linear-gradient(90deg,#7c3aed,#db2777)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {t('hero_human')}
          </span>
        </h1>
        <p style={{ fontSize: 18, color: '#475569', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
          {t('hero_subtitle')}
        </p>
      </div>

      {/* ── STEPS ── */}
      <div style={{ padding: '48px 24px', background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
        <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 28 }}>
          {t('steps_label')}
        </p>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ background: STEP_COLORS[i].bg, borderRadius: 20, padding: '24px 20px', color: '#fff', boxShadow: `0 4px 24px ${STEP_COLORS[i].color}30` }}>
              <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 14 }}>
                {['✏️', '🧠', '🔑', '⛓️'][i]}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7, marginBottom: 6 }}>
                {t('steps_label').split(' ')[0]} {s.num}
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 8 }}>{s.title}</div>
              <p style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.5, margin: 0 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px 60px' }}>

        {/* ══ DRAW / FAILED ══ */}
        {(stage === 'draw' || stage === 'failed') && (<>

          <div style={{ background: '#fff', borderRadius: 24, padding: 28, border: '2px dashed rgba(124,58,237,0.3)', boxShadow: '0 4px 32px rgba(124,58,237,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>✏️</div>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0f172a' }}>{t('canvas_title')}</h2>
                <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', marginTop: 2 }}>{t('canvas_subtitle')}</p>
              </div>
            </div>
            <GestureCanvas onComplete={handleGesture} />
            <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {tags.map(tag => (
                <span key={tag} style={{ padding: '4px 12px', background: 'rgba(124,58,237,0.08)', color: '#7c3aed', borderRadius: 99, fontSize: 12, fontWeight: 600, border: '1px solid rgba(124,58,237,0.15)' }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {stage === 'failed' && result && (
            <div style={{ marginTop: 20 }}>
              <div style={{ background: '#fff', borderRadius: 24, padding: 24, border: '2px solid #fecaca', boxShadow: '0 4px 24px rgba(239,68,68,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 32, flexShrink: 0 }}>❌</div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#dc2626' }}>{t('failed_title')}</h3>
                    <p style={{ margin: 0, fontSize: 13, color: '#ef4444', marginTop: 4 }}>{result.reasoning}</p>
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: '#64748b' }}>
                      {t('confidence_label')} {result.via_fallback && <span style={{ color: '#f97316', fontSize: 11 }}>{t('fallback_label')}</span>}
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 900, color: '#dc2626' }}>{Math.round(result.confidence * 100)}%</span>
                  </div>
                  <ProgressBar value={result.confidence * 100} color="#ef4444" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: '#94a3b8' }}>
                    <span>{t('threshold_0')}</span>
                    <span style={{ color: '#f97316', fontWeight: 600 }}>{t('threshold_70').replace('70', result.via_fallback ? '70' : '85')}</span>
                    <span style={{ color: '#22c55e', fontWeight: 600 }}>{t('threshold_100')}</span>
                  </div>
                </div>
                {result.anomalies && result.anomalies.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {result.anomalies.map(a => (
                      <span key={a} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: '#fee2e2', color: '#dc2626' }}>{a}</span>
                    ))}
                  </div>
                )}
                <div style={{ background: '#fef2f2', borderRadius: 14, padding: '12px 16px', fontSize: 13, color: '#64748b', border: '1px solid #fecaca', lineHeight: 1.6 }}>
                  {t('failed_tip')}
                </div>
              </div>

              {result.debug && (
                <details style={{ marginTop: 12, borderRadius: 16, border: '1px solid #e2e8f0', background: '#f8fafc', overflow: 'hidden' }}>
                  <summary style={{ padding: '10px 16px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 12, color: '#64748b', userSelect: 'none' }}>
                    {t('debug_title')}
                  </summary>
                  <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px', fontFamily: 'monospace', fontSize: 11 }}>
                    {[
                      ['velocity_std', result.debug.velocity_std, '> 0.01'],
                      ['velocity_mean', result.debug.velocity_mean, ''],
                      ['pause_entropy', result.debug.pause_entropy, '> 1.0'],
                      ['corrections', result.debug.correction_count, '> 0'],
                      ['rhythm_irr.', result.debug.rhythm_irregularity, '> 0.3'],
                      ['duration_ms', result.debug.total_duration_ms, '> 500ms'],
                      ['points', result.debug.point_count, '> 10'],
                      ['motor_diff', String(result.debug.possible_motor_difficulty), ''],
                    ].map(([k, v, hint]) => (
                      <div key={String(k)} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '3px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ color: '#94a3b8', width: 110, flexShrink: 0 }}>{k}</span>
                        <span style={{ fontWeight: 700, color: '#374151' }}>{typeof v === 'number' ? v.toFixed(4) : String(v)}</span>
                        {hint && <span style={{ color: '#94a3b8', fontSize: 10 }}>{hint}</span>}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {error && (
            <div style={{ marginTop: 16, borderRadius: 16, background: '#fff7ed', border: '1px solid #fed7aa', padding: '12px 16px' }}>
              <p style={{ margin: 0, fontSize: 13, fontFamily: 'monospace', color: '#c2410c' }}>{error}</p>
            </div>
          )}
        </>)}

        {/* ══ ANALYZING ══ */}
        {stage === 'analyzing' && (
          <div style={{ background: '#fff', borderRadius: 24, padding: '48px 32px', textAlign: 'center', border: '2px solid rgba(219,39,119,0.2)', boxShadow: '0 4px 32px rgba(219,39,119,0.08)' }}>
            <div style={{ width: 64, height: 64, background: 'linear-gradient(135deg,#db2777,#f472b6)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 20px' }}>
              ⚙️
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 900, color: '#0f172a' }}>{t('analyzing_title')}</h2>
            <p style={{ margin: '0 0 32px', fontSize: 14, color: '#94a3b8' }}>{t('analyzing_subtitle')}</p>
            <div style={{ maxWidth: 280, margin: '0 auto', textAlign: 'left' }}>
              {analyzingChecks.map((label, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: '#64748b', marginBottom: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: ['#7c3aed','#db2777','#e11d48','#f97316','#059669'][i], flexShrink: 0 }} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ SUCCESS ══ */}
        {stage === 'success' && result && (
          <div>
            <div style={{ background: 'linear-gradient(135deg,#059669,#10b981)', borderRadius: 24, padding: '28px 28px', color: '#fff', boxShadow: '0 8px 40px rgba(5,150,105,0.25)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <div style={{ width: 56, height: 56, background: 'rgba(255,255,255,0.2)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>✅</div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>{t('success_title')}</h2>
                  <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.8 }}>{t('success_subtitle')}</p>
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ opacity: 0.85 }}>{t('confidence_label')}</span>
                  <span style={{ fontWeight: 900, fontSize: 18 }}>{Math.round(result.confidence * 100)}%</span>
                </div>
                <ProgressBar value={result.confidence * 100} color="rgba(255,255,255,0.9)" />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, opacity: 0.7 }}>
                  <span>{t('threshold_0')}</span><span>{t('threshold_70')}</span><span>{t('threshold_85')}</span><span>{t('threshold_100')}</span>
                </div>
              </div>
            </div>

            {/* DID */}
            <div style={{ background: '#fff', borderRadius: 24, padding: 24, border: '2px solid rgba(8,145,178,0.2)', marginBottom: 16, boxShadow: '0 4px 24px rgba(8,145,178,0.07)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, background: 'linear-gradient(135deg,#0891b2,#22d3ee)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🔑</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#0f172a' }}>{t('did_title')}</h3>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: '#0891b2', fontWeight: 600 }}>{t('did_subtitle')}</p>
                </div>
              </div>
              <div style={{ background: '#f0f9ff', borderRadius: 14, padding: 12, border: '1px solid rgba(8,145,178,0.2)', marginBottom: 16 }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: '#94a3b8' }}>{t('did_id_label')}</p>
                <p style={{ margin: 0, fontFamily: 'monospace', fontSize: 11, color: '#0f172a', wordBreak: 'break-all', lineHeight: 1.6 }}>{result.did?.slice(0, 50)}...</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: t('did_what_label'), value: t('did_what_value') },
                  { label: t('did_where_label'), value: t('did_where_value') },
                  { label: t('did_key_label'), value: t('did_key_value') },
                  { label: t('did_gen_label'), value: t('did_gen_value') },
                ].map(item => (
                  <div key={item.label} style={{ background: '#f0f9ff', borderRadius: 12, padding: '10px 12px', border: '1px solid rgba(8,145,178,0.12)' }}>
                    <span style={{ fontSize: 11, color: '#0891b2', fontWeight: 700, display: 'block', marginBottom: 4 }}>{item.label}</span>
                    <span style={{ fontSize: 11, color: '#475569', lineHeight: 1.5 }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Aptos */}
            <div style={{ background: '#fff', borderRadius: 24, padding: 24, border: '2px solid rgba(37,99,235,0.2)', marginBottom: 16, boxShadow: '0 4px 24px rgba(37,99,235,0.07)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, background: 'linear-gradient(135deg,#2563eb,#60a5fa)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>⛓️</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#0f172a' }}>{t('aptos_title')}</h3>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: result.tx_hash ? '#dcfce7' : '#f1f5f9', color: result.tx_hash ? '#16a34a' : '#64748b' }}>
                    {result.tx_hash ? t('aptos_onchain') : t('aptos_local')}
                  </span>
                </div>
              </div>
              {result.tx_hash ? (
                <div style={{ background: '#eff6ff', borderRadius: 12, padding: 12, border: '1px solid rgba(37,99,235,0.2)', marginBottom: 12 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 11, color: '#94a3b8' }}>{t('aptos_tx_label')}</p>
                  <p style={{ margin: 0, fontFamily: 'monospace', fontSize: 11, color: '#2563eb', wordBreak: 'break-all' }}>{result.tx_hash}</p>
                </div>
              ) : (
                <div style={{ background: '#f8fafc', borderRadius: 12, padding: 12, border: '1px solid #e2e8f0', marginBottom: 12, fontSize: 13, color: '#64748b' }}>
                  {t('aptos_no_key').split('APTOS_PRIVATE_KEY')[0]}
                  <code style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 6, fontFamily: 'monospace' }}>APTOS_PRIVATE_KEY</code>
                  {t('aptos_no_key').split('APTOS_PRIVATE_KEY')[1]}
                </div>
              )}
              <div style={{ background: '#eff6ff', borderRadius: 12, padding: '10px 14px', fontSize: 12, color: '#2563eb', lineHeight: 1.6 }}>
                {t('aptos_note')}
              </div>
            </div>

            {/* Bond CTA */}
            <div style={{ background: '#fff', borderRadius: 24, padding: 24, border: '2px solid rgba(99,102,241,0.2)', boxShadow: '0 4px 24px rgba(99,102,241,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{ width: 44, height: 44, background: 'linear-gradient(135deg,#6366f1,#a5b4fc)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🛡️</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#0f172a' }}>{t('bond_title')}</h3>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6366f1', fontWeight: 600 }}>{t('bond_subtitle')}</p>
                </div>
              </div>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 1.6 }}>{t('bond_desc')}</p>
              <button onClick={simulateBonds} style={{ width: '100%', padding: '16px 24px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: 900, fontSize: 15, border: 'none', borderRadius: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 4px 20px rgba(99,102,241,0.3)' }}>
                {t('bond_cta')}
              </button>
            </div>
          </div>
        )}

        {/* ══ BONDING ══ */}
        {stage === 'bonding' && (
          <div style={{ background: '#fff', borderRadius: 24, padding: '48px 32px', textAlign: 'center', border: '2px solid rgba(99,102,241,0.2)', boxShadow: '0 4px 32px rgba(99,102,241,0.08)' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{t('bonding_title')}</h2>
            <p style={{ margin: '0 0 40px', fontSize: 13, color: '#94a3b8' }}>{t('bonding_subtitle')}</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 32 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, transition: 'transform 0.5s, opacity 0.5s', transform: bondCount >= i ? 'scale(1.1)' : 'scale(1)', opacity: bondCount >= i ? 1 : 0.4 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 20, border: '2px solid', borderColor: bondCount >= i ? '#22c55e' : '#e2e8f0', background: bondCount >= i ? '#dcfce7' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, transition: 'all 0.5s', boxShadow: bondCount >= i ? '0 4px 20px rgba(34,197,94,0.2)' : 'none' }}>
                    {bondCount >= i ? '✅' : '👤'}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: bondCount >= i ? '#16a34a' : '#94a3b8' }}>
                    {bondCount >= i ? t('bonding_vouched') : t('bonding_waiting')}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ maxWidth: 240, margin: '0 auto' }}>
              <ProgressBar value={(bondCount / 3) * 100} color="#6366f1" />
            </div>
            <p style={{ marginTop: 12, fontSize: 13, color: '#94a3b8' }}>{bondCount} {t('bonding_progress')}</p>
          </div>
        )}

        {/* ══ COMPLETE ══ */}
        {stage === 'complete' && (
          <div>
            <div style={{ background: 'linear-gradient(135deg,#2563eb,#6366f1,#7c3aed)', borderRadius: 24, padding: '40px 32px', color: '#fff', textAlign: 'center', boxShadow: '0 8px 48px rgba(99,102,241,0.3)', marginBottom: 16 }}>
              <div style={{ width: 80, height: 80, background: 'rgba(255,255,255,0.2)', borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, margin: '0 auto 20px' }}>✨</div>
              <h2 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 900 }}>{t('complete_title')}</h2>
              <p style={{ margin: '0 0 28px', fontSize: 15, opacity: 0.8 }}>{t('complete_subtitle')}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                {completeCards.map(b => (
                  <div key={b.title} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 14 }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>{b.emoji}</div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{b.title}</div>
                    <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>{b.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: 24, padding: 20, border: '1px solid #e2e8f0', marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
                {t('stored_title')}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {storedItems.map(item => (
                  <div key={item.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#374151' }}>
                    <span>{item.icon}</span>
                    <div><strong>{item.key}</strong> — {item.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Link href="/chat" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px 20px', background: 'linear-gradient(135deg,#2563eb,#60a5fa)', color: '#fff', fontWeight: 900, fontSize: 14, borderRadius: 16, textDecoration: 'none', boxShadow: '0 4px 20px rgba(37,99,235,0.25)' }}>
                {t('cta_chat')}
              </Link>
              <Link href="/bond" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px 20px', background: '#fff', color: '#6366f1', fontWeight: 900, fontSize: 14, borderRadius: 16, textDecoration: 'none', border: '2px solid rgba(99,102,241,0.3)' }}>
                {t('cta_bond')}
              </Link>
            </div>
          </div>
        )}
      </div>

      <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', paddingBottom: 40 }}>
        {t('footer_note')}
      </p>
    </div>
  )
}
