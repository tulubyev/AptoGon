import Link from 'next/link'

export default function DevelopersPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #0c1a2e 0%, #0a2540 100%)', padding: '72px 24px 60px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
        <h1 style={{ fontSize: 'clamp(2rem,5vw,3rem)', fontWeight: 900, color: '#fff', marginBottom: 16 }}>
          Для разработчиков
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '1.05rem', maxWidth: 520, margin: '0 auto 32px' }}>
          Добавь человеческую верификацию в своё приложение. REST API, совместимый с любым стеком.
        </p>
        <div style={{ display: 'inline-flex', gap: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '10px 20px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <code style={{ color: '#67e8f9', fontSize: '0.9rem', fontFamily: 'monospace' }}>POST https://api.homosapience.org/verify</code>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '64px 24px' }}>

        {/* Quickstart */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#111827', marginBottom: 8 }}>Быстрый старт</h2>
          <p style={{ color: '#6b7280', marginBottom: 24 }}>Минимальная интеграция — 3 шага</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              {
                step: '1',
                title: 'Встрой GestureCanvas',
                code: `import { GestureCanvas } from '@aptogon/sdk'

<GestureCanvas onComplete={(events) => verify(events)} />`,
                color: '#7c3aed',
              },
              {
                step: '2',
                title: 'Отправь жест на верификацию',
                code: `const res = await fetch('https://api.homosapience.org/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': 'YOUR_KEY' },
  body: JSON.stringify({ events, session_id: crypto.randomUUID() })
})
const { passed, did, confidence, expression_proof } = await res.json()`,
                color: '#0891b2',
              },
              {
                step: '3',
                title: 'Используй HumanCredential',
                code: `if (passed) {
  // did = "did:key:z6Mk..." — анонимный ID пользователя
  // expression_proof — хэш для on-chain верификации
  // confidence — 0.0–1.0, обычно 0.88–0.96
  localStorage.setItem('hsi_did', did)
}`,
                color: '#059669',
              },
            ].map(s => (
              <div key={s.step} style={{ borderRadius: 18, overflow: 'hidden', border: '1.5px solid #e2e8f0' }}>
                <div style={{ background: s.color, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 99, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 13, flexShrink: 0 }}>{s.step}</span>
                  <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>{s.title}</span>
                </div>
                <div style={{ background: '#0f172a', padding: '20px 24px' }}>
                  <pre style={{ color: '#e2e8f0', fontSize: '0.82rem', fontFamily: 'monospace', lineHeight: 1.75, margin: 0, overflowX: 'auto' }}>{s.code}</pre>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* API Reference */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#111827', marginBottom: 24 }}>API Reference</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              {
                method: 'POST', path: '/api/verify/expression', color: '#059669',
                desc: 'Верификация жеста. Возвращает HumanCredential.',
                params: 'events[] · session_id',
                returns: 'passed · confidence · did · expression_proof · tx_hash',
              },
              {
                method: 'GET', path: '/api/verify/status', color: '#2563eb',
                desc: 'Статус верификации по DID.',
                params: 'did (query)',
                returns: 'is_human · valid_until · bond_count',
              },
              {
                method: 'GET', path: '/api/verify/debug', color: '#7c3aed',
                desc: 'Последние попытки верификации (для отладки).',
                params: 'last=20 (query)',
                returns: 'attempts[] с паттерном жеста и AI-результатом',
              },
              {
                method: 'POST', path: '/api/verify/did', color: '#d97706',
                desc: 'Создать DID без верификации (для тестов).',
                params: '—',
                returns: 'did · private_key_b64',
              },
            ].map(ep => (
              <div key={ep.path} style={{ borderRadius: 14, border: '1.5px solid #e2e8f0', padding: '18px 22px', background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ background: ep.color, color: '#fff', fontWeight: 700, fontSize: 11, padding: '3px 10px', borderRadius: 6, fontFamily: 'monospace' }}>{ep.method}</span>
                  <code style={{ color: '#1e293b', fontSize: '0.9rem', fontWeight: 600 }}>{ep.path}</code>
                </div>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: 8 }}>{ep.desc}</p>
                <div style={{ display: 'flex', gap: 16, fontSize: '0.8rem', color: '#9ca3af', flexWrap: 'wrap' }}>
                  <span><strong style={{ color: '#374151' }}>Params:</strong> {ep.params}</span>
                  <span><strong style={{ color: '#374151' }}>Returns:</strong> {ep.returns}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#111827', marginBottom: 24 }}>Возможности</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {[
              { icon: '🔐', title: 'Zero PII', desc: 'Сырые координаты жеста не покидают браузер. На сервер — только статистика.', color: '#059669' },
              { icon: '🌐', title: 'W3C DID', desc: 'Совместим со стандартом did:key. Работает с любой системой идентификации.', color: '#7c3aed' },
              { icon: '⛓️', title: 'On-chain proof', desc: 'Move контракт на Aptos. Верификация без нашего сервера — полностью децентрализовано.', color: '#2563eb' },
              { icon: '♿', title: 'Accessibility', desc: 'Учитывает моторные нарушения. Люди с тремором никогда не блокируются.', color: '#0891b2' },
              { icon: '⚡', title: 'Быстро', desc: 'Медиана 800ms. Gonka AI с fallback — верификация работает даже при недоступности сервиса.', color: '#d97706' },
              { icon: '📋', title: 'Verifiable Credential', desc: 'W3C VC формат. Подписан Ed25519. Expires в 30 дней, обновляется автоматически.', color: '#db2777' },
            ].map(f => (
              <div key={f.title} style={{ borderRadius: 16, border: '1.5px solid #e2e8f0', padding: '22px 20px', background: '#fff' }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: f.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 12 }}>{f.icon}</div>
                <div style={{ fontWeight: 700, color: '#111827', marginBottom: 6 }}>{f.title}</div>
                <p style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div style={{ background: '#0f172a', borderRadius: 22, padding: '40px 32px', textAlign: 'center' }}>
          <h3 style={{ color: '#fff', fontWeight: 900, fontSize: '1.3rem', marginBottom: 12 }}>Готов интегрировать?</h3>
          <p style={{ color: '#64748b', marginBottom: 28 }}>Напиши нам — подключим API-ключ и поможем с интеграцией</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="mailto:hello@homosapience.org" style={{ padding: '12px 28px', background: 'linear-gradient(135deg,#7c3aed,#0891b2)', color: '#fff', fontWeight: 700, borderRadius: 12, textDecoration: 'none' }}>
              📩 Написать нам
            </a>
            <Link href="/verify" style={{ padding: '12px 28px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', fontWeight: 600, borderRadius: 12, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.1)' }}>
              🧪 Попробовать live
            </Link>
            <Link href="/" style={{ padding: '12px 28px', background: 'transparent', color: '#475569', fontWeight: 600, borderRadius: 12, textDecoration: 'none' }}>
              ← На главную
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
