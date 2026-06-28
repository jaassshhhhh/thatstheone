'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const tabs = [
    { href: '/feed', label: 'Feed', icon: '◈' },
    { href: '/search', label: 'Search', icon: '⌕' },
    { href: '/trending', label: 'Trending', icon: '↑' },
    { href: '/creators', label: 'Creators', icon: '◎' },
  ]

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div style={{ background: '#060810', minHeight: '100vh', fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif', color: '#fff' }}>

      {/* Top nav — desktop and mobile */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px',
        background: 'rgba(6,8,16,.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,.06)',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>✦</div>
          <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-.02em', color: '#fff' }}>that's the one</span>
        </Link>

        {/* Desktop tab links */}
        <div style={{ display: 'flex', gap: 4 }} className="desktop-nav">
          {tabs.map(t => (
            <Link key={t.href} href={t.href} style={{
              fontSize: 13, padding: '6px 14px', borderRadius: 8, textDecoration: 'none',
              color: pathname === t.href ? '#818CF8' : 'rgba(255,255,255,.4)',
              background: pathname === t.href ? 'rgba(99,102,241,.12)' : 'transparent',
              transition: 'all .15s',
            }}>
              {t.label}
            </Link>
          ))}
        </div>

        <div style={{ width: 80, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(99,102,241,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#818CF8' }}>J</div>
        </div>
      </nav>

      {/* Page content */}
      <div style={{ paddingTop: 60, paddingBottom: 80 }}>
        {children}
      </div>

      {/* Bottom tab bar — mobile */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex',
        background: 'rgba(6,8,16,.95)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,.06)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }} className="mobile-nav">
        {tabs.map(t => {
          const active = pathname === t.href
          return (
            <Link key={t.href} href={t.href} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '10px 0 8px', textDecoration: 'none', gap: 4,
              color: active ? '#818CF8' : 'rgba(255,255,255,.3)',
              transition: 'color .15s',
            }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{t.icon}</span>
              <span style={{ fontSize: 10, letterSpacing: '.02em' }}>{t.label}</span>
              {active && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#6366F1', position: 'absolute', bottom: 6 }} />}
            </Link>
          )
        })}
      </div>

      <style>{`
        .desktop-nav { display: flex; }
        .mobile-nav { display: none; }
        @media (max-width: 640px) {
          .desktop-nav { display: none; }
          .mobile-nav { display: flex !important; }
        }
      `}</style>
    </div>
  )
}