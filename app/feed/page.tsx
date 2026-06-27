'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const SESSION_KEY = 'tto_session'
function getSession() {
  if (typeof window === 'undefined') return null
  let s = localStorage.getItem(SESSION_KEY)
  if (!s) { s = crypto.randomUUID(); localStorage.setItem(SESSION_KEY, s) }
  return s
}

const CARD_TYPES = {
  NEW_SPONSOR: { label: 'New sponsor spotted', color: '#6366F1', bg: 'rgba(99,102,241,.12)', icon: '◈' },
  TRENDING: { label: 'Trending this week', color: '#F59E0B', bg: 'rgba(245,158,11,.12)', icon: '↑' },
  HOT_DEAL: { label: 'Hot deal', color: '#10B981', bg: 'rgba(16,185,129,.12)', icon: '✦' },
  ORGANIC: { label: 'Genuine love — not an ad', color: '#8B5CF6', bg: 'rgba(139,92,246,.12)', icon: '◎' },
  MULTI_CREATOR: { label: 'Multiple creators promoting', color: '#EF4444', bg: 'rgba(239,68,68,.12)', icon: '⊕' },
}

function classifyCard(s: any, brandCounts: Record<string, number>) {
  const brandName = s.brands?.name || ''
  const count = brandCounts[brandName] || 1
  if (s.is_organic) return 'ORGANIC'
  if (count >= 3) return 'MULTI_CREATOR'
  if (s.promo_code && s.offer_text) return 'HOT_DEAL'
  const daysSince = s.first_seen
    ? Math.floor((Date.now() - new Date(s.first_seen).getTime()) / 86400000)
    : 999
  if (daysSince <= 7) return 'NEW_SPONSOR'
  return 'TRENDING'
}

