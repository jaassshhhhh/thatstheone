'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import Link from 'next/link'

type TrendItem = {
  brand_id: string
  brand_name: string
  brand_slug: string
  category: string | null
  this_week: number
  last_week: number
  growth_pct: number
  total_creators: number
  platforms: string[]
  top_creator: string
  is_new_this_week: boolean
  organic_pct: number
  avg_growth_pct: number
}

const CATEGORIES = ['All', 'Tech', 'Finance', 'Health', 'Lifestyle', 'Education', 'Gaming', 'Beauty', 'Food']

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
  const [totalBrands, setTotalBrands] = useState(0)
  const [loadError, setLoadError] = useState(false)
  const [filter, setFilter] = useState<'all' | 'rising' | 'new' | 'dominant'>('all')
  const [category, setCategory] = useState('All')
  const [lastUpdated, setLastUpdated] = useState('')

  useEffect(() => {
    loadTrends()
    supabase.from('brands').select('*', { count: 'exact', head: true }).then(({ count }) => setTotalBrands(count || 0))
  }, [])

  async function loadTrends() {
    setLoading(true)
    setLoadError(false)
    const { data, error } = await supabase.rpc('compute_brand_velocity_v2')
    if (!error && data) {
      setTrends(data)
      setLastUpdated(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
    } else if (error) {
      console.error('compute_brand_velocity failed:', error)
      setLoadError(true)
    }
    setLoading(false)
  }

  const inCategory = trends.filter(t =>
    category === 'All' || t.category?.toLowerCase().includes(category.toLowerCase())
  )

  const filtered = inCategory.filter(t => {
    if (filter === 'rising') return t.growth_pct > 0 && !t.is_new_this_week
    if (filter === 'new') return t.is_new_this_week
    if (filter === 'dominant') return t.total_creators >= 5
    return true
  })

  // Insight priority: organic signal and "new" status are the most interesting
  // findings when true (they're rarer and more meaningful than a growth number),
  // so they're checked before falling back to growth-based framing.
  function getSignalType(t: TrendItem): { label: string; color: string; bg: string; border: string } {
    if (t.is_new_this_week) return { label: 'First mover', color: '#818CF8', bg: 'rgba(99,102,241,.1)', border: 'rgba(99,102,241,.2)' }
    if (t.organic_pct >= 70) return { label: 'Not a paid push', color: '#34D399', bg: 'rgba(16,185,129,.1)', border: 'rgba(16,185,129,.2)' }
    if (t.total_creators >= 5) return { label: 'Widely adopted', color: '#F87171', bg: 'rgba(239,68,68,.1)', border: 'rgba(239,68,68,.2)' }
    if (t.growth_pct >= t.avg_growth_pct * 2 && t.avg_growth_pct > 0) return { label: 'Worth watching', color: '#FBBF24', bg: 'rgba(245,158,11,.1)', border: 'rgba(245,158,11,.2)' }
    if (t.growth_pct > 0) return { label: 'Rising', color: '#FBBF24', bg: 'rgba(245,158,11,.1)', border: 'rgba(245,158,11,.2)' }
    return { label: 'Steady', color: 'rgba(255,255,255,.3)', bg: 'rgba(255,255,255,.04)', border: 'rgba(255,255,255,.08)' }
  }

  function getInsightHeadline(t: TrendItem): string {
    if (t.is_new_this_week) {
      return `Nobody was talking about ${t.brand_name} until this week`
    }
    if (t.organic_pct >= 70) {
      return `Creators keep bringing up ${t.brand_name} unprompted`
    }
    if (t.total_creators >= 5) {
      return `${t.brand_name} is showing up everywhere right now`
    }
    if (t.growth_pct >= t.avg_growth_pct * 2 && t.avg_growth_pct > 0) {
      return `${t.brand_name} is accelerating faster than most`
    }
    if (t.growth_pct > 0) {
      return `${t.brand_name} is quietly picking up steam`
    }
    return `${t.brand_name} has a steady, consistent presence`
  }

  function getInsightBody(t: TrendItem): string {
    if (t.is_new_this_week) {
      return `${t.top_creator} is the only creator on it so far. Early enough that it could go either way.`
    }
    if (t.organic_pct >= 70) {
      return `${t.organic_pct}% of recent mentions had no code, no deal, no sponsor language — just people who actually use it.`
    }
    if (t.total_creators >= 5) {
      return `${t.total_creators} creators have mentioned it — that kind of spread is hard to manufacture with a single paid campaign.`
    }
    if (t.growth_pct >= t.avg_growth_pct * 2 && t.avg_growth_pct > 0) {
      const multiple = (t.growth_pct / t.avg_growth_pct).toFixed(1)
      return `Growing ${multiple}x faster than the average trending brand this week. That kind of jump usually means something is about to break wider.`
    }
    if (t.growth_pct > 0) {
      return `Up ${t.growth_pct}% from last week — not dramatic yet, but the direction is real.`
    }
    return `${t.total_creators} creators have mentioned it consistently, without a sudden spike either way.`
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
        .tc:hover { border-color: rgba(255,255,255,.14) !important; transform: translateY(-1px) }
        .filt:hover { background: rgba(255,255,255,.06) !important }
        .tc { transition: border-color .2s, transform .2s }
      `}</style>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px 14px 40px' }}>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.02em', color: '#fff', margin: 0 }}>Trends</h1>
            {lastUpdated && <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>Updated {lastUpdated}</span>}
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', margin: '3px 0 0' }}>
            What brands are rising across creator content right now
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', paddingBottom: 2 }}>
          {CATEGORIES.map(c => (
            <button key={c} className="filt" onClick={() => setCategory(c)}
              style={{ fontSize: 11, padding: '5px 13px', borderRadius: 20, border: '0.5px solid', whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all .15s', borderColor: category === c ? '#6366F1' : 'rgba(255,255,255,.06)', background: category === c ? 'rgba(99,102,241,.12)' : 'transparent', color: category === c ? '#818CF8' : 'rgba(255,255,255,.3)' }}>
              {c}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {([
            { key: 'all', label: 'All' },
            { key: 'rising', label: '↑ Rising' },
            { key: 'new', label: '◈ New' },
            { key: 'dominant', label: '⊕ Dominant' },
          ] as const).map(f => (
            <button key={f.key} className="filt"
              onClick={() => setFilter(f.key)}
              style={{ fontSize: 11, padding: '5px 13px', borderRadius: 20, border: '0.5px solid', cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap', borderColor: filter === f.key ? '#6366F1' : 'rgba(255,255,255,.08)', background: filter === f.key ? 'rgba(99,102,241,.15)' : 'transparent', color: filter === f.key ? '#818CF8' : 'rgba(255,255,255,.4)' }}>
              {f.label}
            </button>
          ))}
        </div>

        {!loading && trends.length > 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 6 }}>
              {[
                { label: category === 'All' ? 'Trending now' : `Trending in ${category}`, value: inCategory.length, color: '#fff' },
                { label: 'New this week', value: inCategory.filter(t => t.is_new_this_week).length, color: '#818CF8' },
                { label: 'Surging', value: inCategory.filter(t => t.growth_pct >= 100).length, color: '#34D399' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,.03)', border: '0.5px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '10px 12px' }}>
                  <p style={{ fontSize: 20, fontWeight: 600, color: s.color, margin: '0 0 2px' }}>{s.value}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', margin: 0 }}>{s.label}</p>
                </div>
              ))}
            </div>
            {totalBrands > 0 && category === 'All' && (
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', margin: '0 0 16px' }}>
                {trends.length} of {totalBrands.toLocaleString()} tracked brands are trending this week — the rest are quieter right now, not missing.
              </p>
            )}
            {category !== 'All' && inCategory.length === 0 && (
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', margin: '0 0 16px' }}>
                Nothing in {category} is meeting the trend threshold this week.
              </p>
            )}
          </>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,.2)' }}>
            <p style={{ fontSize: 13 }}>Computing brand velocity...</p>
          </div>
        ) : loadError ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: 28, marginBottom: 10 }}>⚠</p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.3)', marginBottom: 12 }}>Couldn't load trends right now</p>
            <button onClick={loadTrends} style={{ fontSize: 12, padding: '6px 16px', borderRadius: 10, background: 'rgba(99,102,241,.15)', color: '#818CF8', border: '0.5px solid rgba(99,102,241,.25)', cursor: 'pointer' }}>
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: 28, marginBottom: 10 }}>◎</p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.3)' }}>No trends found</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((t, i) => {
              const signal = getSignalType(t)
              const pct = t.growth_pct
              const isNew = t.is_new_this_week
              const headline = getInsightHeadline(t)
              const insightBody = getInsightBody(t)

              return (
                <Link key={t.brand_id} href={t.brand_slug ? `/brands/${t.brand_slug}` : '#'} style={{ textDecoration: 'none', display: 'block' }}>
                <div className="tc"
                  style={{ animationDelay: `${Math.min(i, 10) * 0.03}s`, background: 'rgba(255,255,255,.03)', border: '0.5px solid rgba(255,255,255,.07)', borderRadius: 16, padding: '16px', position: 'relative', overflow: 'hidden', cursor: t.brand_slug ? 'pointer' : 'default' }}>

                  <div style={{ position: 'absolute', top: -24, right: -24, width: 80, height: 80, borderRadius: '50%', background: signal.color, opacity: .06, filter: 'blur(18px)', pointerEvents: 'none' }} />

                  {/* Top row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: signal.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: signal.color, flexShrink: 0 }}>
                        {t.brand_name[0]?.toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: signal.bg, color: signal.color, border: `0.5px solid ${signal.border}`, fontWeight: 500 }}>
                            {signal.label}
                          </span>
                        </div>
                        <p style={{ fontSize: 15, fontWeight: 600, color: '#fff', margin: '0 0 4px' }}>{headline}</p>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', margin: 0, lineHeight: 1.4 }}>
                          {insightBody}
                        </p>
                      </div>
                    </div>

                    {/* Growth number — de-emphasized now that the headline carries the
                        actual insight; only shown at all when it's genuinely the most
                        relevant fact (Rising/Steady cards), hidden for organic/dominant/new
                        cards where a raw weekly percentage would contradict or distract
                        from the real story already stated in the body copy. */}
                    {(signal.label === 'Rising' || signal.label === 'Worth watching' || signal.label === 'Steady') && (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,.35)', margin: '0 0 2px' }}>
                          {formatGrowth(pct, isNew)}
                        </p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', margin: 0 }}>vs last week</p>
                      </div>
                    )}
                  </div>

                  {/* Bottom row — creator + platforms */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '0.5px solid rgba(255,255,255,.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {t.top_creator && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 18, height: 18, borderRadius: '50%', background: signal.color + '30', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: signal.color }}>
                            {t.top_creator[0]?.toUpperCase()}
                          </div>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>{t.top_creator}</span>
                        </div>
                      )}
                      {t.total_creators > 1 && (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>
                          +{t.total_creators - 1} more
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(t.platforms || []).map(p => (
                        <span key={p} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.3)' }}>
                          {PLATFORM_ICONS[p] || p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}