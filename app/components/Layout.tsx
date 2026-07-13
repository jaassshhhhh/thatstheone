'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Logo from './Logo'

const tabs = [
  { label: 'Feed',     href: '/feed',     icon: 'ti-layout-grid' },
  { label: 'Search',   href: '/search',   icon: 'ti-search' },
  { label: 'Trending', href: '/trending', icon: 'ti-trending-up' },
  { label: 'Creators', href: '/creators', icon: 'ti-users' },
  { label: 'Brands',   href: '/brands',   icon: 'ti-building-store' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div style={{ background: '#0F0C1E', minHeight: '100vh', fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif', color: '#fff' }}>

      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px',
        background: 'rgba(15,12,30,.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,.06)',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <Logo size={26} />
          <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-.02em', color: '#fff' }}>that's the one</span>
        </Link>

        <div style={{ display: 'flex', gap: 4 }} className="desktop-nav">
          {tabs.map(t => (
            <Link key={t.href} href={t.href} style={{
              fontSize: 13, padding: '6px 14px', borderRadius: 8, textDecoration: 'none',
              color: pathname === t.href || pathname.startsWith(t.href + '/') ? '#00E5FF' : 'rgba(255,255,255,.4)',
              background: pathname === t.href || pathname.startsWith(t.href + '/') ? 'rgba(0,229,255,.15)' : 'transparent',
              transition: 'all .15s',
            }}>
              {t.label}
            </Link>
          ))}
        </div>

        <div style={{ width: 80, display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/profile" style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,229,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#00E5FF', textDecoration: 'none', cursor: 'pointer' }}>J</Link>
        </div>
      </nav>

      <div style={{ paddingTop: 60, paddingBottom: 80 }}>
        {children}
      </div>

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex',
        background: 'rgba(15,12,30,.95)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,.06)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }} className="mobile-nav">
        {tabs.map(t => {
          const active = pathname === t.href || pathname.startsWith(t.href + '/')
          return (
            <Link key={t.href} href={t.href} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '8px 0 6px', textDecoration: 'none', gap: 2,
              color: active ? '#00E5FF' : 'rgba(255,255,255,.3)',
              transition: 'color .15s',
            }}>
              <i className={`ti ${t.icon}`} style={{ fontSize: 18 }} aria-hidden="true" />
              <span style={{ fontSize: 9, letterSpacing: '.02em' }}>{t.label}</span>
              {active && <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#FFF23C' }} />}
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