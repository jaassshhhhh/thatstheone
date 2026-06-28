'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const SESSION_KEY = 'tto_session'
function getSession() {
  if (typeof window === 'undefined') return null
  let s = localStorage.getItem(SESSION_KEY)
  if (!s) { s = crypto.randomUUID(); localStorage.setItem(SESSION_KEY, s) }
  return s
}

async function track(type: string, value: string) {
  const session = getSession()
  if (!session) return
  await supabase.from('user_signals').insert({ session_id: session, signal_type: type, value }).then(() => {})
}

const CARD_CONFIGS: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
  VELOCITY:   { label: 'Velocity surge',    icon: 'ti-flame',        color: '#F87171', bg: 'rgba(239,68,68,.1)',    border: 'rgba(239,68,68,.2)' },
  ORGANIC:    { label: 'Genuine love',      icon: 'ti-heart',        color: '#34D399', bg: 'rgba(16,185,129,.1)',   border: 'rgba(16,185,129,.2)' },
  NEW_DEAL:   { label: 'New deal spotted',  icon: 'ti-speakerphone', color: '#818CF8', bg: 'rgba(99,102,241,.1)',   border: 'rgba(99,102,241,.2)' },
  TRENDING:   { label: 'Trending',          icon: 'ti-trending-up',  color: '#FBBF24', bg: 'rgba(245,158,11,.1)',   border: 'rgba(245,158,11,.2)' },
  MULTI:      { label: 'Multiple creators', icon: 'ti-users',        color: '#C084FC', bg: 'rgba(139,92,246,.1)',   border: 'rgba(139,92,246,.2)' },
  HOT:        { label: 'Hot deal',          icon: 'ti-bolt',         color: '#34D399', bg: 'rgba(16,185,129,.1)',   border: 'rgba(16,185,129,.2)' },
}

function classifyCard(s: any, brandCountMap: Record<string, number>): string {
  if (s.is_organic) return 'ORGANIC'
  const count = brandCountMap[s.brands?.name] || 1
  if (count >= 3) return 'MULTI'
  if (s.promo_code && s.offer_text) return 'HOT'
  const days = s.first_seen
    ? Math.floor((Date.now() - new Date(s.first_seen).getTime()) / 86400000)
    : 999
  if (days <= 14) return 'NEW_DEAL'
  return 'TRENDING'
}

function timeAgo(date: string) {
  if (!date) return ''
  const d = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return `${Math.floor(d / 30)}mo ago`
}

function formatSubs(n: number) {
  if (!n) return ''
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return `${n}`
}

const FILTERS = ['All', 'Trending', 'Deals', 'Organic', 'New']

