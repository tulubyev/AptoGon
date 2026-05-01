import Link from 'next/link'

export default function DonatePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#faf5ff', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Nav */}
      <nav style={{ borderBottom: '1px solid #e9d5ff', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 12, background: '#fff' }}>
        <Link href="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>← APTOGON</Link>
        <span style={{ color: '#d1d5db' }}>·</span>
        <span style={{ color: '#7c3aed', fontSize: 14, fontWeight: 600 }}>Поддержать</span>
      </nav>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #2d1b69 0%, #4c1d95 100%)', padding: '72px 24px 60px', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🤝</div>
        <h1 style={{ fontSize: 'clamp(2rem,5vw,3rem)', fontWeight: 900, color: '#fff', marginBottom: 16 }}>
          Поддержи проект
        </h1>
        <p style={{ color: '#c4b5fd', fontSize: '1.05rem', maxWidth: 500, margin: '0 auto' }}>
          APTOGON — открытый проект без венчурного финансирования. Мы строим публичную инфраструктуру для человеческого интернета.
        </p>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '64px 24px' }}>

        {/* Why donate */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#111827', marginBottom: 16 }}>Куда идут средства</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: '🧠', title: 'Gonka AI инференс', desc: 'Оплата запросов к Qwen3-14B через OpenRouter для анализа жестов', pct: 45 },
              { icon: '🖥️', title: 'Хостинг и инфра', desc: 'FastAPI бэкенд, Aptos транзакции, CDN для фронтенда', pct: 30 },
              { icon: '👩‍💻', title: 'Разработка', desc: 'SDK, документация, новые функции верификации', pct: 25 },
            ].map(item => (
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

        {/* Tiers */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#111827', marginBottom: 16 }}>Уровни поддержки</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 16 }}>
            {[
              { amount: '$5', label: 'Кофе', desc: '~2 500 верификаций', icon: '☕', color: '#d97706', bg: '#fffbeb' },
              { amount: '$20', label: 'Поддержка', desc: '~10 000 верификаций', icon: '🌱', color: '#059669', bg: '#f0fdf4' },
              { amount: '$100', label: 'Партнёр', desc: 'Имя в контрибьюторах + приоритетный API', icon: '⭐', color: '#7c3aed', bg: '#faf5ff' },
              { amount: '$500', label: 'Спонсор', desc: 'Логотип на сайте + прямая поддержка', icon: '🏆', color: '#1d4ed8', bg: '#eff6ff' },
            ].map(d => (
              <div key={d.amount} style={{ borderRadius: 20, border: `2px solid ${d.color}25`, background: d.bg, padding: '28px 20px', textAlign: 'center', cursor: 'pointer' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{d.icon}</div>
                <div style={{ fontWeight: 900, fontSize: '1.6rem', color: d.color, marginBottom: 4 }}>{d.amount}</div>
                <div style={{ fontWeight: 700, color: '#111827', marginBottom: 6 }}>{d.label}</div>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af', lineHeight: 1.4 }}>{d.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Russian payments */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#111827', marginBottom: 16 }}>Оплата из России</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <a
              href="https://pay.cloudtips.ru/p/homosapience"
              target="_blank"
              rel="noopener noreferrer"
              style={{ background: '#fff', borderRadius: 16, border: '1px solid #e0f2fe', padding: '20px 24px', textDecoration: 'none', display: 'block' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 22 }}>☁️</span>
                <span style={{ fontWeight: 700, color: '#0284c7', fontSize: '0.95rem' }}>CloudTips</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#0284c7', background: '#e0f2fe', padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>Тинькофф · СБП · карта</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#9ca3af', margin: 0 }}>
                Быстрый перевод через Тинькофф Pay, СБП или любую карту РФ
              </p>
            </a>
          </div>
        </section>

        {/* Crypto */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#111827', marginBottom: 16 }}>Криптовалюта</h2>
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
                Напиши на <a href="mailto:hello@homosapience.org" style={{ color: '#7c3aed', textDecoration: 'none', fontWeight: 600 }}>hello@homosapience.org</a> — пришлём адрес
              </p>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section style={{ background: 'linear-gradient(135deg,#2d1b69,#4c1d95)', borderRadius: 22, padding: '36px 32px', textAlign: 'center' }}>
          <h3 style={{ color: '#fff', fontWeight: 900, fontSize: '1.2rem', marginBottom: 10 }}>Хочешь партнёрство или интеграцию?</h3>
          <p style={{ color: '#c4b5fd', marginBottom: 24, fontSize: '0.95rem' }}>Обсудим условия, поставим ранний доступ к API и поможем интегрировать верификацию в твой продукт</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="https://t.me/aptogon" target="_blank" rel="noopener noreferrer" style={{ padding: '12px 28px', background: '#fff', color: '#0088cc', fontWeight: 700, borderRadius: 12, textDecoration: 'none' }}>
              ✈️ Telegram @aptogon
            </a>
            <a href="mailto:hello@homosapience.org" style={{ padding: '12px 28px', background: 'rgba(255,255,255,0.1)', color: '#c4b5fd', fontWeight: 700, borderRadius: 12, textDecoration: 'none' }}>
              📩 hello@homosapience.org
            </a>
            <Link href="/" style={{ padding: '12px 28px', background: 'rgba(255,255,255,0.05)', color: '#c4b5fd', fontWeight: 600, borderRadius: 12, textDecoration: 'none' }}>
              ← На главную
            </Link>
          </div>
        </section>

      </div>
    </div>
  )
}