export default function FeedPage() {
  const [feed, setFeed] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('All')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const filters = ['All', 'New', 'Trending', 'Hot deals', 'Organic']

  useEffect(() => {
    loadFeed(0, true)
  }, [filter])

  async function loadFeed(pageNum: number, reset = false) {
    setLoading(true)
    const from = pageNum * 20
    const to = from + 19

    let query = supabase
      .from('sponsorships')
      .select(`
        id, promo_code, offer_text, exact_quote,
        sponsorship_type, is_active, is_organic,
        first_seen, last_seen, video_title, video_id,
        brands ( name, slug ),
        creators ( name, slug, subscriber_count, category, avatar_url )
      `)
      .order('last_seen', { ascending: false })
      .range(from, to)

    if (filter === 'Hot deals') query = query.not('promo_code', 'is', null)
    if (filter === 'Organic') query = query.eq('is_organic', true)
    if (filter === 'New') {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
      query = query.gte('first_seen', weekAgo)
    }

    const { data } = await query
    const raw = (data || []).filter((s: any) => s.brands && s.creators)
const seenPairs = new Set<string>()
const items = raw.filter((s: any) => {
  const key = `${s.brands.slug}-${s.creators.slug}`
  if (seenPairs.has(key)) return false
  seenPairs.add(key)
  return true
})

    const brandCounts: Record<string, number> = {}
    items.forEach((s: any) => {
      const n = s.brands?.name || ''
      brandCounts[n] = (brandCounts[n] || 0) + 1
    })

    const classified = items.map((s: any) => ({
      ...s,
      cardType: classifyCard(s, brandCounts),
    }))

    if (reset) {
      setFeed(classified)
    } else {
      setFeed(prev => [...prev, ...classified])
    }
    setHasMore(items.length === 20)
    setLoading(false)
  }

  const loadMore = () => {
    const next = page + 1
    setPage(next)
    loadFeed(next)
  }

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code)
    setCopied(code)
    const session = getSession()
    if (session) await supabase.from('user_signals').insert({ session_id: session, signal_type: 'copy', value: code })
    setTimeout(() => setCopied(null), 2000)
  }

  const formatTimeAgo = (date: string) => {
    if (!date) return ''
    const diff = Date.now() - new Date(date).getTime()
    const days = Math.floor(diff / 86400000)
    const weeks = Math.floor(days / 7)
    const months = Math.floor(days / 30)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days}d ago`
    if (weeks < 5) return `${weeks}w ago`
    return `${months}mo ago`
  }

  const formatSubs = (n: number) => {
    if (!n) return ''
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `${Math.round(n / 1000)}k`
    return n.toString()
  }

  return (
    <Layout>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        .feed-card { animation: fadeUp .4s ease forwards }
        .feed-card:hover { border-color: rgba(99,102,241,.3) !important }
        .filter-btn:hover { background: rgba(255,255,255,.08) !important }
        .load-more:hover { background: rgba(99,102,241,.2) !important }
      `}</style>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px 40px' }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.02em', margin: '0 0 4px', color: '#fff' }}>
            Creator intelligence feed
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', margin: 0 }}>
            What creators are promoting, obsessing over and getting paid to talk about
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
          {filters.map(f => (
            <button key={f} className="filter-btn"
              onClick={() => { setFilter(f); setPage(0) }}
              style={{ fontSize: 12, padding: '6px 14px', borderRadius: 20, border: '1px solid', whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all .15s', borderColor: filter === f ? '#6366F1' : 'rgba(255,255,255,.08)', background: filter === f ? 'rgba(99,102,241,.15)' : 'transparent', color: filter === f ? '#818CF8' : 'rgba(255,255,255,.4)' }}>
              {f}
            </button>
          ))}
        </div>

        {/* Feed */}
        {loading && page === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,.25)' }}>
            <div style={{ fontSize: 24, marginBottom: 12, display: 'inline-block', animation: 'spin 1s linear infinite' }}>◌</div>
            <p style={{ fontSize: 13 }}>Loading feed...</p>
          </div>
        ) : feed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>◎</p>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,.4)' }}>Nothing here yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {feed.map((s: any, i: number) => {
              const type = CARD_TYPES[s.cardType as keyof typeof CARD_TYPES] || CARD_TYPES.TRENDING
              return (
                <div key={s.id} className="feed-card"
                  style={{ animationDelay: `${Math.min(i, 10) * 0.05}s`, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: 18, transition: 'border-color .2s', position: 'relative', overflow: 'hidden' }}>

                  {/* Glow */}
                  <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: type.color, opacity: .06, filter: 'blur(20px)', pointerEvents: 'none' }} />

                  {/* Card type badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '3px 10px', borderRadius: 20, background: type.bg, color: type.color, fontWeight: 500 }}>
                      <span>{type.icon}</span>
                      <span>{type.label}</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,.25)' }}>
                      {formatTimeAgo(s.last_seen || s.first_seen)}
                    </span>
                  </div>

                  {/* Brand + Creator */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: type.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, color: type.color, flexShrink: 0 }}>
                      {s.brands?.name?.[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#fff' }}>{s.brands?.name}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', margin: 0 }}>via {s.creators?.name}</p>
                        {s.creators?.subscriber_count && (
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', background: 'rgba(255,255,255,.06)', padding: '1px 6px', borderRadius: 10 }}>
                            {formatSubs(s.creators.subscriber_count)}
                          </span>
                        )}
                        {s.creators?.category && (
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', background: 'rgba(255,255,255,.04)', padding: '1px 6px', borderRadius: 10 }}>
                            {s.creators.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Exact quote — the killer feature */}
                  {s.exact_quote && (
                    <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '10px 12px', marginBottom: 12, borderLeft: `3px solid ${type.color}` }}>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
                        "{s.exact_quote.slice(0, 150)}{s.exact_quote.length > 150 ? '...' : ''}"
                      </p>
                    </div>
                  )}

                  {/* Offer text */}
                  {s.offer_text && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <span style={{ fontSize: 11, color: '#4ADE80', background: 'rgba(34,197,94,.1)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(34,197,94,.2)' }}>
                        {s.offer_text}
                      </span>
                    </div>
                  )}

                  {/* Video */}
                  {s.video_title && (
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📺 {s.video_title}
                    </p>
                  )}

                  {/* Bottom row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {s.promo_code ? (
                        <span style={{ fontFamily: 'monospace', fontSize: 13, background: 'rgba(255,255,255,.07)', padding: '4px 10px', borderRadius: 6, letterSpacing: '.05em', color: '#fff' }}>
                          {s.promo_code}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', fontStyle: 'italic' }}>
                          {s.sponsorship_type === 'url' ? 'Custom link' : s.sponsorship_type === 'mention' ? 'Organic mention' : 'No code'}
                        </span>
                      )}
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: s.is_active ? 'rgba(34,197,94,.1)' : 'rgba(255,255,255,.05)', color: s.is_active ? '#4ADE80' : 'rgba(255,255,255,.25)', border: `1px solid ${s.is_active ? 'rgba(34,197,94,.2)' : 'rgba(255,255,255,.06)'}` }}>
                        {s.is_active ? 'Active' : 'Unverified'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      {s.video_id && (
                        <a href={`https://youtube.com/watch?v=${s.video_id}`} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.4)', border: '1px solid rgba(255,255,255,.08)', textDecoration: 'none' }}>
                          Watch ↗
                        </a>
                      )}
                      {s.promo_code && (
                        <button onClick={() => copyCode(s.promo_code)}
                          style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, background: copied === s.promo_code ? 'rgba(34,197,94,.15)' : 'rgba(99,102,241,.15)', color: copied === s.promo_code ? '#4ADE80' : '#818CF8', border: `1px solid ${copied === s.promo_code ? 'rgba(34,197,94,.3)' : 'rgba(99,102,241,.25)'}`, cursor: 'pointer', transition: 'all .15s', fontWeight: 500 }}>
                          {copied === s.promo_code ? '✓ Copied!' : 'Copy code'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {hasMore && (
              <button className="load-more" onClick={loadMore}
                style={{ width: '100%', padding: '14px', borderRadius: 12, background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)', color: '#818CF8', fontSize: 13, cursor: 'pointer', transition: 'all .15s', marginTop: 4 }}>
                {loading ? 'Loading...' : 'Load more'}
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </Layout>
  )
}