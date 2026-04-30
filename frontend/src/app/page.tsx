'use client'
import Link from 'next/link'
export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <span className="text-xs tracking-[0.3em] text-cyan-400 font-bold mb-6 uppercase">v0.2.0 · Gonka AI · did:key · Aptos</span>
      <h1 className="text-7xl md:text-9xl font-black tracking-tight mb-4">
        <span className="text-white">APT</span><span className="text-cyan-400">O</span><span className="text-purple-400">GON</span>
      </h1>
      <p className="text-xl text-slate-400 mb-2">Human Firewall для интернета</p>
      <p className="text-sm text-slate-600 mb-10">Без Cosmos SDK · Без Ceramic · Только суть</p>
      <div className="grid grid-cols-3 gap-4 mb-8 max-w-lg w-full">
        {[
          { icon: '🤖', title: 'Gonka AI', sub: 'Верификация жеста', color: 'border-purple-500/30' },
          { icon: '🔑', title: 'did:key', sub: 'W3C DID без серверов', color: 'border-cyan-500/30' },
          { icon: '⛓', title: 'Aptos', sub: 'HumanCredential', color: 'border-blue-500/30' },
        ].map(c => (
          <div key={c.title} className={`bg-[#1a2235] rounded-xl border ${c.color} p-4`}>
            <div className="text-2xl mb-1">{c.icon}</div>
            <div className="font-bold text-white text-sm">{c.title}</div>
            <div className="text-xs text-slate-500">{c.sub}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mb-10 text-xs text-slate-600">
        {['✗ Cosmos SDK убран', '✗ Ceramic убран', '✗ IBC убран'].map(t => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link href="/verify" className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors">🔑 Верифицироваться</Link>
        <Link href="/chat" className="px-8 py-4 bg-[#1a2235] text-white font-bold rounded-lg border border-cyan-500/30 hover:border-cyan-500/60 transition-colors">💬 Чат</Link>
        <Link href="/governance" className="px-8 py-4 bg-[#1a2235] text-white font-bold rounded-lg border border-slate-700 hover:border-slate-500 transition-colors">🗳 Governance</Link>
      </div>
    </main>
  )
}
