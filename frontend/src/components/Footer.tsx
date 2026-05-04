import Link from 'next/link'

const LINKS = [
  { href: '/manifest', label: 'Manifest', color: '#a78bfa' },
  { href: '/developers', label: 'Developers', color: '#67e8f9' },
  { href: '/donate', label: 'Donate', color: '#86efac' },
  { href: '/verify', label: 'Verify', color: '#fbbf24' },
]

const SOCIAL = [
  { href: 'https://t.me/aptogon', label: '✈️ Telegram', color: '#38bdf8' },
  { href: 'https://github.com/homosapience', label: '⭐ GitHub', color: '#94a3b8' },
]

export default function Footer() {
  return (
    <footer style={{
      background: '#0a0f1a',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      padding: '40px 24px 28px',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Top row: logo + links */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 32, marginBottom: 32 }}>

          {/* Brand */}
          <div>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
                <span style={{ color: '#f1f5f9' }}>APT</span>
                <span style={{ color: '#06b6d4' }}>O</span>
                <span style={{ background: 'linear-gradient(90deg,#7c3aed,#db2777)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>GON</span>
              </span>
            </Link>
            <p style={{ fontSize: 12, color: '#475569', marginTop: 6, maxWidth: 200, lineHeight: 1.5 }}>
              Human Firewall for the Internet
            </p>
          </div>

          {/* Nav links — one row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            {LINKS.map(l => (
              <Link key={l.href} href={l.href} style={{ color: l.color, fontSize: 14, fontWeight: 600, textDecoration: 'none', opacity: 0.85 }}>
                {l.label}
              </Link>
            ))}
            <span style={{ color: '#1e293b' }}>·</span>
            {SOCIAL.map(s => (
              <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer"
                style={{ color: s.color, fontSize: 14, fontWeight: 600, textDecoration: 'none', opacity: 0.85 }}>
                {s.label}
              </a>
            ))}
          </div>
        </div>

        {/* Bottom row */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ fontSize: 12, color: '#334155', margin: 0 }}>
            © 2025 Homo Sapience Internet · Open Source · MIT License
          </p>
          <p style={{ fontSize: 12, color: '#1e293b', margin: 0 }}>
            v0.2.0 · Gonka AI · Aptos Testnet
          </p>
        </div>
      </div>
    </footer>
  )
}
