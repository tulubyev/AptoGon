'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LangSwitcher from './LangSwitcher'

const NAV_LINKS = [
  { href: '/manifest', label: 'Manifest' },
  { href: '/developers', label: 'Developers' },
  { href: '/donate', label: 'Donate' },
  { href: '/verify', label: 'Verify' },
]

const SOCIAL = [
  { href: 'https://t.me/aptogon', label: '✈️', title: 'Telegram' },
  { href: 'https://github.com/homosapience', label: '⭐', title: 'GitHub' },
]

export default function Header() {
  const pathname = usePathname()

  // Strip locale prefix to get clean path for active detection
  const cleanPath = '/' + pathname.split('/').slice(2).join('/')

  return (
    <header style={{
      background: 'rgba(10, 15, 26, 0.95)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      padding: '0 24px',
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>

      {/* Logo */}
      <Link href="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
        <span style={{ fontSize: '1.15rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
          <span style={{ color: '#f1f5f9' }}>APT</span>
          <span style={{ color: '#06b6d4' }}>O</span>
          <span style={{ background: 'linear-gradient(90deg,#7c3aed,#db2777)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>GON</span>
        </span>
      </Link>

      {/* Nav links — hidden on mobile */}
      <nav style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {NAV_LINKS.map(link => {
          const isActive = cleanPath.startsWith(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                color: isActive ? '#fff' : '#64748b',
                background: isActive ? 'rgba(124,58,237,0.2)' : 'transparent',
                border: isActive ? '1px solid rgba(124,58,237,0.35)' : '1px solid transparent',
                transition: 'color 0.15s, background 0.15s',
              }}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>

      {/* Right: social + lang */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {SOCIAL.map(s => (
          <a
            key={s.href}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            title={s.title}
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              fontSize: 15,
              textDecoration: 'none',
              transition: 'background 0.15s',
            }}
          >
            {s.label}
          </a>
        ))}
        <LangSwitcher />
      </div>
    </header>
  )
}