export default function FeedPage() {
  const [feed, setFeed] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [totalToday, setTotalToday] = useState(0)
  const loaderRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadFeed(0, true) }, [filter])

  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        const next = page + 1
        setPage(next)
        loadFeed(next)
      }
    }, { threshold: 0.1 })
    if (loaderRef.current) obs.observe(loaderRef.current)
    return () => obs.disconnect()
  }, [hasMore, loading, page, filter])

  useEffect(() => {
    supabase.from('sponsorships')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 86400000).toISOString())
      .then(({ count }) => setTotalToday(count || 0))
  }, [])

  async function loadFeed(pageNum: number, reset = false) {
    setLoading(true)
    const from = pageNum * 20
    const to = from + 19

    let q = supabase
      .from('sponsorships')
      .select(`
        id, promo_code, offer_text, exact_quote,
        sponsorship_type, is_active, is_organic,
        first_seen, last_seen, video_title, video_id,
        dar_score, dar_source,
        brands ( name, slug ),
        creators ( name, slug, subscriber_count, category, avatar_url )
      `)
      .order('dar_score', { ascending: false })
      .order('last_seen', { ascending: false })
      .range(from, to)

    if (filter === 'Deals') q = q.not('promo_code', 'is', null)
    if (filter === 'Organic') q = q.eq('is_organic', true)
    if (filter === 'New') q = q.gte('first_seen', new Date(Date.now() - 14 * 86400000).toISOString())
    if (filter === 'Trending') q = q.gte('dar_score', 70)

    const { data } = await q
    const items = (data || []).filter((s: any) => s.brands && s.creators)

    const brandMap: Record<string, number> = {}
    items.forEach((s: any) => {
      const n = s.brands?.name || ''
      brandMap[n] = (brandMap[n] || 0) + 1
    })

    const classified = items.map((s: any) => ({
      ...s,
      cardType: classifyCard(s, brandMap),
    }))

    if (reset) setFeed(classified)
    else setFeed(prev => [...prev, ...classified])

    setHasMore(items.length === 20)
    setLoading(false)
  }

  const copyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code)
    setCopied(id)
    track('copy', code)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <Layout>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        .fc { animation: fadeUp .35s ease forwards }
        .fc:hover { border-color: rgba(255,255,255,.12) !important }
        .deal-btn:hover { opacity: .85 }
      `}</style>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 14px 40px' }}>

        {/* Header */}
        <div style={{ marginBottom: 14 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.02em', color: '#fff', margin: '0 0 3px' }}>
            Pulse
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', margin: 0 }}>
          {totalToday > 0 ? `${totalToday} sponsorships indexed · ` : ''}What creators are talking about right now
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 2 }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => { setFilter(f); setPage(0) }}
              style={{ fontSize: 11, padding: '5px 13px', borderRadius: 20, border: '0.5px solid', whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all .15s', borderColor: filter === f ? '#6366F1' : 'rgba(255,255,255,.08)', background: filter === f ? 'rgba(99,102,241,.15)' : 'transparent', color: filter === f ? '#818CF8' : 'rgba(255,255,255,.4)' }}>
              {f}
            </button>
          ))}
        </div>

        {/* Feed */}
        {loading && page === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,.2)' }}>
            <p style={{ fontSize: 13 }}>Loading pulse...</p>
          </div>
        ) : feed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: 28, marginBottom: 10 }}>◎</p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.3)' }}>Nothing here yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {feed.map((s: any, i: number) => {
              const cfg = CARD_CONFIGS[s.cardType] || CARD_CONFIGS.TRENDING
              const isOpen = expanded === s.id
              const hasDeal = s.promo_code || s.offer_text || s.promo_url

              return (
                <div key={s.id} className="fc"
                  style={{ animationDelay: `${Math.min(i, 8) * 0.04}s`, background: 'rgba(255,255,255,.03)', border: '0.5px solid rgba(255,255,255,.07)', borderRadius: 18, padding: 16, cursor: 'pointer', transition: 'border-color .2s', position: 'relative', overflow: 'hidden' }}
                  onClick={() => { setExpanded(isOpen ? null : s.id); track('click', s.brands?.name || '') }}>

                  {/* Glow */}
                  <div style={{ position: 'absolute', top: -24, right: -24, width: 80, height: 80, borderRadius: '50%', background: cfg.color, opacity: .07, filter: 'blur(18px)', pointerEvents: 'none' }} />

                  {/* Top row — tag + time */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 500, padding: '3px 9px', borderRadius: 20, background: cfg.bg, color: cfg.color, border: `0.5px solid ${cfg.border}` }}>
                      <i className={`ti ${cfg.icon}`} style={{ fontSize: 11 }} aria-hidden="true" />
                      {cfg.label}
                    </div>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,.22)' }}>
                      {timeAgo(s.last_seen || s.first_seen)}
                    </span>
                  </div>

                  {/* Brand + Creator row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: cfg.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: cfg.color, flexShrink: 0 }}>
                      {s.brands?.name?.[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 3px', color: '#fff' }}>
                        {s.brands?.name}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>
                          via {s.creators?.name}
                        </span>
                        {s.creators?.subscriber_count > 0 && (
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', background: 'rgba(255,255,255,.05)', padding: '1px 6px', borderRadius: 8 }}>
                            {formatSubs(s.creators.subscriber_count)}
                          </span>
                        )}
                        {s.creators?.category && (
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', background: 'rgba(255,255,255,.04)', padding: '1px 6px', borderRadius: 8 }}>
                            {s.creators.category}
                          </span>
                        )}
                      </div>
                    </div>
                    {s.dar_score >= 75 && (
                      <div style={{ flexShrink: 0 }}>
                        <i className="ti ti-shield-check" style={{ fontSize: 14, color: '#34D399', opacity: .7 }} aria-hidden="true" />
                      </div>
                    )}
                  </div>

                  {/* Quote — always visible */}
                  {s.exact_quote && (
                    <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '9px 11px', marginBottom: 10, borderLeft: `2px solid ${cfg.color}` }}>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
                        "{s.exact_quote.slice(0, isOpen ? 300 : 120)}{!isOpen && s.exact_quote.length > 120 ? '...' : ''}"
                      </p>
                    </div>
                  )}

                  {/* Video title */}
                  {s.video_title && (
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <i className="ti ti-brand-youtube" style={{ fontSize: 12, marginRight: 4 }} aria-hidden="true" />
                      {s.video_title}
                    </p>
                  )}

                  {/* Bottom row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '0.5px solid rgba(255,255,255,.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {s.is_active ? (
                        <span style={{ fontSize: 10, color: '#34D399', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#34D399', display: 'inline-block' }} />
                          Active
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,.2)' }}>Unverified</span>
                      )}
                      {s.sponsorship_type && (
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', background: 'rgba(255,255,255,.04)', padding: '1px 7px', borderRadius: 8 }}>
                          {s.sponsorship_type}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      {s.video_id && (
                        <a href={`https://youtube.com/watch?v=${s.video_id}`}
                          target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ fontSize: 11, padding: '5px 11px', borderRadius: 8, background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.4)', border: '0.5px solid rgba(255,255,255,.08)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <i className="ti ti-player-play" style={{ fontSize: 11 }} aria-hidden="true" />
                          Watch
                        </a>
                      )}
                      {hasDeal && (
                        <button className="deal-btn"
                          onClick={e => {
                            e.stopPropagation()
                            if (s.promo_code) copyCode(s.promo_code, s.id)
                            else setExpanded(s.id)
                          }}
                          style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, background: copied === s.id ? 'rgba(34,197,94,.15)' : cfg.bg, color: copied === s.id ? '#34D399' : cfg.color, border: `0.5px solid ${copied === s.id ? 'rgba(34,197,94,.3)' : cfg.border}`, cursor: 'pointer', transition: 'all .15s', fontWeight: 500 }}>
                          {copied === s.id ? '✓ Copied' : s.promo_code ? 'Get code' : 'See deal'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded deal panel */}
                  {isOpen && hasDeal && (
                    <div style={{ marginTop: 12, padding: 12, background: 'rgba(255,255,255,.04)', borderRadius: 12, border: `0.5px solid ${cfg.border}` }}
                      onClick={e => e.stopPropagation()}>
                      {s.offer_text && (
                        <p style={{ fontSize: 12, color: '#34D399', marginBottom: s.promo_code ? 10 : 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <i className="ti ti-gift" style={{ fontSize: 14 }} aria-hidden="true" />
                          {s.offer_text}
                        </p>
                      )}
                      {s.promo_code && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,.06)', borderRadius: 9, padding: '9px 12px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 600, color: '#fff', letterSpacing: '.08em' }}>
                            {s.promo_code}
                          </span>
                          <button onClick={() => copyCode(s.promo_code, s.id)}
                            style={{ fontSize: 12, padding: '5px 14px', borderRadius: 7, background: copied === s.id ? 'rgba(34,197,94,.2)' : cfg.bg, color: copied === s.id ? '#34D399' : cfg.color, border: `0.5px solid ${cfg.border}`, cursor: 'pointer', fontWeight: 600 }}>
                            {copied === s.id ? '✓ Copied!' : 'Copy code'}
                          </button>
                        </div>
                      )}
                      {s.promo_url && !s.promo_code && (
                        <a href={s.promo_url} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: cfg.color, textDecoration: 'none', marginTop: 6 }}>
                          <i className="ti ti-external-link" style={{ fontSize: 13 }} aria-hidden="true" />
                          Go to deal
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Infinite scroll trigger */}
            <div ref={loaderRef} style={{ padding: '20px 0', textAlign: 'center' }}>
              {loading && page > 0 && (
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,.2)' }}>Loading more...</p>
              )}
              {!hasMore && feed.length > 0 && (
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,.15)' }}>You're all caught up</p>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}