'use client'
import Link from 'next/link'
import { useState } from 'react'

const CARDS = [
  {
    id: 'gesture',
    icon: '✍️',
    title: 'Жест',
    subtitle: 'Human Expression',
    bg: '#7c3aed',
    modal: {
      title: 'Жест как доказательство',
      body: 'Ты рисуешь линию мышью или пальцем. ИИ анализирует не форму рисунка, а биометрические параметры движения: вариативность скорости, паузы, количество поправок, нерегулярность ритма. Боты двигаются идеально — люди нет.',
      tags: ['velocity_std', 'pause_entropy', 'corrections', 'rhythm'],
    },
  },
  {
    id: 'ai',
    icon: '🧠',
    title: 'Gonka AI',
    subtitle: 'Qwen3-14B',
    bg: '#db2777',
    modal: {
      title: 'Анализ паттерна',
      body: 'Qwen3-14B (через OpenRouter) получает только статистический вектор жеста — без координат, без личных данных. Оценивает 8 параметров и возвращает: is_human, confidence (0–1), reasoning. Порог для прохождения: 85%.',
      tags: ['qwen3-14b', 'OpenRouter', 'JSON response', 'confidence > 0.85'],
    },
  },
  {
    id: 'did',
    icon: '🔑',
    title: 'DID:key',
    subtitle: 'W3C Standard',
    bg: '#0891b2',
    modal: {
      title: 'Децентрализованный идентификатор',
      body: 'В браузере генерируется пара ключей Ed25519. Публичный ключ кодируется в формат did:key по стандарту W3C. Никаких серверов, никакой регистрации, никакого Ceramic — ключ существует только в localStorage твоего браузера.',
      tags: ['Ed25519', 'W3C DID', 'In-browser', 'localStorage'],
    },
  },
  {
    id: 'aptos',
    icon: '⛓️',
    title: 'Aptos',
    subtitle: 'Blockchain',
    bg: '#2563eb',
    modal: {
      title: 'Запись в блокчейн',
      body: 'SHA3-256 хэш доказательства (ExpressionProof) записывается в Move смарт-контракт на Aptos. Хэш не содержит личных данных — только статистику жеста, session_id и временной бакет (1 час). Неизменяемо и верифицируемо.',
      tags: ['Move', 'SHA3-256', 'ExpressionProof', 'Testnet'],
    },
  },
  {
    id: 'privacy',
    icon: '🛡️',
    title: 'Приватность',
    subtitle: 'Zero PII',
    bg: '#059669',
    modal: {
      title: 'Нулевые личные данные',
      body: 'Сырые координаты обрабатываются только на устройстве. На сервер отправляется только статистический вектор (8 чисел). В блокчейн — только хэш. Ни имя, ни email, ни IP не собираются и не хранятся.',
      tags: ['on-device', 'no coordinates', 'no PII', 'no tracking'],
    },
  },
  {
    id: 'bond',
    icon: '🤝',
    title: 'HSI Bond',
    subtitle: 'Human Network',
    bg: '#d97706',
    modal: {
      title: 'Human Bond System',
      body: 'Верифицированные люди могут поручиться друг за друга через HSI Bond. Каждое поручительство усиливает HumanCredential. Боты не могут получить поручительства от реальных людей — это дополнительный уровень защиты.',
      tags: ['bonding', 'social proof', 'HumanCredential', 'anti-sybil'],
    },
  },
]

const STEPS = [
  { n: '01', icon: '✍️', title: 'Нарисуй жест', desc: 'Линия или фигура на экране — скорость, паузы, ритм', bg: '#7c3aed' },
  { n: '02', icon: '🧠', title: 'Gonka AI анализирует', desc: '8 биометрических параметров — боты двигаются идеально', bg: '#db2777' },
  { n: '03', icon: '🔑', title: 'Генерируется DID', desc: 'Ed25519 ключ прямо в браузере — без серверов', bg: '#0891b2' },
  { n: '04', icon: '⛓️', title: 'Запись в Aptos', desc: 'ExpressionProof хэш — анонимно и навсегда', bg: '#2563eb' },
]

