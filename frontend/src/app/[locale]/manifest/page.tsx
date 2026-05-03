import Link from 'next/link'

export default function ManifestPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)', padding: '72px 24px 60px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.25em', color: '#7c3aed', textTransform: 'uppercase', marginBottom: 16 }}>homosapience.org</p>
        <h1 style={{ fontSize: 'clamp(2rem,6vw,3.5rem)', fontWeight: 900, color: '#fff', marginBottom: 16, lineHeight: 1.1 }}>
          Homo Sapience<br /><span style={{ background: 'linear-gradient(90deg,#a78bfa,#67e8f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Manifest</span>
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '1.05rem', maxWidth: 500, margin: '0 auto' }}>
          Интернет строился людьми — для людей. Пришло время это защитить.
        </p>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '64px 24px' }}>

        <section style={{ marginBottom: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 4, height: 40, background: 'linear-gradient(180deg,#7c3aed,#06b6d4)', borderRadius: 4, flexShrink: 0 }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#e2e8f0' }}>Проблема</h2>
          </div>
          <div style={{ color: '#94a3b8', lineHeight: 1.85, fontSize: '1.05rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ color: '#cbd5e1', fontWeight: 500 }}>
              К 2025 году большинство трафика в интернете генерируется не людьми. Боты пишут комментарии, накручивают голоса, оставляют отзывы, проходят регистрацию, участвуют в опросах. Цифровое пространство потеряло главное свойство — оно перестало быть человеческим.
            </p>
            <p>
              <strong style={{ color: '#a5b4fc' }}>Проблема глубже, чем кажется.</strong> Существующие решения — CAPTCHA, SMS-верификация, KYC — либо легко обходятся, либо требуют раскрытия личности. Нет ни одного открытого стандарта, который позволяет доказать человечность анонимно.
            </p>
            <p>
              Любой может создать тысячу аккаунтов. Любой бот может написать «я человек». Ни один сервис сегодня не может проверить это утверждение — без паспорта, без слежки, без централизованной базы данных.
            </p>
          </div>
        </section>

        <section style={{ marginBottom: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 4, height: 40, background: 'linear-gradient(180deg,#06b6d4,#7c3aed)', borderRadius: 4, flexShrink: 0 }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#e2e8f0' }}>Решение: HSI как протокол</h2>
          </div>
          <div style={{ color: '#94a3b8', lineHeight: 1.85, fontSize: '1.05rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p>
              HSI (Homo Sapience Internet) — это не замена интернету. Это <strong style={{ color: '#67e8f9' }}>протокол поверх IP</strong>, как HTTPS поверх HTTP. Он добавляет один новый примитив: <em style={{ color: '#a5b4fc' }}>HumanCredential</em> — криптографически верифицированное доказательство того, что за действием стоит живой человек.
            </p>
            <p>
              Верификация основана на биометрии движения, а не на личности. ИИ анализирует жест — не координаты, не форму, а статистику: вариативность скорости, энтропию пауз, количество поправок, нерегулярность ритма. Это то, что боты не умеют имитировать достаточно хорошо.
            </p>
            <div style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 16, padding: '20px 24px' }}>
              <p style={{ color: '#c4b5fd', fontWeight: 700, marginBottom: 12 }}>Принцип работы</p>
              <ol style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, color: '#94a3b8' }}>
                <li>Пользователь рисует жест → статистика обрабатывается на устройстве</li>
                <li>Анонимный вектор (без координат) отправляется в Gonka AI</li>
                <li>Результат: is_human + confidence — без личных данных</li>
                <li>При успехе генерируется Ed25519 DID в браузере</li>
                <li>SHA3-256 хэш доказательства записывается в Aptos</li>
              </ol>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 4, height: 40, background: 'linear-gradient(180deg,#059669,#0891b2)', borderRadius: 4, flexShrink: 0 }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#e2e8f0' }}>Практическое применение</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: '🌐', title: 'Форумы и платформы', desc: 'SDK встраивается в 2 строки кода. Спам исчезает — не потому что он заблокирован, а потому что его некому писать. Рейтинги, голоса и лайки снова отражают реальное мнение людей.' },
              { icon: '🗳️', title: 'DAO и голосования', desc: 'Один человек — один голос. Без Sybil-атак, без накрутки. Governance токены защищены не только количеством, но и доказательством человечности.' },
              { icon: '💬', title: 'Чаты и комментарии', desc: 'Верифицированный значок Human появляется у реальных людей. Качество дискуссий меняется мгновенно — не цензурой, а доверием к источнику.' },
              { icon: '🛒', title: 'Маркетплейсы', desc: 'Отзывы оставляют живые покупатели, а не боты конкурентов. Рейтинги снова работают как индикатор качества.' },
              { icon: '🎓', title: 'Образование', desc: 'Экзамен сдал человек, не GPT. Онлайн-диплом имеет смысл, если есть доказательство того, кто его получил.' },
              { icon: '🤖', title: 'AI-агенты', desc: 'Парадокс: HSI помогает AI-агентам правильно действовать. Агент может доказать что действует от имени верифицированного человека — с его явного разрешения.' },
            ].map(item => (
              <div key={item.title} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '20px 22px', display: 'flex', gap: 16 }}>
                <span style={{ fontSize: 28, flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>{item.title}</div>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.65, margin: 0 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 4, height: 40, background: 'linear-gradient(180deg,#d97706,#7c3aed)', borderRadius: 4, flexShrink: 0 }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#e2e8f0' }}>Монетизация и устойчивость</h2>
          </div>
          <div style={{ color: '#94a3b8', lineHeight: 1.85, fontSize: '1.05rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p>
              HSI существует как открытый протокол с несколькими уровнями. <strong style={{ color: '#fcd34d' }}>Верификация для людей — всегда бесплатна.</strong> Это принципиально: человек не должен платить за право доказать свою человечность.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {[
                { title: 'Бесплатно', sub: 'для людей', icon: '👤', color: '#059669' },
                { title: 'SaaS API', sub: 'для платформ', icon: '🔌', color: '#2563eb' },
                { title: 'Enterprise', sub: 'on-premise SDK', icon: '🏢', color: '#7c3aed' },
                { title: 'GNK Токен', sub: 'governance', icon: '🪙', color: '#d97706' },
              ].map(t => (
                <div key={t.title} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '16px 18px', border: `1px solid ${t.color}30` }}>
                  <span style={{ fontSize: 24 }}>{t.icon}</span>
                  <div style={{ fontWeight: 800, color: t.color, marginTop: 8 }}>{t.title}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{t.sub}</div>
                </div>
              ))}
            </div>
            <p>
              Платформы платят за верификацию своих пользователей — так же как сейчас платят за reCAPTCHA и fraud detection, только честнее, прозрачнее и без передачи данных третьим сторонам.
            </p>
          </div>
        </section>

        <section style={{ marginBottom: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 4, height: 40, background: 'linear-gradient(180deg,#db2777,#7c3aed)', borderRadius: 4, flexShrink: 0 }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#e2e8f0' }}>Как привлекать людей</h2>
          </div>
          <div style={{ color: '#94a3b8', lineHeight: 1.85, fontSize: '1.05rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p>
              Первые участники — сообщества, которым уже больно от ботов. Разработчики на GitHub, авторы на Reddit, DAO-члены в Web3, модераторы форумов. Для них верификация — не барьер, а привилегия.
            </p>
            <p>
              <strong style={{ color: '#f9a8d4' }}>Verified Human badge</strong> на профиле — это новый синий галочки, который нельзя купить. Его нельзя подделать и нельзя передать. Он доказывает не известность — а существование.
            </p>
            <p>
              Сеть растёт через HSI Bond: верифицированные люди могут поручиться друг за друга, усиливая свой credential. Социальное доверие становится криптографически верифицируемым.
            </p>
          </div>
        </section>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 40, textAlign: 'center' }}>
          <p style={{ color: '#475569', fontSize: '1.1rem', fontStyle: 'italic', marginBottom: 32 }}>
            «Интернет не сломан — он просто не знает кто ты. APTOGON это исправляет.»
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/verify" style={{ padding: '12px 28px', background: 'linear-gradient(135deg,#7c3aed,#2563eb)', color: '#fff', fontWeight: 700, borderRadius: 12, textDecoration: 'none' }}>
              ✍️ Пройти верификацию
            </Link>
            <a href="https://t.me/aptogon" target="_blank" rel="noopener noreferrer" style={{ padding: '12px 28px', background: 'rgba(0,136,204,0.15)', color: '#38bdf8', fontWeight: 700, borderRadius: 12, textDecoration: 'none', border: '1px solid rgba(0,136,204,0.3)' }}>
              ✈️ Telegram
            </a>
            <Link href="/developers" style={{ padding: '12px 28px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', fontWeight: 600, borderRadius: 12, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.1)' }}>
              ⚡ Developers
            </Link>
            <Link href="/" style={{ padding: '12px 28px', background: 'transparent', color: '#64748b', fontWeight: 600, borderRadius: 12, textDecoration: 'none' }}>
              ← На главную
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
