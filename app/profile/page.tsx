'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import Link from 'next/link'

const SESSION_KEY = 'tto_session'

function getSession() {
  if (typeof window === 'undefined') return null
  let s = localStorage.getItem(SESSION_KEY)
  if (!s) { s = crypto.randomUUID(); localStorage.setItem(SESSION_KEY, s) }
  return s
}

export default function ProfilePage() {
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [signals, setSignals] = useState<any[]>([])
  const [stats, setStats] = useState({ sponsorships: 0, creators: 0, brands: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProfile()
    const recent = JSON.parse(localStorage.getItem('tto_recent') || '[]')
    setRecentSearches(recent)
  }, [])

  async function loadProfile() {
    setLoading(true)
    const session = getSession()

    const [sponsorships, creators, brands, userSignals] = await Promise.all([
      supabase.from('sponsorships').select('*', { count: 'exact', head: true }),
      supabase.from('creators').select('*', { count: 'exact', head: true }),
      supabase.from('brands').select('*', { count: 'exact', head: true }),
      session ? supabase.from('user_signals').select('*').eq('session_id', session).order('created_at', { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    ])

    setStats({
      sponsorships: sponsorships.count || 0,
      creators: creators.count || 0,
      brands: brands.count || 0,
    })
    setSignals(userSignals.data || [])
    setLoading(false)
  }

  const copied = signals.filter(s => s.signal_type === 'copy')
  const searched = signals.filter(s => s.signal_type === 'search')
  const clicked = signals.filter(s => s.signal_type === 'click')

  const clearHistory = () => {
    localStorage.removeItem('tto_recent')
    setRecentSearches([])
  }

  return (
    <Layout>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px 14px 40px' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#fff', margin: '0 0 3px' }}>Profile</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', margin: 0 }}>Your activity and platform stats</p>
        </div>

        {/* Platform stats */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Platform stats</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {[
              { label: 'Sponsorships', value: stats.sponsorships.toLocaleString(), icon: '◈' },
              { label: 'Creators', value: stats.creators.toLocaleString(), icon: '◎' },
              { label: 'Brands', value: stats.brands.toLocaleString(), icon: '✦' },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,.03)', border: '0.5px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '14px 12px' }}>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', margin: '0 0 6px' }}>{s.icon} {s.label}</p>
                <p style={{ fontSize: 20, fontWeight: 600, color: '#fff', margin: 0 }}>{loading ? '...' : s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Your activity */}
        {(copied.length > 0 || searched.length > 0 || clicked.length > 0) && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Your activity</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {[
                { label: 'Searches', value: searched.length },
                { label: 'Codes copied', value: copied.length },
                { label: 'Deals clicked', value: clicked.length },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,.03)', border: '0.5px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '14px 12px' }}>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', margin: '0 0 6px' }}>{s.label}</p>
                  <p style={{ fontSize: 20, fontWeight: 600, color: '#818CF8', margin: 0 }}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent searches */}
        {recentSearches.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.07em', margin: 0 }}>Recent searches</p>
              <button onClick={clearHistory} style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentSearches.map(r => (
                <Link key={r} href={`/search?q=${encodeURIComponent(r)}`} style={{ textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(255,255,255,.03)', border: '0.5px solid rgba(255,255,255,.07)', borderRadius: 10, transition: 'border-color .15s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,.14)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,.07)'}>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,.2)' }}>↗</span>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>{r}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Codes you copied */}
        {copied.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Codes you copied</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {copied.slice(0, 5).map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,.03)', border: '0.5px solid rgba(255,255,255,.07)', borderRadius: 10 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#818CF8', letterSpacing: '.05em' }}>{s.value}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>copied</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Creator claim CTA */}
        <div style={{ background: 'rgba(99,102,241,.06)', border: '0.5px solid rgba(99,102,241,.2)', borderRadius: 16, padding: '20px', marginBottom: 24 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: '0 0 6px' }}>Are you a creator?</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', margin: '0 0 14px', lineHeight: 1.6 }}>
            Claim your profile to verify your deals, add your current codes, and build trust with your audience.
          </p>
          <Link href="/creators" style={{ display: 'inline-block', fontSize: 12, padding: '8px 16px', borderRadius: 8, background: 'rgba(99,102,241,.2)', color: '#818CF8', border: '0.5px solid rgba(99,102,241,.3)', textDecoration: 'none', fontWeight: 500 }}>
            Find your profile →
          </Link>
        </div>

        {/* About */}
        <div style={{ background: 'rgba(255,255,255,.02)', border: '0.5px solid rgba(255,255,255,.06)', borderRadius: 16, padding: '20px' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: '0 0 6px' }}>About That's The One</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', margin: '0 0 14px', lineHeight: 1.6 }}>
            The search engine and memory layer for the creator economy. We index sponsorships, deals and recommendations across YouTube, podcasts and more — updated daily.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/terms" style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', textDecoration: 'none' }}>Terms</Link>
            <Link href="/privacy" style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', textDecoration: 'none' }}>Privacy</Link>
            <a href="mailto:hello@thatsthe.one" style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', textDecoration: 'none' }}>Contact</a>
          </div>
        </div>

      </div>
    </Layout>
  )
}