export default function Home() {
  const [modal, setModal] = useState<typeof CARDS[0] | null>(null)

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── HERO ── */}
      <section style={{ background: 'linear-gradient(135deg, #ede9fe 0%, #f0f9ff 60%, #fdf4ff 100%)', padding: '80px 24px 60px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: 400, height: 400, borderRadius: '50%', background: 'rgba(124,58,237,0.08)', filter: 'blur(80px)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 700, margin: '0 auto' }}>
          <span style={{ display: 'inline-block', fontSize: 11, letterSpacing: '0.25em', fontWeight: 700, color: '#7c3aed', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 99, padding: '6px 16px', marginBottom: 24, textTransform: 'uppercase' }}>
            v0.2.0 · Gonka AI · did:key · Aptos Testnet
          </span>
          <h1 style={{ fontSize: 'clamp(3rem,11vw,6rem)', fontWeight: 900, lineHeight: 1, marginBottom: 20, letterSpacing: '-0.02em' }}>
            <span style={{ color: '#111827' }}>APT</span>
            <span style={{ color: '#0891b2' }}>O</span>
            <span style={{ background: 'linear-gradient(90deg,#7c3aed,#db2777)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>GON</span>
          </h1>
          <p style={{ fontSize: 'clamp(1.1rem,3vw,1.5rem)', fontWeight: 600, color: '#1e293b', marginBottom: 12 }}>Human Firewall для интернета</p>
          <p style={{ fontSize: '1.05rem', color: '#64748b', marginBottom: 36, maxWidth: 500, margin: '0 auto 36px' }}>
            Докажи, что ты человек — жестом. Без пароля, без email, без слежки.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 28 }}>
            <Link href="/verify" style={{ padding: '14px 36px', background: 'linear-gradient(135deg,#7c3aed,#2563eb)', color: '#fff', fontWeight: 700, fontSize: '1.05rem', borderRadius: 14, textDecoration: 'none', boxShadow: '0 6px 24px rgba(124,58,237,0.3)' }}>
              ✍️ Пройти верификацию
            </Link>
            <Link href="/chat" style={{ padding: '14px 28px', background: '#fff', color: '#374151', fontWeight: 600, fontSize: '1.05rem', borderRadius: 14, textDecoration: 'none', border: '1.5px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              💬 Чат
            </Link>
          </div>
          <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="#manifest" style={{ color: '#7c3aed', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none' }}>📜 Manifest</a>
            <a href="#developers" style={{ color: '#0891b2', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none' }}>⚡ Developers</a>
            <a href="#donate" style={{ color: '#059669', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none' }}>🤝 Donate</a>
          </div>
        </div>
      </section>

      {/* ── КАРТОЧКИ ТЕХНОЛОГИЙ ── */}
      <section style={{ padding: '64px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontWeight: 900, fontSize: '1.6rem', color: '#111827', marginBottom: 8 }}>Технологии</p>
          <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: 40 }}>Нажми на блок чтобы узнать подробнее</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
            {CARDS.map(card => (
              <button
                key={card.id}
                onClick={() => setModal(card)}
                style={{
                  background: card.bg,
                  border: 'none',
                  borderRadius: 20,
                  padding: '28px 16px 24px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  color: '#fff',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 28px rgba(0,0,0,0.18)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)' }}
              >
                <div style={{ fontSize: 36, marginBottom: 10 }}>{card.icon}</div>
                <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 4 }}>{card.title}</div>
                <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 500 }}>{card.subtitle}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── КАК РАБОТАЕТ — горизонтальная схема ── */}
      <section style={{ padding: '64px 24px', background: '#f1f5f9' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontWeight: 900, fontSize: '1.6rem', color: '#111827', marginBottom: 8 }}>Как работает верификация</p>
          <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: 40 }}>4 шага · 10 секунд · ноль личных данных</p>

          <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', flexWrap: 'nowrap', overflowX: 'auto' }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 180 }}>
                <div style={{ background: s.bg, borderRadius: 20, padding: '28px 20px', color: '#fff', flex: 1 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 6 }}>Шаг {s.n}</div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 8 }}>{s.title}</div>
                  <p style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.5 }}>{s.desc}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ padding: '0 8px', color: '#94a3b8', fontSize: 20, fontWeight: 900, flexShrink: 0 }}>→</div>
                )}
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Link href="/verify" style={{ display: 'inline-block', padding: '14px 40px', background: 'linear-gradient(135deg,#7c3aed,#2563eb)', color: '#fff', fontWeight: 700, fontSize: '1rem', borderRadius: 14, textDecoration: 'none' }}>
              Начать верификацию →
            </Link>
          </div>
        </div>
      </section>

      {/* ── MANIFEST / DEVELOPERS / DONATE ── */}
      <section style={{ padding: '72px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontWeight: 900, fontSize: '1.6rem', color: '#111827', marginBottom: 8 }}>Присоединяйся</p>
          <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: 40 }}>Мы строим публичную инфраструктуру для человеческого интернета</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
            <Link href="/manifest" style={{ textDecoration: 'none', display: 'block', borderRadius: 22, overflow: 'hidden', boxShadow: '0 4px 20px rgba(124,58,237,0.15)', transition: 'transform 0.15s' }}>
              <div style={{ background: 'linear-gradient(145deg, #0f172a, #1e1b4b)', padding: '36px 28px' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>📜</div>
                <div style={{ fontWeight: 900, fontSize: '1.3rem', color: '#fff', marginBottom: 8 }}>Manifest</div>
                <p style={{ fontSize: '0.875rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: 20 }}>Почему мы строим HSI, как это изменит интернет и какое место в нём займёт каждый человек.</p>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Читать →</span>
              </div>
            </Link>

            <Link href="/developers" style={{ textDecoration: 'none', display: 'block', borderRadius: 22, overflow: 'hidden', boxShadow: '0 4px 20px rgba(8,145,178,0.15)', transition: 'transform 0.15s' }}>
              <div style={{ background: 'linear-gradient(145deg, #0c1a2e, #0a2540)', padding: '36px 28px' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>⚡</div>
                <div style={{ fontWeight: 900, fontSize: '1.3rem', color: '#fff', marginBottom: 8 }}>Developers</div>
                <p style={{ fontSize: '0.875rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: 20 }}>REST API, SDK, примеры интеграции. Добавь человеческую верификацию в своё приложение за час.</p>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#67e8f9', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Docs →</span>
              </div>
            </Link>

            <Link href="/donate" style={{ textDecoration: 'none', display: 'block', borderRadius: 22, overflow: 'hidden', boxShadow: '0 4px 20px rgba(124,58,237,0.1)', transition: 'transform 0.15s' }}>
              <div style={{ background: 'linear-gradient(145deg, #2d1b69, #4c1d95)', padding: '36px 28px' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🤝</div>
                <div style={{ fontWeight: 900, fontSize: '1.3rem', color: '#fff', marginBottom: 8 }}>Поддержать</div>
                <p style={{ fontSize: '0.875rem', color: '#c4b5fd', lineHeight: 1.6, marginBottom: 20 }}>Открытый проект без венчурного финансирования. Помоги нам развивать публичную инфраструктуру.</p>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#e9d5ff', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Donate →</span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ padding: '32px 24px', textAlign: 'center', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 28, marginBottom: 12, flexWrap: 'wrap' }}>
          <Link href="/manifest" style={{ color: '#7c3aed', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>Manifest</Link>
          <Link href="/developers" style={{ color: '#6b7280', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>Developers</Link>
          <Link href="/donate" style={{ color: '#6b7280', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>Donate</Link>
          <a href="https://homosapience.org" target="_blank" rel="noopener" style={{ color: '#6b7280', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>homosapience.org</a>
        </div>
        <p style={{ fontSize: 13, color: '#94a3b8' }}>APTOGON v0.2.0 · Human Firewall Infrastructure · Open Source</p>
      </footer>


      {/* ── МОДАЛЬНОЕ ОКНО ── */}
      {modal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setModal(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 24, padding: '36px 32px', maxWidth: 480, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.2)', position: 'relative' }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setModal(null)}
              style={{ position: 'absolute', top: 16, right: 16, background: '#f1f5f9', border: 'none', borderRadius: 99, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >✕</button>

            <div style={{ width: 56, height: 56, borderRadius: 16, background: modal.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 20 }}>
              {modal.icon}
            </div>
            <h2 style={{ fontWeight: 800, fontSize: '1.3rem', color: '#111827', marginBottom: 12 }}>{modal.modal.title}</h2>
            <p style={{ color: '#4b5563', lineHeight: 1.7, marginBottom: 20, fontSize: '0.95rem' }}>{modal.modal.body}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {modal.modal.tags.map(t => (
                <span key={t} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 99, background: modal.bg + '18', color: modal.bg, border: `1px solid ${modal.bg}33` }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
