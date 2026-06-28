'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

type TrendItem = {
  brand_id: string
  brand_name: string
  brand_slug: string
  this_week: number
  last_week: number
  growth_pct: number
  total_creators: number
  platforms: string[]
  top_creator: string
  is_new_this_week: boolean
}

const PLATFORM_ICONS: Record<string, string> = {
  youtube: '▶',
  podcast: '🎙',
  twitch: '🎮',
  reddit: '🔴',
  newsletter: '📰',
  tiktok: '♪',
}

export default function TrendingPage() {
  const [trends, setTrends] = useState<TrendItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'rising' | 'new' | 'dominant'>('all')
  const [lastUpdated, setLastUpdated] = useState('')

  useEffect(() => {
    loadTrends()
  }, [])

  async function loadTrends() {
    setLoading(true)
    const { data, error } = await supabase.rpc('compute_brand_velocity')
    if (!error && data) {
      setTrends(data)
      setLastUpdated(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
    }
    setLoading(false)
  }

  const filtered = trends.filter(t => {
    if (filter === 'rising') return t.growth_pct > 0 && !t.is_new_this_week
    if (filter === 'new') return t.is_new_this_week
    if (filter === 'dominant') return t.total_creators >= 3
    return true
  })

  function getSignalType(t: TrendItem): { label: string; color: string; bg: string; border: string } {
    if (t.is_new_this_week) return { label: 'New this week', color: '#818CF8', bg: 'rgba(99,102,241,.1)', border: 'rgba(99,102,241,.2)' }
    if (t.total_creators >= 5) return { label: 'Dominant', color: '#F87171', bg: 'rgba(239,68,68,.1)', border: 'rgba(239,68,68,.2)' }
    if (t.growth_pct >= 100) return { label: 'Surging', color: '#34D399', bg: 'rgba(16,185,129,.1)', border: 'rgba(16,185,129,.2)' }
    if (t.growth_pct > 0) return { label: 'Rising', color: '#FBBF24', bg: 'rgba(245,158,11,.1)', border: 'rgba(245,158,11,.2)' }
    return { label: 'Steady', color: 'rgba(255,255,255,.3)', bg: 'rgba(255,255,255,.04)', border: 'rgba(255,255,255,.08)' }
  }

  function formatGrowth(pct: number, isNew: boolean) {
    if (isNew) return 'First seen'
    if (pct > 0) return `+${pct}%`
    if (pct === 0) return 'Stable'
    return `${pct}%`
  }

  function growthColor(pct: number, isNew: boolean) {
    if (isNew) return '#818CF8'
    if (pct > 0) return '#34D399'
    if (pct === 0) return 'rgba(255,255,255,.3)'
    return '#F87171'
  }

  return (
    <Layout>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        .tc { animation: fadeUp .3s ease forwards }
        .tc:hover { border-color: rgba(255,255,255,.14) !important }
        .filt:hover { background: rgba(255,255,255,.06) !important }
      `}</style>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px 14px 40px' }}>

        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.02em', color: '#fff', margin: 0 }}>
              Trends
            </h1>
            {lastUpdated && (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>
                Updated {lastUpdated}
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', margin: '3px 0 0' }}>
            Brand velocity across YouTube, podcasts and more · updated daily
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {([
            { key: 'all', label: 'All brands' },
            { key: 'rising', label: '↑ Rising' },
            { key: 'new', label: '◈ New this week' },
            { key: 'dominant', label: '⊕ Dominant' },
          ] as const).map(f => (
            <button key={f.key} className="filt"
              onClick={() => setFilter(f.key)}
              style={{ fontSize: 11, padding: '5px 13px', borderRadius: 20, border: '0.5px solid', cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap', borderColor: filter === f.key ? '#6366F1' : 'rgba(255,255,255,.08)', background: filter === f.key ? 'rgba(99,102,241,.15)' : 'transparent', color: filter === f.key ? '#818CF8' : 'rgba(255,255,255,.4)' }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Stats row */}
        {!loading && trends.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Brands tracked', value: trends.length },
              { label: 'New this week', value: trends.filter(t => t.is_new_this_week).length },
              { label: 'Surging 100%+', value: trends.filter(t => t.growth_pct >= 100).length },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,.03)', border: '0.5px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '10px 12px' }}>
                <p style={{ fontSize: 18, fontWeight: 600, color: '#fff', margin: '0 0 2px' }}>{s.value}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', margin: 0 }}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Trends list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,.2)' }}>
            <p style={{ fontSize: 13 }}>Computing brand velocity...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: 28, marginBottom: 10 }}>◎</p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.3)' }}>No trends found for this filter</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((t, i) => {
              const signal = getSignalType(t)
              return (
                <div key={t.brand_id} className="tc"
                  style={{ animationDelay: `${Math.min(i, 10) * 0.03}s`, background: 'rgba(255,255,255,.03)', border: '0.5px solid rgba(255,255,255,.07)', borderRadius: 16, padding: '14px 16px', transition: 'border-color .2s', position: 'relative', overflow: 'hidden' }}>

                  {/* Subtle glow */}
                  <div style={{ position: 'absolute', top: -20, right: -20, width: 70, height: 70, borderRadius: '50%', background: signal.color, opacity: .06, filter: 'blur(16px)', pointerEvents: 'none' }} />

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

                    {/* Rank */}
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.2)', minWidth: 20, textAlign: 'center', flexShrink: 0 }}>
                      {i + 1}
                    </div>

                    {/* Brand avatar */}
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: signal.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: signal.color, flexShrink: 0 }}>
                      {t.brand_name[0]?.toUpperCase()}
                    </div>

                    {/* Brand info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{t.brand_name}</span>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: signal.bg, color: signal.color, border: `0.5px solid ${signal.border}`, fontWeight: 500 }}>
                          {signal.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {t.top_creator && (
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>
                            Top: {t.top_creator}
                          </span>
                        )}
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,.2)' }}>·</span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.25)' }}>
                          {t.total_creators} creator{t.total_creators !== 1 ? 's' : ''}
                        </span>
                        {t.platforms?.length > 0 && (
                          <>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,.2)' }}>·</span>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>
                              {t.platforms.map(p => PLATFORM_ICONS[p] || p).join(' ')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Growth metric */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: growthColor(t.growth_pct, t.is_new_this_week), margin: '0 0 2px' }}>
                        {formatGrowth(t.growth_pct, t.is_new_this_week)}
                      </p>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', margin: 0 }}>
                        {t.is_new_this_week ? 'this week' : `${t.this_week} vs ${t.last_week}`}
                      </p>
                    </div>
                  </div>

                  {/* Mini bar chart showing this week vs last week */}
                  {!t.is_new_this_week && (t.this_week > 0 || t.last_week > 0) && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid rgba(255,255,255,.06)', display: 'flex', gap: 4, alignItems: 'flex-end', height: 24 }}>
                      {[
                        { val: t.last_week, label: 'Last week', color: 'rgba(255,255,255,.12)' },
                        { val: t.this_week, label: 'This week', color: signal.color + '80' },
                      ].map(bar => {
                        const max = Math.max(t.last_week, t.this_week, 1)
                        const h = Math.max(4, Math.round((bar.val / max) * 20))
                        return (
                          <div key={bar.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1 }}>
                            <div style={{ width: '100%', height: h, background: bar.color, borderRadius: 3, transition: 'height .3s' }} />
                            <span style={{ fontSize: 9, color: 'rgba(255,255,255,.2)', whiteSpace: 'nowrap' }}>{bar.label}</span>
                          </div>
                        )
                      })}
                      <div style={{ flex: 6 }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}