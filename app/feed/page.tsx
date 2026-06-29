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
  VELOCITY: { label: 'Blowing up',         icon: 'ti-flame',        color: '#F87171', bg: 'rgba(239,68,68,.1)',   border: 'rgba(239,68,68,.25)' },
  ORGANIC:  { label: 'Genuine love',       icon: 'ti-heart',        color: '#34D399', bg: 'rgba(16,185,129,.1)',  border: 'rgba(16,185,129,.25)' },
  NEW_DEAL: { label: 'Just dropped',       icon: 'ti-speakerphone', color: '#818CF8', bg: 'rgba(99,102,241,.1)', border: 'rgba(99,102,241,.25)' },
  TRENDING: { label: 'Everyone\'s talking', icon: 'ti-trending-up', color: '#FBBF24', bg: 'rgba(245,158,11,.1)', border: 'rgba(245,158,11,.25)' },
  MULTI:    { label: 'Creator consensus',  icon: 'ti-users',        color: '#C084FC', bg: 'rgba(139,92,246,.1)', border: 'rgba(139,92,246,.25)' },
  HOT:      { label: 'Limited deal',       icon: 'ti-bolt',         color: '#34D399', bg: 'rgba(16,185,129,.1)', border: 'rgba(16,185,129,.25)' },
  PERSONAL: { label: 'For you',            icon: 'ti-sparkles',     color: '#60A5FA', bg: 'rgba(59,130,246,.1)', border: 'rgba(59,130,246,.25)' },
}

function classifyCard(s: any, brandCountMap: Record<string, number>, userSearches: string[]): string {
  const brand = s.brand_name || s.brands?.name || ''
  const isSearched = userSearches.some(q => brand.toLowerCase().includes(q.toLowerCase()))
  if (isSearched) return 'PERSONAL'
  if (s.is_organic) return 'ORGANIC'
  const count = brandCountMap[brand] || 1
  if (count >= 3) return 'MULTI'
  if ((s.best_code || s.promo_code) && (s.best_offer || s.offer_text)) return 'HOT'
  const days = s.first_seen ? Math.floor((Date.now() - new Date(s.first_seen).getTime()) / 86400000) : 999
  if (days <= 14) return 'NEW_DEAL'
  return 'TRENDING'
}

