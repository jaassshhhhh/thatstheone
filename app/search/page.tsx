'use client'
import { useSearchParams } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const SESSION_KEY = 'tto_session'

function getSession() {
  if (typeof window === 'undefined') return null
  let session = localStorage.getItem(SESSION_KEY)
  if (!session) {
    session = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, session)
  }
  return session
}

async function trackSignal(type: string, value: string) {
  const session = getSession()
  if (!session) return
  await supabase.from('user_signals').insert({ session_id: session, signal_type: type, value })
}

async function trackSearch(query: string) {
  if (!query || query.length < 2) return
  await supabase
    .from('search_trends')
    .upsert({ query: query.toLowerCase(), count: 1, last_searched: new Date().toISOString() }, { onConflict: 'query' })
  await trackSignal('search', query)
}

import { Suspense } from 'react'

function SearchContent() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState('All')
  const [categories, setCategories] = useState<string[]>(['All'])
  const [trending, setTrending] = useState<any[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const searchParams = useSearchParams()

  useEffect(() => {
    loadTrending()
    loadCategories()
    loadCount()
    const recent = JSON.parse(localStorage.getItem('tto_recent') || '[]')
    setRecentSearches(recent)
    const q = searchParams.get('q')
    if (q) {
      setQuery(q)
      search(q, 'All')
    }
  }, [])
 

  async function loadCount() {
    const { count } = await supabase
      .from('sponsorships')
      .select('*', { count: 'exact', head: true })
    setTotalCount(count || 0)
  }

  async function loadTrending() {
    const { data } = await supabase
      .from('sponsorships')
      .select(`
        id, promo_code, video_title, is_active,
        brands ( name, slug ),
        creators ( name, slug, subscriber_count )
      `)
      .eq('is_active', true)
      .not('promo_code', 'is', null)
      .order('created_at', { ascending: false })
      .limit(8)
    setTrending(data || [])
  }

  async function loadCategories() {
    const { data } = await supabase
      .from('creators')
      .select('category')
      .not('category', 'is', null)
    const unique = ['All', ...new Set((data || []).map((c: any) => c.category).filter(Boolean))]
    setCategories(unique)
  }

  const search = useCallback(async (q: string, category: string) => {
    if (!q.trim()) {
      setResults([])
      setHasSearched(false)
      return
    }
    setLoading(true)
    setHasSearched(true)
    await trackSearch(q)

    const recent = JSON.parse(localStorage.getItem('tto_recent') || '[]')
    const updated = [q, ...recent.filter((r: string) => r !== q)].slice(0, 5)
    localStorage.setItem('tto_recent', JSON.stringify(updated))
    setRecentSearches(updated)

    const { data: matchingBrands } = await supabase
      .from('brands').select('id').ilike('name', `%${q}%`).limit(30)
    const { data: matchingCreators } = await supabase
      .from('creators').select('id').ilike('name', `%${q}%`).limit(30)

    const brandIds = (matchingBrands || []).map((b: any) => b.id)
    const creatorIds = (matchingCreators || []).map((c: any) => c.id)

    if (brandIds.length === 0 && creatorIds.length === 0) {
      setResults([])
      setLoading(false)
      return
    }

    const { data: byBrand } = brandIds.length ? await supabase
      .from('sponsorships')
      .select(`id, promo_code, video_title, is_active, first_seen, last_seen, offer_text, exact_quote, sponsorship_type, brands ( name, slug ), creators ( name, slug, subscriber_count, category )`)
      .in('brand_id', brandIds).limit(30) : { data: [] }

    const { data: byCreator } = creatorIds.length ? await supabase
      .from('sponsorships')
      .select(`id, promo_code, video_title, is_active, first_seen, last_seen, offer_text, exact_quote, sponsorship_type, brands ( name, slug ), creators ( name, slug, subscriber_count, category )`)
      .in('creator_id', creatorIds).limit(30) : { data: [] }

    const combined = [...(byBrand || []), ...(byCreator || [])]
    const seen = new Set()
    const deduped = combined.filter((r: any) => {
      if (!r.brands || !r.creators) return false
      const key = `${r.brands.slug}-${r.creators.slug}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    const filtered = category === 'All'
      ? deduped
      : deduped.filter((r: any) => r.creators?.category === category)

    setResults(filtered)
    setLoading(false)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    search(query, activeCategory)
  }

  const copyCode = async (code: string, brand: string) => {
    await navigator.clipboard.writeText(code)
    setCopied(code)
    await trackSignal('copy', brand)
    setTimeout(() => setCopied(null), 2000)
  }

  const formatDate = (date: string) => {
    if (!date) return ''
    return new Date(date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
  }
  

  return (
    <Layout>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        .result-card { animation: fadeIn .3s ease forwards }
        .copy-btn:hover { opacity: .85 }
        .cat-btn:hover { border-color: rgba(99,102,241,.4) !important; color: #818CF8 !important }
        .recent-btn:hover { background: rgba(255,255,255,.08) !important }
      `}</style>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 16px' }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 'clamp(24px,4vw,36px)', fontWeight: 700, letterSpacing: '-.025em', marginBottom: 8, background: 'linear-gradient(135deg,#fff,rgba(255,255,255,.5))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Find that sponsorship
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,.3)' }}>
            {totalCount.toLocaleString()} sponsorships indexed · Search by creator, brand or category
          </p>
        </div>

        <form onSubmit={handleSearch} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, padding: '5px 5px 5px 18px' }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder='Try "Shopify" or "Huberman" or "VPN"'
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 15, color: '#fff', padding: '9px 0' }}
              autoFocus
            />
            <button type="submit" style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer', minWidth: 90 }}>
              {loading ? '...' : 'Search'}
            </button>
          </div>
        </form>

        {recentSearches.length > 0 && !hasSearched && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Recent</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {recentSearches.map(r => (
                <button key={r} className="recent-btn"
                  onClick={() => { setQuery(r); search(r, activeCategory) }}
                  style={{ fontSize: 12, padding: '5px 14px', borderRadius: 20, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', color: 'rgba(255,255,255,.5)', cursor: 'pointer', transition: 'all .15s' }}>
                  ↗ {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {categories.length > 1 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
            {categories.map(c => (
              <button key={c} className="cat-btn"
                onClick={() => { setActiveCategory(c); if (query) search(query, c) }}
                style={{ fontSize: 12, padding: '6px 16px', borderRadius: 20, border: '1px solid', borderColor: activeCategory === c ? '#6366F1' : 'rgba(255,255,255,.08)', background: activeCategory === c ? 'rgba(99,102,241,.15)' : 'transparent', color: activeCategory === c ? '#818CF8' : 'rgba(255,255,255,.4)', cursor: 'pointer', transition: 'all .15s' }}>
                {c}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,.25)' }}>
            <div style={{ fontSize: 28, marginBottom: 16, animation: 'spin 1s linear infinite', display: 'inline-block' }}>◌</div>
            <p style={{ fontSize: 14 }}>Searching...</p>
          </div>
        )}

        {!loading && hasSearched && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>◎</p>
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No results for "{query}"</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.3)', marginBottom: 20 }}>Try a brand name or creator name</p>
            <button onClick={() => { setQuery(''); setHasSearched(false) }}
              style={{ fontSize: 13, padding: '8px 20px', borderRadius: 20, background: 'rgba(99,102,241,.15)', color: '#818CF8', border: '1px solid rgba(99,102,241,.25)', cursor: 'pointer' }}>
              Clear
            </button>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,.25)' }}>{results.length} results for "{query}"</p>
              <button onClick={() => { setQuery(''); setHasSearched(false); setResults([]) }}
                style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', background: 'none', border: 'none', cursor: 'pointer' }}>Clear ×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {results.map((r: any, i: number) => (
                <div key={r.id} className="result-card"
                  style={{ animationDelay: `${i * 0.04}s`, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: 18, transition: 'border-color .2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,.4)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,.07)'}>

                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(99,102,241,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#818CF8', flexShrink: 0 }}>
                        {r.brands?.name?.[0]?.toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: '#fff' }}>{r.brands?.name}</p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', margin: '2px 0 0' }}>via {r.creators?.name} · {formatDate(r.first_seen)}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: r.is_active ? 'rgba(34,197,94,.1)' : 'rgba(255,255,255,.05)', color: r.is_active ? '#4ADE80' : 'rgba(255,255,255,.3)', border: `1px solid ${r.is_active ? 'rgba(34,197,94,.2)' : 'rgba(255,255,255,.08)'}` }}>
                        {r.is_active ? 'Active' : 'Unverified'}
                      </span>
                    </div>
                  </div>

                  {r.exact_quote && (
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', margin: '10px 0 0', lineHeight: 1.5, fontStyle: 'italic', borderLeft: '2px solid rgba(99,102,241,.3)', paddingLeft: 10 }}>
                      "{r.exact_quote.slice(0, 120)}{r.exact_quote.length > 120 ? '...' : ''}"
                    </p>
                  )}

                  {r.offer_text && !r.exact_quote && (
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', margin: '8px 0 0' }}>
                      Deal: {r.offer_text}
                    </p>
                  )}

                  {r.video_title && (
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', margin: '8px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📺 {r.video_title}
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                    {r.promo_code ? (
                      <span style={{ fontFamily: 'monospace', fontSize: 13, background: 'rgba(255,255,255,.07)', padding: '4px 10px', borderRadius: 6, letterSpacing: '.05em' }}>
                        {r.promo_code}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', fontStyle: 'italic' }}>
                        {r.sponsorship_type === 'offer' ? r.offer_text : 'No code'}
                      </span>
                    )}
                    {r.promo_code && (
                      <button className="copy-btn"
                        onClick={() => copyCode(r.promo_code, r.brands?.name)}
                        style={{ fontSize: 12, padding: '5px 14px', borderRadius: 8, background: copied === r.promo_code ? 'rgba(34,197,94,.15)' : 'rgba(99,102,241,.15)', color: copied === r.promo_code ? '#4ADE80' : '#818CF8', border: `1px solid ${copied === r.promo_code ? 'rgba(34,197,94,.3)' : 'rgba(99,102,241,.25)'}`, cursor: 'pointer', transition: 'all .15s', fontWeight: 500 }}>
                        {copied === r.promo_code ? '✓ Copied!' : 'Copy code'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasSearched && trending.length > 0 && (
          <div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>Latest indexed</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {trending.map((r: any) => (
                <div key={r.id}
                  style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', gap: 12, transition: 'border-color .2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,.35)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,.07)'}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99,102,241,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#818CF8', flexShrink: 0 }}>
                    {r.brands?.name?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{r.brands?.name}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', margin: '1px 0 0' }}>via {r.creators?.name}</p>
                  </div>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, background: 'rgba(255,255,255,.07)', padding: '3px 9px', borderRadius: 5, flexShrink: 0 }}>{r.promo_code}</span>
                  <button onClick={() => copyCode(r.promo_code, r.brands?.name)}
                    style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, background: copied === r.promo_code ? 'rgba(34,197,94,.15)' : 'rgba(99,102,241,.15)', color: copied === r.promo_code ? '#4ADE80' : '#818CF8', border: `1px solid ${copied === r.promo_code ? 'rgba(34,197,94,.3)' : 'rgba(99,102,241,.25)'}`, cursor: 'pointer', flexShrink: 0 }}>
                    {copied === r.promo_code ? '✓' : 'Copy'}
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