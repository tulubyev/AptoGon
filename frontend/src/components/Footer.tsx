export default function Footer() {
  return (
    <footer style={{
      background: '#0a0f1a',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      padding: '20px 24px',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{
        maxWidth: 960,
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <p style={{ fontSize: 12, color: '#334155', margin: 0 }}>
          © 2025 Homo Sapience Internet · Open Source · MIT License
        </p>
        <p style={{ fontSize: 12, color: '#1e293b', margin: 0 }}>
          v0.2.0 · Gonka AI · Aptos Testnet
        </p>
      </div>
    </footer>
  )
}