function generateHeadline(s: any, cardType: string, userSearches: string[], brandCountMap: Record<string, number> = {}): string {
  const brand = s.brand_name || s.brands?.name || 'this brand'
  const creator = s.creator_name || s.creators?.name || 'a creator'
  const subs = s.subscriber_count || s.creators?.subscriber_count
  const subStr = subs >= 1000000 ? `${(subs / 1000000).toFixed(1)}M` : subs >= 1000 ? `${Math.round(subs / 1000)}k` : ''
  const mentions = s.mention_count || 1
  const isSearched = userSearches.some(q => brand.toLowerCase().includes(q.toLowerCase()) || q.toLowerCase().includes(brand.toLowerCase()))

  if (isSearched) return `You searched this — ${creator} promoted ${brand} ${mentions > 1 ? `${mentions} times` : 'recently'}`
  if (cardType === 'ORGANIC') return `${creator} genuinely loves ${brand} — no deal attached`
  if (cardType === 'MULTI') return `${brand} appearing across ${brandCountMap[brand] || mentions} creators this week`
  if (cardType === 'HOT') return `${creator} has a deal on ${brand} you won't find elsewhere`
  if (mentions >= 5) return `${creator} has mentioned ${brand} ${mentions} times — that's conviction`
  if (cardType === 'NEW_DEAL') return `${brand} just started working with ${subStr ? `${subStr} creator ` : ''}${creator}`
  if (s.best_offer || s.offer_text) return `${creator} has a ${s.best_offer || s.offer_text} deal on ${brand}`
  if (s.best_code || s.promo_code) return `${creator}'s ${brand} code — ${mentions > 1 ? `mentioned ${mentions} times` : 'active now'}`
  return `${creator} and ${brand} — ${mentions > 1 ? `${mentions} mentions` : 'new partnership'}`
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

const FILTERS = ['All', 'For you', 'Trending', 'Deals', 'Organic', 'New']

const REACTIONS = [
  { type: 'upvote',       emoji: '👍', label: 'Helpful',    activeBg: 'rgba(99,102,241,.15)', activeColor: '#818CF8', activeBorder: 'rgba(99,102,241,.3)' },
  { type: 'code_worked',  emoji: '✓',  label: 'Worked',     activeBg: 'rgba(52,211,153,.1)',  activeColor: '#34D399', activeBorder: 'rgba(52,211,153,.3)' },
  { type: 'code_expired', emoji: '✗',  label: 'Expired',    activeBg: 'rgba(239,68,68,.1)',   activeColor: '#F87171', activeBorder: 'rgba(239,68,68,.3)' },
  { type: 'use_this',     emoji: '♥',  label: 'I use this', activeBg: 'rgba(236,72,153,.1)',  activeColor: '#F472B6', activeBorder: 'rgba(236,72,153,.3)' },
]

export default function FeedPage() {
  const [feed, setFeed] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [userSearches, setUserSearches] = useState<string[]>([])
  const [reactionCounts, setReactionCounts] = useState<Record<string, Record<string, number>>>({})
  const [myReactions, setMyReactions] = useState<Record<string, string[]>>({})
  const loaderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const recent = JSON.parse(localStorage.getItem('tto_recent') || '[]')
    setUserSearches(recent)
    supabase.from('sponsorships').select('*', { count: 'exact', head: true }).then(({ count }) => setTotalCount(count || 0))
  }, [])

  useEffect(() => { loadFeed(0, true) }, [filter, userSearches])

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
  }, [hasMore, loading, page])

  async function loadFeed(pageNum: number, reset = false) {
    setLoading(true)
    const from = pageNum * 20
    const to = from + 19

    if (filter === 'For you' && userSearches.length === 0) {
      setFeed([])
      setLoading(false)
      return
    }

    let q = supabase
      .from('creator_brand_relationships')
      .select('*')
      .order('best_dar_score', { ascending: false })
      .order('last_seen', { ascending: false })
      .range(from, to)

    if (filter === 'Deals') q = q.not('best_code', 'is', null)
    if (filter === 'Organic') q = q.eq('is_organic', true)
    if (filter === 'New') q = q.gte('first_seen', new Date(Date.now() - 14 * 86400000).toISOString())
    if (filter === 'Trending') q = q.gte('best_dar_score', 70)

    const { data } = await q
    const items = (data || []).filter((s: any) => s.brand_name && s.creator_name)

    const brandMap: Record<string, number> = {}
    items.forEach((s: any) => { brandMap[s.brand_name || ''] = (brandMap[s.brand_name || ''] || 0) + 1 })

    const classified = items.map((s: any) => {
      const cardType = classifyCard(s, brandMap, userSearches)
      return {
        ...s,
        cardType,
        headline: s.headline || generateHeadline(s, cardType, userSearches, brandMap),
      }
    })

    let filtered = classified
    if (filter === 'For you') filtered = classified.filter(s => s.cardType === 'PERSONAL')

    const ids = classified.filter((s: any) => s.id).map((s: any) => s.id)
    if (ids.length) {
      const session = getSession()
      const [{ data: allRx }, { data: myRx }] = await Promise.all([
        supabase.from('user_reactions').select('target_id,reaction_type').in('target_id', ids),
        supabase.from('user_reactions').select('target_id,reaction_type').in('target_id', ids).eq('session_id', session!),
      ])
      const counts: Record<string, Record<string, number>> = {}
      for (const row of allRx || []) {
        if (!counts[row.target_id]) counts[row.target_id] = {}
        counts[row.target_id][row.reaction_type] = (counts[row.target_id][row.reaction_type] || 0) + 1
      }
      const mine: Record<string, string[]> = {}
      for (const row of myRx || []) {
        if (!mine[row.target_id]) mine[row.target_id] = []
        mine[row.target_id].push(row.reaction_type)
      }
      if (reset) { setReactionCounts(counts); setMyReactions(mine) }
      else { setReactionCounts(prev => ({ ...prev, ...counts })); setMyReactions(prev => ({ ...prev, ...mine })) }
    }

    if (reset) setFeed(filtered)
    else setFeed(prev => [...prev, ...filtered])
    setHasMore(items.length === 20)
    setLoading(false)
  }

  async function toggleReaction(e: React.MouseEvent, stateKey: string, reactionType: string, dbId?: string) {
    e.stopPropagation()
    const session = getSession()
    if (!session) return
    const isActive = myReactions[stateKey]?.includes(reactionType)
    setMyReactions(prev => ({ ...prev, [stateKey]: isActive ? (prev[stateKey] || []).filter(r => r !== reactionType) : [...(prev[stateKey] || []), reactionType] }))
    setReactionCounts(prev => {
      const cur = prev[stateKey] || {}
      return { ...prev, [stateKey]: { ...cur, [reactionType]: Math.max(0, (cur[reactionType] || 0) + (isActive ? -1 : 1)) } }
    })
    if (!dbId) return
    if (isActive) {
      await supabase.from('user_reactions').delete().eq('session_id', session).eq('target_id', dbId).eq('reaction_type', reactionType)
    } else {
      await supabase.from('user_reactions').insert({ session_id: session, target_id: dbId, reaction_type: reactionType })
      if (reactionType === 'code_expired') {
        const newCount = (reactionCounts[stateKey]?.code_expired || 0) + 1
        if (newCount >= 5) {
          await supabase.from('sponsorships').update({ is_active: false }).eq('id', dbId)
          setFeed(prev => prev.map((s: any) => s.id === dbId ? { ...s, is_active: false } : s))
        }
      }
    }
  }

  const copyCode = async (code: string, id: string, brand: string) => {
    await navigator.clipboard.writeText(code)
    setCopied(id)
    track('copy', brand)
    setTimeout(() => setCopied(null), 2000)
  }

  const isHero = (s: any, i: number) => i === 0 || s.cardType === 'PERSONAL' || s.cardType === 'VELOCITY'

  return (
    <Layout>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.4} }
        .fc { animation: fadeUp .35s ease forwards; transition: border-color .2s, transform .2s }
        .fc:hover { border-color: rgba(255,255,255,.15) !important; transform: translateY(-1px) }
        .filt:hover { background: rgba(255,255,255,.07) !important }
      `}</style>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 14px 40px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.03em', color: '#fff', margin: '0 0 2px' }}>
              Pulse
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#34D399', marginLeft: 8, verticalAlign: 'middle', animation: 'pulse 2s infinite' }} />
            </h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', margin: 0 }}>
              {totalCount.toLocaleString()} sponsorships indexed · live
            </p>
          </div>
          {userSearches.length > 0 && (
            <div style={{ fontSize: 11, padding: '5px 10px', borderRadius: 20, background: 'rgba(59,130,246,.1)', color: '#60A5FA', border: '0.5px solid rgba(59,130,246,.2)' }}>
              ✦ Personalised
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 2 }}>
          {FILTERS.map(f => (
            <button key={f} className="filt" onClick={() => { setFilter(f); setPage(0) }}
              style={{ fontSize: 11, padding: '5px 13px', borderRadius: 20, border: '0.5px solid', whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all .15s', borderColor: filter === f ? '#6366F1' : 'rgba(255,255,255,.08)', background: filter === f ? 'rgba(99,102,241,.15)' : 'transparent', color: filter === f ? '#818CF8' : 'rgba(255,255,255,.4)' }}>
              {f === 'For you' ? '✦ For you' : f}
            </button>
          ))}
        </div>

        {loading && page === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,.2)' }}>
            <p style={{ fontSize: 13 }}>Loading pulse...</p>
          </div>
        ) : filter === 'For you' && feed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', background: 'rgba(255,255,255,.02)', borderRadius: 16, border: '0.5px solid rgba(255,255,255,.07)' }}>
            <p style={{ fontSize: 28, marginBottom: 12 }}>✦</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 8 }}>Nothing personalised yet</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', marginBottom: 20, lineHeight: 1.6 }}>Search for brands or creators you care about<br />and we'll tailor your feed automatically</p>
            <button onClick={() => setFilter('All')}
              style={{ fontSize: 13, padding: '8px 20px', borderRadius: 20, background: 'rgba(99,102,241,.15)', color: '#818CF8', border: '0.5px solid rgba(99,102,241,.25)', cursor: 'pointer' }}>
              Browse all
            </button>
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
              const isOpen = expanded === s.id || expanded === `${s.creator_id}-${s.brand_id}`
              const cardId = s.id || `${s.creator_id}-${s.brand_id}`
              const hasDeal = s.best_code || s.promo_code || s.best_offer || s.offer_text || s.promo_url
              const hero = isHero(s, i)
              const quote = s.best_quote || s.exact_quote
              const code = s.best_code || s.promo_code
              const offer = s.best_offer || s.offer_text
              const videoId = s.best_video_id || s.video_id

              return (
                <div key={cardId} className="fc"
                  style={{
                    animationDelay: `${Math.min(i, 8) * 0.04}s`,
                    background: hero ? 'rgba(99,102,241,.06)' : 'rgba(255,255,255,.03)',
                    border: `0.5px solid ${hero ? 'rgba(99,102,241,.2)' : 'rgba(255,255,255,.07)'}`,
                    borderRadius: hero ? 20 : 16,
                    padding: hero ? '20px' : '16px',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  onClick={() => { setExpanded(isOpen ? null : cardId); track('click', s.brand_name || '') }}>

                  <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: cfg.color, opacity: hero ? .1 : .06, filter: 'blur(24px)', pointerEvents: 'none' }} />

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: cfg.bg, color: cfg.color, border: `0.5px solid ${cfg.border}`, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                      <i className={`ti ${cfg.icon}`} style={{ fontSize: 11 }} aria-hidden="true" />
                      {cfg.label}
                    </div>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,.2)' }}>{timeAgo(s.last_seen || s.first_seen)}</span>
                  </div>

                  <p style={{ fontSize: hero ? 16 : 14, fontWeight: 700, color: '#fff', margin: '0 0 12px', lineHeight: 1.3, letterSpacing: '-.01em' }}>
                    {s.headline}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: cfg.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: cfg.color, flexShrink: 0 }}>
                      {(s.brand_name || s.brands?.name)?.[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: '#fff' }}>{s.brand_name || s.brands?.name}</p>
                        {s.mention_count > 1 && (
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', background: 'rgba(255,255,255,.06)', padding: '1px 6px', borderRadius: 6 }}>
                            {s.mention_count}× mentioned
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', margin: 0 }}>via {s.creator_name || s.creators?.name}</p>
                        {(s.subscriber_count || s.creators?.subscriber_count) > 0 && (
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', background: 'rgba(255,255,255,.05)', padding: '1px 5px', borderRadius: 6 }}>
                            {formatSubs(s.subscriber_count || s.creators?.subscriber_count)}
                          </span>
                        )}
                      </div>
                    </div>
                    {(s.best_dar_score || s.dar_score) >= 75 && (
                      <i className="ti ti-shield-check" style={{ fontSize: 14, color: '#34D399', opacity: .6, flexShrink: 0 }} aria-hidden="true" />
                    )}
                  </div>

                  {quote && (
                    <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '9px 12px', marginTop: 12, borderLeft: `2px solid ${cfg.color}` }}>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
                        "{quote.slice(0, isOpen ? 300 : 100)}{!isOpen && quote.length > 100 ? '...' : ''}"
                      </p>
                    </div>
                  )}

                  {s.mention_count > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,.25)' }}>
                      <span>First seen {timeAgo(s.first_seen)}</span>
                      <span>·</span>
                      <span>Latest {timeAgo(s.last_seen)}</span>
                      <span>·</span>
                      <span style={{ color: 'rgba(255,255,255,.4)' }}>{s.mention_count} mentions</span>
                    </div>
                  )}

                  {s.video_title && isOpen && (
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', margin: '10px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <i className="ti ti-brand-youtube" style={{ fontSize: 12, marginRight: 4 }} aria-hidden="true" />
                      {s.video_title}
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, marginTop: 12, borderTop: '0.5px solid rgba(255,255,255,.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: s.is_active ? '#34D399' : 'rgba(255,255,255,.2)' }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.is_active ? '#34D399' : 'rgba(255,255,255,.2)', display: 'inline-block' }} />
                        {s.is_active ? 'Active' : 'Unverified'}
                      </span>
                      {s.platform && (
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', background: 'rgba(255,255,255,.04)', padding: '1px 6px', borderRadius: 6 }}>
                          {s.platform}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      {videoId && (
                        <a href={`https://youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.35)', border: '0.5px solid rgba(255,255,255,.08)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <i className="ti ti-player-play" style={{ fontSize: 10 }} aria-hidden="true" />
                          Watch
                        </a>
                      )}
                      {hasDeal && (
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            if (code) copyCode(code, cardId, s.brand_name || '')
                            else setExpanded(cardId)
                          }}
                          style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, background: copied === cardId ? 'rgba(34,197,94,.15)' : cfg.bg, color: copied === cardId ? '#34D399' : cfg.color, border: `0.5px solid ${copied === cardId ? 'rgba(34,197,94,.3)' : cfg.border}`, cursor: 'pointer', transition: 'all .15s', fontWeight: 600 }}>
                          {copied === cardId ? '✓ Copied' : code ? 'Get code' : 'See deal'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', paddingTop: 10, marginTop: 10, borderTop: '0.5px solid rgba(255,255,255,.04)' }}
                    onClick={e => e.stopPropagation()}>
                    {REACTIONS.map(r => {
                      const count = reactionCounts[cardId]?.[r.type] || 0
                      const active = myReactions[cardId]?.includes(r.type)
                      return (
                        <button key={r.type} onClick={e => toggleReaction(e, cardId, r.type, s.id)}
                          style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, border: '0.5px solid', cursor: 'pointer', transition: 'all .15s', background: active ? r.activeBg : 'transparent', color: active ? r.activeColor : 'rgba(255,255,255,.25)', borderColor: active ? r.activeBorder : 'rgba(255,255,255,.08)' }}>
                          {r.emoji} {r.label}{count > 0 ? ` · ${count}` : ''}
                        </button>
                      )
                    })}
                  </div>

                  {isOpen && hasDeal && (
                    <div style={{ marginTop: 12, padding: 12, background: 'rgba(255,255,255,.04)', borderRadius: 12, border: `0.5px solid ${cfg.border}` }}
                      onClick={e => e.stopPropagation()}>
                      {offer && (
                        <p style={{ fontSize: 12, color: '#34D399', marginBottom: code ? 10 : 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <i className="ti ti-gift" style={{ fontSize: 13 }} aria-hidden="true" />
                          {offer}
                        </p>
                      )}
                      {code && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,.06)', borderRadius: 9, padding: '9px 12px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '.08em' }}>
                            {code}
                          </span>
                          <button onClick={() => copyCode(code, cardId, s.brand_name || '')}
                            style={{ fontSize: 12, padding: '5px 14px', borderRadius: 7, background: copied === cardId ? 'rgba(34,197,94,.2)' : cfg.bg, color: copied === cardId ? '#34D399' : cfg.color, border: `0.5px solid ${cfg.border}`, cursor: 'pointer', fontWeight: 600 }}>
                            {copied === cardId ? '✓ Copied!' : 'Copy code'}
                          </button>
                        </div>
                      )}
                      {s.promo_url && !code && (
                        <a href={s.promo_url} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: cfg.color, textDecoration: 'none', marginTop: 6 }}>
                          <i className="ti ti-external-link" style={{ fontSize: 13 }} aria-hidden="true" />
                          Go to deal
                        </a>
                      )}
                      <a
                        href={s.promo_url || `https://www.google.com/search?q=${encodeURIComponent((s.brand_name || s.brands?.name || '') + ' official site')}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'rgba(255,255,255,.28)', textDecoration: 'none', marginTop: 10 }}>
                        Visit brand →
                      </a>
                    </div>
                  )}
                </div>
              )
            })}

            <div ref={loaderRef} style={{ padding: '20px 0', textAlign: 'center' }}>
              {loading && page > 0 && <p style={{ fontSize: 12, color: 'rgba(255,255,255,.2)' }}>Loading more...</p>}
              {!hasMore && feed.length > 0 && <p style={{ fontSize: 12, color: 'rgba(255,255,255,.15)' }}>You're all caught up ✓</p>}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}