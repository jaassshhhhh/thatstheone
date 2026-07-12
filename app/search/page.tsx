'use client'
import { useSearchParams } from 'next/navigation'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { getFreshnessTier, getFreshnessColor, getFreshnessLine } from '../lib/freshness'

const SESSION_KEY = 'tto_session'

function getSession() {
  if (typeof window === 'undefined') return null
  let session = localStorage.getItem(SESSION_KEY)
  if (!session) { session = crypto.randomUUID(); localStorage.setItem(SESSION_KEY, session) }
  return session
}

async function trackSignal(type: string, value: string) {
  const session = getSession()
  if (!session) return
  await supabase.from('user_signals').insert({ session_id: session, signal_type: type, value })
}

async function trackSearch(query: string, hadResults: boolean) {
  if (!query || query.length < 2) return
  await supabase.rpc('increment_search_count', { query_param: query.toLowerCase(), had_results_param: hadResults })
  await trackSignal('search', query)
}

// Fixed curated filters — not dynamic from DB
const FILTERS = ['All', 'Finance', 'Tech', 'Health', 'Fitness', 'Lifestyle', 'Gaming', 'Education', 'Beauty', 'Food', 'Productivity']

function SearchContent() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState('All')
  const [filterOpen, setFilterOpen] = useState(false)
  const [trending, setTrending] = useState<any[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const searchParams = useSearchParams()

  useEffect(() => {
    loadTrending()
    loadCount()
    const recent = JSON.parse(localStorage.getItem('tto_recent') || '[]')
    setRecentSearches(recent)
    const q = searchParams.get('q')
    if (q) { setQuery(q); search(q, 'All') }
  }, [])

  async function loadCount() {
    const { count } = await supabase.from('sponsorships').select('*', { count: 'exact', head: true })
    setTotalCount(count || 0)
  }

  async function loadTrending() {
    const { data } = await supabase
      .from('creator_brand_relationships')
      .select(`id, best_code, brand_name, creator_name, brand_slug, creator_slug, last_seen`)
      .not('best_code', 'is', null)
      .order('last_seen', { ascending: false })
      .limit(20)
    const seen = new Set()
    const deduped = (data || []).filter((r: any) => {
      const key = `${r.brand_slug}-${r.creator_slug}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 8)
    setTrending(deduped)
  }

  const search = useCallback(async (q: string, filter: string) => {
    if (!q.trim()) { setResults([]); setHasSearched(false); return }
    setLoading(true)
    setHasSearched(true)

    const recent = JSON.parse(localStorage.getItem('tto_recent') || '[]')
    const updated = [q, ...recent.filter((r: string) => r !== q)].slice(0, 5)
    localStorage.setItem('tto_recent', JSON.stringify(updated))
    setRecentSearches(updated)

    const { data: matchingBrands } = await supabase.from('brands').select('id').ilike('name', `%${q}%`).limit(30)
    const { data: matchingCreators } = await supabase.from('creators').select('id').ilike('name', `%${q}%`).limit(30)

    const brandIds = (matchingBrands || []).map((b: any) => b.id)
    const creatorIds = (matchingCreators || []).map((c: any) => c.id)

    // Semantic search always runs alongside substring matching, not just when
    // substring finds nothing — a partial substring match (e.g. "vpn" matching
    // ExpressVPN/NordVPN by literal name) shouldn't silently block genuinely
    // related brands whose name doesn't contain the query text (e.g. Surfshark).
    let semanticBrandIds: string[] = []
    try {
      const res = await fetch('/api/semantic-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      const { results: semanticBrands } = await res.json()
      // Only pull in reasonably confident matches — raw cosine similarity below
      // ~0.35 tends to be noise rather than a genuine conceptual match.
      semanticBrandIds = (semanticBrands || [])
        .filter((b: any) => b.similarity >= 0.35)
        .map((b: any) => b.id)
    } catch { /* semantic search is a nice-to-have — substring results still work without it */ }

    if (brandIds.length === 0 && creatorIds.length === 0 && semanticBrandIds.length === 0) {
      await trackSearch(q, false)
      setResults([]); setLoading(false); return
    }
    await trackSearch(q, true)

    const fields = `id, brand_id, creator_id, promo_code, promo_url, video_id, video_title, is_active, first_seen, last_seen, offer_text, exact_quote, sponsorship_type, platform, is_organic, headline, dar_score, product_mentioned, product_url, brands ( name, slug, website_url, description ), creators ( name, slug, subscriber_count, category )`
    const { data: byBrand } = brandIds.length
      ? await supabase.from('sponsorships').select(fields).in('brand_id', brandIds).limit(30)
      : { data: [] }

    const { data: byCreator } = creatorIds.length
      ? await supabase.from('sponsorships').select(fields).in('creator_id', creatorIds).limit(30)
      : { data: [] }

    // Exclude brands already found via substring, so semantic results only add
    // genuinely new brands (e.g. Surfshark) rather than duplicating ExpressVPN etc.
    const newSemanticIds = semanticBrandIds.filter(id => !brandIds.includes(id))
    const { data: bySemantic } = newSemanticIds.length
      ? await supabase.from('sponsorships').select(fields).in('brand_id', newSemanticIds).limit(30)
      : { data: [] }

      const combined = [...(byBrand || []), ...(byCreator || []), ...(bySemantic || [])]
      const seenIds = new Set()
      const uniqueRows = combined.filter((r: any) => {
        if (!r.brands || !r.creators) return false
        if (seenIds.has(r.id)) return false
        seenIds.add(r.id)
        return true
      })

      // Pool by creator+brand pair — one card per relationship, with a real
      // mention count and every other mention available to expand, instead of
      // showing near-identical flat cards for the same creator repeatedly
      // mentioning the same brand.
      const groups: Record<string, any[]> = {}
      for (const r of uniqueRows) {
        const key = `${r.brand_id}-${r.creator_id}`
        if (!groups[key]) groups[key] = []
        groups[key].push(r)
      }
      const pooled = Object.values(groups).map((rows: any[]) => {
        const sorted = [...rows].sort((a, b) => {
          if (!!a.promo_code !== !!b.promo_code) return a.promo_code ? -1 : 1
          return (b.dar_score || 0) - (a.dar_score || 0)
        })
        // The hero row is picked for having the best code/score, but the freshness
        // line should reflect the group's true most recent mention, not just the
        // hero's own date — otherwise a stale hero can wrongly show "27mo ago" when
        // a 2-day-old mention exists elsewhere in the same group.
        const mostRecent = rows.reduce((latest, r) =>
          new Date(r.last_seen || r.first_seen) > new Date(latest.last_seen || latest.first_seen) ? r : latest
        , rows[0])
        return {
          ...sorted[0],
          mention_count: rows.length,
          other_mentions: sorted.slice(1),
          last_seen: mostRecent.last_seen,
          first_seen: rows.reduce((earliest, r) => new Date(r.first_seen) < new Date(earliest.first_seen) ? r : earliest, rows[0]).first_seen,
        }
      })

    const filtered = filter === 'All'
      ? pooled
      : pooled.filter((r: any) => r.creators?.category?.toLowerCase().includes(filter.toLowerCase()))

    setResults(filtered)
    setLoading(false)
  }, [])

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); search(query, activeFilter) }

  const copyCode = async (code: string, brand: string) => {
    await navigator.clipboard.writeText(code)
    setCopied(code)
    await trackSignal('copy', brand)
    setTimeout(() => setCopied(null), 2000)
  }

  const timeAgo = (date: string) => {
    if (!date) return ''
    const d = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
    if (d === 0) return 'Today'
    if (d === 1) return 'Yesterday'
    if (d < 7) return `${d}d ago`
    if (d < 30) return `${Math.floor(d / 7)}w ago`
    return `${Math.floor(d / 30)}mo ago`
  }

  const activeFilterLabel = activeFilter === 'All' ? 'All categories' : activeFilter

  return (
    <Layout>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        .rc { animation: fadeIn .3s ease forwards; transition: border-color .2s }
        .rc:hover { border-color: rgba(99,102,241,.4) !important }
        .rb:hover { background: rgba(255,255,255,.08) !important }
        .dd { position: absolute; top: calc(100% + 6px); left: 0; right: 0; background: #0e1120; border: 1px solid rgba(255,255,255,.1); border-radius: 12px; overflow: hidden; z-index: 50; }
        .dd-item:hover { background: rgba(99,102,241,.1) !important; color: #818CF8 !important }
      `}</style>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 'clamp(22px,4vw,32px)', fontWeight: 700, letterSpacing: '-.025em', marginBottom: 6, background: 'linear-gradient(135deg,#fff,rgba(255,255,255,.5))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Find that sponsorship
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.3)' }}>
            {totalCount.toLocaleString()} sponsorships indexed · search by creator, brand or deal
          </p>
        </div>

        {/* Search bar + filter dropdown */}
        <form onSubmit={handleSearch} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Category dropdown */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button type="button"
                onClick={() => setFilterOpen(o => !o)}
                style={{ height: '100%', padding: '0 14px', borderRadius: 12, background: activeFilter !== 'All' ? 'rgba(99,102,241,.15)' : 'rgba(255,255,255,.05)', border: `1px solid ${activeFilter !== 'All' ? 'rgba(99,102,241,.4)' : 'rgba(255,255,255,.1)'}`, color: activeFilter !== 'All' ? '#818CF8' : 'rgba(255,255,255,.5)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                {activeFilterLabel} {filterOpen ? '▲' : '▼'}
              </button>
              {filterOpen && (
                <div className="dd">
                  {FILTERS.map(f => (
                    <button key={f} type="button" className="dd-item"
                      onClick={() => { setActiveFilter(f); setFilterOpen(false); if (query) search(query, f) }}
                      style={{ width: '100%', padding: '9px 14px', background: activeFilter === f ? 'rgba(99,102,241,.1)' : 'transparent', border: 'none', color: activeFilter === f ? '#818CF8' : 'rgba(255,255,255,.5)', fontSize: 13, cursor: 'pointer', textAlign: 'left', transition: 'all .15s' }}>
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search input */}
            <div style={{ flex: 1, display: 'flex', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: '4px 4px 4px 16px' }}>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder='Try "NordVPN" or "Ali Abdaal" or "Gymshark"'
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: '#fff', padding: '8px 0' }}
                autoFocus
              />
              <button type="submit"
                style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', border: 'none', borderRadius: 9, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {loading ? '...' : 'Search'}
              </button>
            </div>
          </div>
        </form>

        {/* Recent searches */}
        {recentSearches.length > 0 && !hasSearched && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Recent</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {recentSearches.map(r => (
                <button key={r} className="rb"
                  onClick={() => { setQuery(r); search(r, activeFilter) }}
                  style={{ fontSize: 12, padding: '5px 14px', borderRadius: 20, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', color: 'rgba(255,255,255,.5)', cursor: 'pointer', transition: 'all .15s' }}>
                  ↗ {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,.25)' }}>
            <p style={{ fontSize: 13 }}>Searching...</p>
          </div>
        )}

        {/* No results */}
        {!loading && hasSearched && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: 32, marginBottom: 10 }}>◎</p>
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No results for "{query}"</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.3)', marginBottom: 20 }}>Try a brand name or creator name</p>
            <button onClick={() => { setQuery(''); setHasSearched(false) }}
              style={{ fontSize: 13, padding: '8px 20px', borderRadius: 20, background: 'rgba(99,102,241,.15)', color: '#818CF8', border: '1px solid rgba(99,102,241,.25)', cursor: 'pointer' }}>
              Clear
            </button>
          </div>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,.25)' }}>{results.length} results for "{query}"</p>
              <button onClick={() => { setQuery(''); setHasSearched(false); setResults([]) }}
                style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Clear ×
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {results.map((r: any, i: number) => {
                const promoUrl = r.product_url || r.promo_url || r.brands?.website_url
                const isYouTube = r.video_id && !r.video_id.startsWith('linktree_') && !r.video_id.startsWith('amazon_')
                const platformLabel = r.platform === 'linktree' ? '🌳 linktree' : r.platform === 'amazon' ? '🛒 amazon' : r.platform

                return (
                  <div key={r.id} className="rc"
                    style={{ animationDelay: `${i * 0.04}s`, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: 18 }}>

                    {r.headline && (
                      <p style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif', fontSize: 15, color: '#fff', margin: '0 0 12px', lineHeight: 1.4 }}>
                        {r.headline}
                      </p>
                    )}

                    {/* Top row */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(99,102,241,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#818CF8', flexShrink: 0 }}>
                          {r.brands?.name?.[0]?.toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: '#fff' }}>{r.brands?.name}</p>
                            {r.is_organic && (
  <span style={{ fontSize: 10, color: '#34D399', background: 'rgba(52,211,153,.1)', padding: '2px 8px', borderRadius: 8, fontWeight: 600 }}>🌱 Genuinely uses — not sponsored</span>
)}
                          </div>
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', margin: '2px 0 0' }}>
                            via {r.creators?.name} · {platformLabel}
                            {r.mention_count > 1 && (
                              <span style={{ color: 'rgba(255,255,255,.25)' }}> · mentioned {r.mention_count} times</span>
                            )}
                          </p>
                          {r.product_mentioned && (
                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', margin: '2px 0 0' }}>
                              recommends: <span style={{ color: 'rgba(255,255,255,.55)' }}>{r.product_mentioned}</span>
                            </p>
                          )}
                          {r.brands?.description && (
                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', margin: '3px 0 0', lineHeight: 1.4 }}>
                              {r.brands.description}
                            </p>
                          )}
                          {(() => {
                            const tier = getFreshnessTier(r.last_seen || r.first_seen)
                            return (
                              <p style={{ fontSize: 11, color: getFreshnessColor(tier), margin: '4px 0 0' }}>
                                {getFreshnessLine({ tier, lastSeen: r.last_seen || r.first_seen, firstSeen: r.first_seen, mentionCount: 1, timeAgo })}
                              </p>
                            )
                          })()}
                        </div>
                      </div>
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: r.is_active ? 'rgba(34,197,94,.1)' : 'rgba(255,255,255,.05)', color: r.is_active ? '#4ADE80' : 'rgba(255,255,255,.3)', border: `1px solid ${r.is_active ? 'rgba(34,197,94,.2)' : 'rgba(255,255,255,.08)'}`, flexShrink: 0 }}>
                        {r.is_active ? 'Active' : 'Unverified'}
                      </span>
                    </div>

                    {/* Quote */}
                    {r.is_organic ? (
  <p style={{ fontSize: 11, color: '#34D399', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 5 }}>
    💡 {r.creators?.name} personally recommends this — no brand deal involved
  </p>
) : r.promo_code || r.offer_text ? (
  <p style={{ fontSize: 11, color: '#818CF8', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 5 }}>
    🎯 Sponsored deal — {r.offer_text || 'use code below'}
  </p>
) : null}

{r.exact_quote && (
  <div style={{ background: 'rgba(52,211,153,.05)', borderRadius: 10, padding: '12px 14px', margin: '0 0 10px', borderLeft: '3px solid #34D399' }}>
    <p style={{ fontSize: 14, color: 'rgba(255,255,255,.85)', margin: 0, lineHeight: 1.6, fontStyle: 'italic', fontWeight: 500 }}>
      "{r.exact_quote.slice(0, 200)}{r.exact_quote.length > 200 ? '...' : ''}"
    </p>
  </div>
)}

                    {/* Offer */}
                    {r.offer_text && (
                      <p style={{ fontSize: 12, color: '#34D399', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        🎁 {r.offer_text}
                      </p>
                    )}

                    {/* Video title */}
                    {r.video_title && isYouTube && (
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', margin: '0 0 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        📺 {r.video_title}
                      </p>
                    )}

                    {/* Bottom row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                    {r.promo_code ? (
  <span style={{ fontFamily: 'monospace', fontSize: 13, background: 'rgba(255,255,255,.07)', padding: '4px 10px', borderRadius: 6, letterSpacing: '.05em', color: '#fff' }}>
    {r.promo_code}
  </span>
) : r.is_organic ? (
  <span style={{ fontSize: 11, color: '#34D399' }}>
    No deal — just a genuine recommendation
  </span>
) : (
  <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', fontStyle: 'italic' }}>
    Mentioned, no specific offer
  </span>
)}
                     <div style={{ display: 'flex', gap: 8 }}>
  {isYouTube && r.video_id && (
    <a href={`https://youtube.com/watch?v=${r.video_id}`} target="_blank" rel="noopener noreferrer"
      style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.35)', border: '1px solid rgba(255,255,255,.08)', textDecoration: 'none' }}>
      Watch ▶
    </a>
  )}
  {promoUrl ? (
    <a href={promoUrl} target="_blank" rel="noopener noreferrer"
      style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, background: 'rgba(99,102,241,.1)', color: '#818CF8', border: '1px solid rgba(99,102,241,.2)', textDecoration: 'none' }}>
      Visit brand →
    </a>
  ) : r.is_organic && (
    <a  href={`https://www.google.com/search?q=${encodeURIComponent('"' + (r.brands?.name || '') + '" official website')}&btnI=1`}target="_blank" rel="noopener noreferrer"
      style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, background: 'rgba(52,211,153,.1)', color: '#34D399', border: '1px solid rgba(52,211,153,.2)', textDecoration: 'none' }}>
      Find this product →
    </a>
  )}
  {r.promo_code && (
    <button onClick={() => copyCode(r.promo_code, r.brands?.name)}
      style={{ fontSize: 11, padding: '5px 14px', borderRadius: 8, background: copied === r.promo_code ? 'rgba(34,197,94,.15)' : 'rgba(99,102,241,.15)', color: copied === r.promo_code ? '#4ADE80' : '#818CF8', border: `1px solid ${copied === r.promo_code ? 'rgba(34,197,94,.3)' : 'rgba(99,102,241,.25)'}`, cursor: 'pointer', fontWeight: 500 }}>
      {copied === r.promo_code ? '✓ Copied!' : 'Copy code'}
    </button>
  )}
</div>
                    </div>

                    {r.mention_count > 1 && (
                      <div style={{ marginTop: 10 }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                          style={{ fontSize: 11, color: '#818CF8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          {expandedId === r.id ? '▲' : '▼'} {r.other_mentions.length} other mention{r.other_mentions.length !== 1 ? 's' : ''}
                        </button>
                        {expandedId === r.id && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                            {r.other_mentions.map((m: any) => (
                              <div key={m.id} style={{ background: 'rgba(255,255,255,.03)', borderRadius: 10, padding: '10px 12px', fontSize: 11, color: 'rgba(255,255,255,.5)' }}>
                                {m.product_mentioned ? `${m.product_mentioned} · ` : ''}
                                {m.promo_code ? `code ${m.promo_code} · ` : ''}
                                {timeAgo(m.first_seen)}
                                {m.video_title && (
                                  <div style={{ marginTop: 2, color: 'rgba(255,255,255,.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {m.video_title}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Trending — shown when no search */}
        {!hasSearched && trending.length > 0 && (
          <div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Latest indexed</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {trending.map((r: any) => (
                <div key={r.id}
                  style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 12, transition: 'border-color .2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,.35)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,.07)'}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99,102,241,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#818CF8', flexShrink: 0 }}>
                    {r.brand_name?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: '#fff' }}>
                      {r.brand_slug ? (
                        <a href={`/brands/${r.brand_slug}`} style={{ color: '#fff', textDecoration: 'none' }}>{r.brand_name}</a>
                      ) : r.brand_name}
                    </p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', margin: '1px 0 0' }}>
                      via{' '}
                      {r.creator_slug ? (
                        <a href={`/creators/${r.creator_slug}`} style={{ color: 'rgba(255,255,255,.3)', textDecoration: 'none' }}>{r.creator_name}</a>
                      ) : r.creator_name}
                    </p>
                  </div>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, background: 'rgba(255,255,255,.07)', padding: '3px 9px', borderRadius: 5, flexShrink: 0, color: '#fff' }}>
                    {r.best_code}
                  </span>
                  <button onClick={() => copyCode(r.best_code, r.brand_name)}
                    style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, background: copied === r.best_code ? 'rgba(34,197,94,.15)' : 'rgba(99,102,241,.15)', color: copied === r.best_code ? '#4ADE80' : '#818CF8', border: `1px solid ${copied === r.best_code ? 'rgba(34,197,94,.3)' : 'rgba(99,102,241,.25)'}`, cursor: 'pointer', flexShrink: 0 }}>
                    {copied === r.best_code ? '✓' : 'Copy'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div style={{ background: '#060810', minHeight: '100vh' }} />}>
      <SearchContent />
    </Suspense>
  )
}