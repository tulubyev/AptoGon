'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

interface Message {
  id: string
  sender_short: string
  content: string
  room: string
  timestamp: number
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [botMessages, setBotMessages] = useState<string[]>([])
  const [showBotDemo, setShowBotDemo] = useState(false)
  const [isVerified, setIsVerified] = useState(true)  // для демо считаем верифицированным
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Демо сообщения при загрузке
  useEffect(() => {
    setMessages([
      { id: '1', sender_short: 'a1b2c3d4', content: 'Привет всем! Рад быть здесь, это первый чат где я точно знаю что общаюсь с людьми', room: 'agora', timestamp: Date.now() - 120000 },
      { id: '2', sender_short: 'e5f6g7h8', content: 'Да, Aptos зафиксировал мой credential 10 минут назад. Верификация заняла ~30 секунд', room: 'agora', timestamp: Date.now() - 90000 },
      { id: '3', sender_short: 'i9j0k1l2', content: 'Интересно, Gonka AI корректно определил паттерн моего жеста несмотря на то что у меня немного трясётся рука', room: 'agora', timestamp: Date.now() - 60000 },
    ])
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, botMessages])

  const sendMessage = async () => {
    if (!input.trim() || sending) return
    setSending(true)
    const content = input
    setInput('')

    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-HSI-DID-Token': 'demo-verified-human-token',
        },
        body: JSON.stringify({ content, room: 'agora' }),
      })
      if (res.ok) {
        const msg = await res.json()
        setMessages(prev => [...prev, msg])
      } else if (res.status === 403) {
        alert('Нужен HSI credential. Сначала верифицируйся.')
      }
    } catch {
      // Если бэкенд недоступен — добавляем локально для демо
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender_short: 'demo',
        content,
        room: 'agora',
        timestamp: Date.now(),
      }])
    } finally {
      setSending(false)
    }
  }

  const launchBotAttack = () => {
    setShowBotDemo(true)
    setBotMessages([])
    const botPhrases = [
      '🤖 Buy crypto! Best rates!',
      '🤖 Click here for free tokens',
      '🤖 Investment opportunity!',
      '🤖 Limited offer, act now!',
      '🤖 Earn 500% APY guaranteed',
    ]
    botPhrases.forEach((phrase, i) => {
      setTimeout(() => {
        setBotMessages(prev => {
          const next = [...prev, phrase]
          return next
        })
      }, i * 400)
    })
  }

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-[#111827] border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-500 hover:text-white">←</Link>
          <div>
            <h1 className="font-bold text-white">HSI Агора</h1>
            <p className="text-xs text-green-400">🟢 Только верифицированные люди</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
            🔑 credential: demo
          </span>
          <Link href="/verify" className="text-xs text-blue-400 hover:text-blue-300">
            Верифицироваться
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main chat */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map(msg => (
              <div key={msg.id} className="flex gap-3">
                <div className="w-8 h-8 bg-blue-600/20 border border-blue-500/30 rounded-full flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0">
                  {msg.sender_short.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-slate-500 font-mono">{msg.sender_short}</span>
                    <span className="text-xs text-green-400">✓ верифицирован</span>
                    <span className="text-xs text-slate-600">{formatTime(msg.timestamp)}</span>
                  </div>
                  <p className="text-slate-200 text-sm bg-[#1a2235] rounded-lg px-3 py-2 inline-block">
                    {msg.content}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-800 p-4 flex gap-3">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Сообщение в агору..."
              className="flex-1 bg-[#111827] border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-lg transition-colors"
            >
              ↑
            </button>
          </div>
        </div>

        {/* Right panel: Bot Demo */}
        <div className="w-80 bg-[#0d1525] border-l border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-800">
            <h3 className="font-bold text-white text-sm mb-1">⚡ Демо: Human Firewall</h3>
            <p className="text-xs text-slate-500">Смотри разницу между обычным интернетом и HSI</p>
          </div>

          <div className="flex-1 p-4 space-y-4">
            {/* Bot attack demo */}
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
              <h4 className="text-red-400 font-bold text-xs mb-2 uppercase tracking-wide">
                🤖 Обычный интернет
              </h4>
              {!showBotDemo ? (
                <button
                  onClick={launchBotAttack}
                  className="w-full py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-bold rounded border border-red-500/30 transition-colors"
                >
                  Запустить бот-атаку
                </button>
              ) : (
                <div className="space-y-1">
                  {botMessages.map((m, i) => (
                    <div key={i} className="text-xs text-red-300 font-mono bg-red-900/20 px-2 py-1 rounded">
                      {m}
                    </div>
                  ))}
                  {botMessages.length === 5 && (
                    <p className="text-xs text-red-500 mt-2 italic">5 сообщений за 2 секунды</p>
                  )}
                </div>
              )}
            </div>

            {/* HSI protection */}
            <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
              <h4 className="text-green-400 font-bold text-xs mb-2 uppercase tracking-wide">
                🛡 HSI Firewall
              </h4>
              {showBotDemo && (
                <div className="space-y-1">
                  {botMessages.map((_, i) => (
                    <div key={i} className="text-xs text-red-400 font-mono bg-red-900/10 px-2 py-1 rounded">
                      ✗ 403 — Human credential required
                    </div>
                  ))}
                  {botMessages.length === 5 && (
                    <p className="text-xs text-green-400 mt-2 italic">
                      ✓ Все боты заблокированы
                    </p>
                  )}
                </div>
              )}
              {!showBotDemo && (
                <p className="text-xs text-slate-500">Запусти атаку выше чтобы увидеть защиту</p>
              )}
            </div>

            {/* Stats */}
            <div className="bg-[#1a2235] rounded-xl p-4">
              <h4 className="text-slate-400 font-bold text-xs mb-3 uppercase tracking-wide">Live статистика</h4>
              <div className="space-y-2">
                {[
                  { label: 'Верифицированных', val: '3', color: 'text-green-400' },
                  { label: 'Заблокировано ботов', val: showBotDemo ? '5' : '0', color: 'text-red-400' },
                  { label: 'Проверок Gonka AI', val: showBotDemo ? '5' : '0', color: 'text-blue-400' },
                ].map(s => (
                  <div key={s.label} className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">{s.label}</span>
                    <span className={`text-sm font-bold ${s.color}`}>{s.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
