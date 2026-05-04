import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function DevelopersPage() {
  const t = await getTranslations('developers')

  const features = t.raw('features') as Array<{ icon: string; title: string; desc: string }>

  const endpoints = [
    { method: 'POST', path: '/api/verify/expression', color: '#059669', descKey: 'ep1_desc', paramsKey: 'ep1_params', returnsKey: 'ep1_returns' },
    { method: 'GET',  path: '/api/verify/status',     color: '#2563eb', descKey: 'ep2_desc', paramsKey: 'ep2_params', returnsKey: 'ep2_returns' },
    { method: 'GET',  path: '/api/verify/debug',      color: '#7c3aed', descKey: 'ep3_desc', paramsKey: 'ep3_params', returnsKey: 'ep3_returns' },
    { method: 'POST', path: '/api/verify/did',        color: '#d97706', descKey: 'ep4_desc', paramsKey: 'ep4_params', returnsKey: 'ep4_returns' },
  ]

  const quicksteps = [
    {
      titleKey: 'step1_title', color: '#7c3aed',
      code: `import { GestureCanvas } from '@aptogon/sdk'\n\n<GestureCanvas onComplete={(events) => verify(events)} />`,
    },
    {
      titleKey: 'step2_title', color: '#0891b2',
      code: `const res = await fetch('https://api.homosapience.org/verify', {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json', 'X-API-Key': 'YOUR_KEY' },\n  body: JSON.stringify({ events, session_id: crypto.randomUUID() })\n})\nconst { passed, did, confidence, expression_proof } = await res.json()`,
    },
    {
      titleKey: 'step3_title', color: '#059669',
      code: `if (passed) {\n  // did = "did:key:z6Mk..." — anonymous user ID\n  // expression_proof — hash for on-chain verification\n  // confidence — 0.0–1.0, typically 0.88–0.96\n  localStorage.setItem('hsi_did', did)\n}`,
    },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #0c1a2e 0%, #0a2540 100%)', padding: '72px 24px 60px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
        <h1 style={{ fontSize: 'clamp(2rem,5vw,3rem)', fontWeight: 900, color: '#fff', marginBottom: 16 }}>
          {t('hero_title')}
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '1.05rem', maxWidth: 520, margin: '0 auto 32px' }}>
          {t('hero_subtitle')}
        </p>
        <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '10px 20px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <code style={{ color: '#67e8f9', fontSize: '0.9rem', fontFamily: 'monospace' }}>POST https://api.homosapience.org/verify</code>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '64px 24px' }}>

        {/* Quickstart */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#111827', marginBottom: 8 }}>{t('quickstart_title')}</h2>
          <p style={{ color: '#6b7280', marginBottom: 24 }}>{t('quickstart_subtitle')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {quicksteps.map((s, i) => (
              <div key={i} style={{ borderRadius: 18, overflow: 'hidden', border: '1.5px solid #e2e8f0' }}>
                <div style={{ background: s.color, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 99, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 13, flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>{t(s.titleKey)}</span>
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
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#111827', marginBottom: 24 }}>{t('api_title')}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {endpoints.map(ep => (
              <div key={ep.path} style={{ borderRadius: 14, border: '1.5px solid #e2e8f0', padding: '18px 22px', background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ background: ep.color, color: '#fff', fontWeight: 700, fontSize: 11, padding: '3px 10px', borderRadius: 6, fontFamily: 'monospace' }}>{ep.method}</span>
                  <code style={{ color: '#1e293b', fontSize: '0.9rem', fontWeight: 600 }}>{ep.path}</code>
                </div>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: 8 }}>{t(ep.descKey)}</p>
                <div style={{ display: 'flex', gap: 16, fontSize: '0.8rem', color: '#9ca3af', flexWrap: 'wrap' }}>
                  <span><strong style={{ color: '#374151' }}>Params:</strong> {t(ep.paramsKey)}</span>
                  <span><strong style={{ color: '#374151' }}>Returns:</strong> {t(ep.returnsKey)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#111827', marginBottom: 24 }}>{t('features_title')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {features.map(f => (
              <div key={f.title} style={{ borderRadius: 16, border: '1.5px solid #e2e8f0', padding: '22px 20px', background: '#fff' }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 12 }}>{f.icon}</div>
                <div style={{ fontWeight: 700, color: '#111827', marginBottom: 6 }}>{f.title}</div>
                <p style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div style={{ background: '#0f172a', borderRadius: 22, padding: '40px 32px', textAlign: 'center' }}>
          <h3 style={{ color: '#fff', fontWeight: 900, fontSize: '1.3rem', marginBottom: 12 }}>{t('cta_title')}</h3>
          <p style={{ color: '#64748b', marginBottom: 28 }}>{t('cta_subtitle')}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="mailto:hello@homosapience.org"
              style={{ padding: '12px 28px', background: 'linear-gradient(135deg,#7c3aed,#0891b2)', color: '#fff', fontWeight: 700, borderRadius: 12, textDecoration: 'none' }}>
              {t('cta_email')}
            </a>
            <Link href="/verify"
              style={{ padding: '12px 28px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', fontWeight: 600, borderRadius: 12, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.1)' }}>
              {t('cta_try')}
            </Link>
            <Link href="/" style={{ padding: '12px 28px', background: 'transparent', color: '#475569', fontWeight: 600, borderRadius: 12, textDecoration: 'none' }}>
              {t('cta_home')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
