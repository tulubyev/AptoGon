import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HSI — Homo Sapience Internet',
  description: 'Возвращаем интернет людям',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-[#0a0e1a] text-slate-200">
        {children}
      </body>
    </html>
  )
}
