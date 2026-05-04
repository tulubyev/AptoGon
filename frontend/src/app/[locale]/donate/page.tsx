import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function DonatePage() {
  const t = await getTranslations('donate')

  const funds = t.raw('funds') as Array<{ icon: string; title: string; desc: string; pct: number }>
  const tiers = t.raw('tiers') as Array<{ amount: string; label: string; desc: string; icon: string }>

  const tierStyles = [
    { color: '#d97706', bg: '#fffbeb' },
    { color: '#059669', bg: '#f0fdf4' },
    { color: '#7c3aed', bg: '#faf5ff' },
    { color: '#1d4ed8', bg: '#eff6ff' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#faf5ff', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #2d1b69 0%, #4c1d95 100%)', padding: '72px 24px 60px', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🤝</div>
        <h1 style={{ fontSize: 'clamp(2rem,5vw,3rem)', fontWeight: 900, color: '#fff', marginBottom: 16 }}>
          {t('hero_title')}
        </h1>
        <p style={{ color: '#c4b5fd', fontSize: '1.05rem', maxWidth: 500, margin: '0 auto' }}>
          {t('hero_subtitle')}
        </p>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '64px 24px' }}>

        {/* Where funds go */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#111827', marginBottom: 16 }}>{t('funds_title')}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {funds.map(item => (
              <div key={item.title} style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: '1px solid #e9d5ff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>{item.icon}</span>
                  <span style={{ fontWeight: 700, color: '#111827', flex: 1 }}>{item.title}</span>
                  <span style={{ fontWeight: 800, color: '#7c3aed', fontSize: '0.9rem' }}>{item.pct}%</span>
                </div>
                <div style={{ height: 4, background: '#f3e8ff', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ height: '100%', background: 'linear-gradient(90deg,#7c3aed,#a78bfa)', borderRadius: 99, width: `${item.pct}%` }} />
                </div>
                <p style={{ fontSize: '0.85rem', color: '#9ca3af', margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Support tiers */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#111827', marginBottom: 16 }}>{t('tiers_title')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 16 }}>
            {tiers.map((tier, i) => (
              <div key={tier.amount} style={{ borderRadius: 20, border: `2px solid ${tierStyles[i].color}25`, background: tierStyles[i].bg, padding: '28px 20px', textAlign: 'center', cursor: 'pointer' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{tier.icon}</div>
                <div style={{ fontWeight: 900, fontSize: '1.6rem', color: tierStyles[i].color, marginBottom: 4 }}>{tier.amount}</div>
                <div style={{ fontWeight: 700, color: '#111827', marginBottom: 6 }}>{tier.label}</div>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af', lineHeight: 1.4 }}>{tier.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Russia payments */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#111827', marginBottom: 16 }}>{t('russia_title')}</h2>
          <a href="https://pay.cloudtips.ru/p/76b1a873" target="_blank" rel="noopener noreferrer"
            style={{ background: '#fff', borderRadius: 16, border: '1px solid #e0f2fe', padding: '20px 24px', textDecoration: 'none', display: 'block' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 22 }}>☁️</span>
              <span style={{ fontWeight: 700, color: '#0284c7', fontSize: '0.95rem' }}>CloudTips</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#0284c7', background: '#e0f2fe', padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>Тинькофф · СБП · карта</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#9ca3af', margin: 0 }}>{t('russia_desc')}</p>
          </a>
        </section>

        {/* Crypto */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#111827', marginBottom: 16 }}>{t('crypto_title')}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e9d5ff', padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 20 }}>⛓️</span>
                <span style={{ fontWeight: 700, color: '#7c3aed', fontSize: '0.9rem' }}>Aptos (APT)</span>
              </div>
              <p style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#374151', wordBreak: 'break-all', background: '#faf5ff', borderRadius: 10, padding: '12px 16px', margin: 0, lineHeight: 1.6 }}>
                0xbddd0085d25edf5c3be3f5bf01a36d90d87c4adc5a08ec8b5bef7bdfc8e8a4b9
              </p>
            </div>
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 20 }}>🔷</span>
                <span style={{ fontWeight: 700, color: '#6b7280', fontSize: '0.9rem' }}>Ethereum / USDC</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#9ca3af', margin: 0 }}>
                {t('crypto_eth_desc').split('hello@homosapience.org')[0]}
                <a href="mailto:hello@homosapience.org" style={{ color: '#7c3aed', textDecoration: 'none', fontWeight: 600 }}>hello@homosapience.org</a>
                {t('crypto_eth_desc').split('hello@homosapience.org')[1]}
              </p>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section style={{ background: 'linear-gradient(135deg,#2d1b69,#4c1d95)', borderRadius: 22, padding: '36px 32px', textAlign: 'center' }}>
          <h3 style={{ color: '#fff', fontWeight: 900, fontSize: '1.2rem', marginBottom: 10 }}>{t('contact_title')}</h3>
          <p style={{ color: '#c4b5fd', marginBottom: 24, fontSize: '0.95rem' }}>{t('contact_desc')}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="https://t.me/aptogon" target="_blank" rel="noopener noreferrer"
              style={{ padding: '12px 28px', background: '#fff', color: '#0088cc', fontWeight: 700, borderRadius: 12, textDecoration: 'none' }}>
              {t('cta_telegram')}
            </a>
            <a href="mailto:hello@homosapience.org"
              style={{ padding: '12px 28px', background: 'rgba(255,255,255,0.1)', color: '#c4b5fd', fontWeight: 700, borderRadius: 12, textDecoration: 'none' }}>
              {t('cta_email')}
            </a>
            <Link href="/"
              style={{ padding: '12px 28px', background: 'rgba(255,255,255,0.05)', color: '#c4b5fd', fontWeight: 600, borderRadius: 12, textDecoration: 'none' }}>
              {t('cta_home')}
            </Link>
          </div>
        </section>

      </div>
    </div>
  )
}
