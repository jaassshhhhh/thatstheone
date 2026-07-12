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

function formatSubs(n: number) {
  if (!n) return ''
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return `${n}`
}

function hashString(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const AVATAR_COLORS = [
  { bg: 'rgba(248,113,113,.15)', text: '#F87171' },
  { bg: 'rgba(129,140,248,.15)', text: '#818CF8' },
  { bg: 'rgba(251,191,36,.15)', text: '#FBBF24' },
  { bg: 'rgba(52,211,153,.15)', text: '#34D399' },
  { bg: 'rgba(244,114,182,.15)', text: '#F472B6' },
  { bg: 'rgba(96,165,250,.15)', text: '#60A5FA' },
]

function getAvatarColor(name: string) {
  const idx = hashString(name || '') % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

function bucketEvidenceByDay(evidence: any[]) {
  const days = 14
  const buckets = Array(days).fill(0)
  const now = Date.now()
  for (const e of evidence) {
    const diff = Math.floor((now - new Date(e.first_seen).getTime()) / 86400000)
    const idx = days - 1 - diff
    if (idx >= 0 && idx < days) buckets[idx]++
  }
  return buckets
}

function getEvidenceVariant(t: TrendItem): 'first_mover' | 'organic' | 'dominant' | 'accelerating' | 'default' {
  if (t.is_new_this_week) return 'first_mover'
  if (t.organic_pct >= 70) return 'organic'
  if (t.total_creators >= 5) return 'dominant'
  if (t.growth_pct >= t.avg_growth_pct * 2 && t.avg_growth_pct > 0) return 'accelerating'
  return 'default'
}

export default function TrendingPage() {
  const [trends, setTrends] = useState<TrendItem[]>([])
  const [loading, setLoading] = useState(true)
  const [totalBrands, setTotalBrands] = useState(0)
  const [loadError, setLoadError] = useState(false)
  const [filter, setFilter] = useState<'all' | 'rising' | 'new' | 'dominant'>('all')
  const [category, setCategory] = useState('All')
  const [lastUpdated, setLastUpdated] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [evidence, setEvidence] = useState<Record<string, any[]>>({})
  const [evidenceLoading, setEvidenceLoading] = useState<string | null>(null)

  useEffect(() => {
    loadTrends()
    supabase.from('brands').select('*', { count: 'exact', head: true }).then(({ count }) => setTotalBrands(count || 0))
  }, [])

  async function loadEvidence(brandId: string) {
    if (evidence[brandId]) {
      setExpandedId(expandedId === brandId ? null : brandId)
      return
    }
    setEvidenceLoading(brandId)
    const { data } = await supabase
      .from('sponsorships')
      .select(`id, first_seen, is_organic, exact_quote, video_title, promo_code, creators ( name, slug, subscriber_count )`)
      .eq('brand_id', brandId)
      .gte('first_seen', new Date(Date.now() - 14 * 86400000).toISOString())
      .order('first_seen', { ascending: false })
      .limit(15)
    setEvidence(prev => ({ ...prev, [brandId]: data || [] }))
    setEvidenceLoading(null)
    setExpandedId(brandId)
  }

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

  function getSignalType(t: TrendItem): { label: string; color: string; bg: string; border: string } {
    if (t.is_new_this_week) return { label: 'First mover', color: '#818CF8', bg: 'rgba(99,102,241,.1)', border: 'rgba(99,102,241,.2)' }
    if (t.organic_pct >= 70) return { label: 'Not a paid push', color: '#34D399', bg: 'rgba(16,185,129,.1)', border: 'rgba(16,185,129,.2)' }
    if (t.total_creators >= 5) return { label: 'Widely adopted', color: '#F87171', bg: 'rgba(239,68,68,.1)', border: 'rgba(239,68,68,.2)' }
    if (t.growth_pct >= t.avg_growth_pct * 2 && t.avg_growth_pct > 0) return { label: 'Worth watching', color: '#FBBF24', bg: 'rgba(245,158,11,.1)', border: 'rgba(245,158,11,.2)' }
    if (t.growth_pct > 0) return { label: 'Rising', color: '#FBBF24', bg: 'rgba(245,158,11,.1)', border: 'rgba(245,158,11,.2)' }
    return { label: 'Steady', color: 'rgba(255,255,255,.3)', bg: 'rgba(255,255,255,.04)', border: 'rgba(255,255,255,.08)' }
  }

  function getInsightHeadline(t: TrendItem): string {
    if (t.is_new_this_week && t.total_creators >= 3) {
      return `${t.brand_name} suddenly got picked up by ${t.total_creators} creators at once`
    }
    if (t.is_new_this_week) {
      return `${t.brand_name} just entered our data for the first time`
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
    if (t.is_new_this_week && t.total_creators >= 3) {
      return `That kind of simultaneous attention usually means something specific triggered it — a launch, a controversy, a moment. ${t.top_creator} was one of them.`
    }
    if (t.is_new_this_week) {
      return `${t.top_creator} is the first creator we've tracked mentioning it. Could be genuinely new to creator sponsorships, or just new to our coverage.`
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

              const isExpanded = expandedId === t.brand_id
              const isLoadingEvidence = evidenceLoading === t.brand_id
              const brandEvidence = evidence[t.brand_id] || []

              return (
                <div key={t.brand_id} className="tc"
                  style={{ animationDelay: `${Math.min(i, 10) * 0.03}s`, background: 'rgba(255,255,255,.03)', border: '0.5px solid rgba(255,255,255,.07)', borderRadius: 16, padding: '16px', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
                  onClick={() => loadEvidence(t.brand_id)}>

                  <div style={{ position: 'absolute', top: -24, right: -24, width: 80, height: 80, borderRadius: '50%', background: signal.color, opacity: .06, filter: 'blur(18px)', pointerEvents: 'none' }} />

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

                    {(signal.label === 'Rising' || signal.label === 'Worth watching' || signal.label === 'Steady') && (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,.35)', margin: '0 0 2px' }}>
                          {formatGrowth(pct, isNew)}
                        </p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', margin: 0 }}>vs last week</p>
                      </div>
                    )}
                  </div>

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

                  <div onClick={e => e.stopPropagation()} style={{ marginTop: 10 }}>
                    <button onClick={() => loadEvidence(t.brand_id)}
                      style={{ fontSize: 11, color: '#818CF8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      {isLoadingEvidence ? 'Loading...' : isExpanded ? '▲ Hide the evidence' : '▼ See what\'s driving this'}
                    </button>
                    {isExpanded && !isLoadingEvidence && (
                      <div style={{ marginTop: 10 }}>
                        {brandEvidence.length === 0 ? (
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>No recent mentions found in the last 14 days.</p>
                        ) : (() => {
                          const variant = getEvidenceVariant(t)
                          const uniqueCreators = Array.from(new Map(brandEvidence.map((e: any) => [e.creators?.name, e])).values())
                          const quoteRow = (e: any) => (
                            <div key={e.id} style={{ background: 'rgba(255,255,255,.03)', borderRadius: 10, padding: '10px 12px', marginTop: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: e.exact_quote ? 4 : 0 }}>
                                <span style={{ fontSize: 12, fontWeight: 500, color: '#fff' }}>{e.creators?.name}</span>
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,.25)' }}>
                                  {new Date(e.first_seen).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                </span>
                              </div>
                              {e.exact_quote && (
                                <p style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', margin: 0, fontStyle: 'italic', lineHeight: 1.4 }}>
                                  "{e.exact_quote.slice(0, 120)}{e.exact_quote.length > 120 ? '...' : ''}"
                                </p>
                              )}
                            </div>
                          )

                          if (variant === 'first_mover') {
                            const e = brandEvidence[0]
                            const color = getAvatarColor(e.creators?.name)
                            return (
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: color.text }}>
                                    {e.creators?.name?.[0]?.toUpperCase()}
                                  </div>
                                  <div>
                                    <p style={{ fontSize: 12, fontWeight: 500, color: '#fff', margin: 0 }}>{e.creators?.name}</p>
                                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', margin: '2px 0 0' }}>
                                      {e.creators?.subscriber_count ? `${formatSubs(e.creators.subscriber_count)} subscribers · ` : ''}first and only mention so far
                                    </p>
                                  </div>
                                </div>
                                {quoteRow(e)}
                              </div>
                            )
                          }

                          if (variant === 'organic') {
                            const organicCount = brandEvidence.filter((e: any) => e.is_organic).length
                            const paidCount = brandEvidence.length - organicCount
                            const pctOrganic = Math.round(100 * organicCount / brandEvidence.length)
                            return (
                              <div>
                                <p style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', margin: '0 0 6px' }}>Organic vs paid, last 14 days</p>
                                <div style={{ display: 'flex', width: 160, height: 8, borderRadius: 4, overflow: 'hidden' }}>
                                  <div style={{ width: `${pctOrganic}%`, background: '#34D399' }} />
                                  <div style={{ width: `${100 - pctOrganic}%`, background: 'rgba(255,255,255,.15)' }} />
                                </div>
                                <p style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', margin: '6px 0 0' }}>{organicCount} organic, {paidCount} paid</p>
                                {quoteRow(brandEvidence.find((e: any) => e.is_organic) || brandEvidence[0])}
                              </div>
                            )
                          }

                          if (variant === 'dominant') {
                            const buckets = bucketEvidenceByDay(brandEvidence)
                            const max = Math.max(...buckets, 1)
                            return (
                              <div>
                                <p style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', margin: '0 0 6px' }}>Mentions, last 14 days</p>
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 36 }}>
                                  {buckets.map((v, idx) => (
                                    <div key={idx} style={{ width: 8, height: `${Math.max((v / max) * 100, 4)}%`, background: '#F87171', borderRadius: '2px 2px 0 0' }} />
                                  ))}
                                </div>
                                <p style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', margin: '12px 0 6px' }}>Who's driving it</p>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  {uniqueCreators.slice(0, 5).map((e: any, idx: number) => {
                                    const color = getAvatarColor(e.creators?.name)
                                    return (
                                      <div key={idx} style={{ width: 26, height: 26, borderRadius: '50%', background: color.bg, border: '2px solid #0a0c14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: color.text, marginLeft: idx === 0 ? 0 : -8 }}>
                                        {e.creators?.name?.[0]?.toUpperCase()}
                                      </div>
                                    )
                                  })}
                                  {uniqueCreators.length > 5 && (
                                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,.08)', border: '2px solid #0a0c14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,.5)', marginLeft: -8 }}>
                                      +{uniqueCreators.length - 5}
                                    </div>
                                  )}
                                </div>
                                {quoteRow(brandEvidence[0])}
                              </div>
                            )
                          }

                          if (variant === 'accelerating') {
                            const multiple = (t.growth_pct / t.avg_growth_pct).toFixed(1)
                            // Bar comparison, not a fabricated line trend — we only have two
                            // real numbers here (this brand's growth vs the set average), not
                            // a day-by-day trajectory, so a bar honestly represents what we
                            // actually know instead of implying a curve we don't have.
                            const maxVal = Math.max(t.growth_pct, t.avg_growth_pct, 1)
                            return (
                              <div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                      <span style={{ fontSize: 11, color: '#FBBF24' }}>{t.brand_name}</span>
                                      <span style={{ fontSize: 11, color: '#FBBF24', fontWeight: 500 }}>+{t.growth_pct}%</span>
                                    </div>
                                    <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'rgba(255,255,255,.06)' }}>
                                      <div style={{ width: `${Math.max((t.growth_pct / maxVal) * 100, 4)}%`, height: '100%', borderRadius: 4, background: '#FBBF24' }} />
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>Average trending brand</span>
                                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>+{t.avg_growth_pct}%</span>
                                    </div>
                                    <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'rgba(255,255,255,.06)' }}>
                                      <div style={{ width: `${Math.max((t.avg_growth_pct / maxVal) * 100, 4)}%`, height: '100%', borderRadius: 4, background: 'rgba(255,255,255,.25)' }} />
                                    </div>
                                  </div>
                                </div>
                                <p style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', margin: '8px 0 0' }}>{multiple}x the average this week</p>
                                {quoteRow(brandEvidence[0])}
                              </div>
                            )
                          }

                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {brandEvidence.slice(0, 4).map(quoteRow)}
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>

                  {t.brand_slug && (
                    <Link href={`/brands/${t.brand_slug}`} onClick={e => e.stopPropagation()}
                      style={{ display: 'inline-block', marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,.3)', textDecoration: 'none' }}>
                      View {t.brand_name} brand page →
                    </Link>
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