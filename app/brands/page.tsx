'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import Link from 'next/link'

function formatNumber(n: number) {
  if (!n) return '0'
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return `${n}`
}

const CATEGORIES = ['All', 'Tech', 'Finance', 'Health', 'Lifestyle', 'Education', 'Gaming', 'Beauty', 'Food']
const PAGE_SIZE = 30

export default function BrandsPage() {
  const [brands, setBrands] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [totalCount, setTotalCount] = useState(0)
  const loaderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.from('brands').select('*', { count: 'exact', head: true }).then(({ count }) => setTotalCount(count || 0))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(0); loadBrands(0, true) }, [debouncedSearch, category])

  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        const next = page + 1
        setPage(next)
        loadBrands(next)
      }
    }, { threshold: 0.1 })
    if (loaderRef.current) obs.observe(loaderRef.current)
    return () => obs.disconnect()
  }, [hasMore, loading, page])

  async function loadBrands(pageNum: number, reset = false) {
    setLoading(true)
    const from = pageNum * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const fields = `
        id, name, slug, category, website_url, velocity_score,
        total_creator_count, weekly_mention_count, velocity_delta
      `

    let q = supabase
      .from('brands')
      .select(fields)
      .order('velocity_score', { ascending: false, nullsFirst: false })
      .range(from, to)

    if (debouncedSearch) q = q.ilike('name', `%${debouncedSearch}%`)
    if (category !== 'All') q = q.ilike('category', `%${category}%`)

    const { data } = await q
    let items = data || []

    // Always run semantic search alongside substring matching (not gated behind
    // a low match count) — partial substring success (e.g. 6 brands literally
    // named "___VPN") can still miss a real match like Surfshark, whose name
    // doesn't contain the query text at all.
    if (debouncedSearch && pageNum === 0) {
      try {
        const res = await fetch('/api/semantic-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: debouncedSearch }),
        })
        const { results: semanticBrands } = await res.json()
        const existingIds = new Set(items.map((b: any) => b.id))
        const newIds = (semanticBrands || [])
          .filter((b: any) => b.similarity >= 0.35 && !existingIds.has(b.id))
          .map((b: any) => b.id)
        if (newIds.length) {
          const { data: extra } = await supabase
            .from('brands')
            .select(fields)
            .in('id', newIds)
          items = [...items, ...(extra || [])]
        }
      } catch { /* semantic search is a nice-to-have — substring results still show */ }
    }

    // Pull deal/organic signal from the already-built brand_feed_cards view,
    // rather than recomputing "is there an active code" or "how organic is this"
    // from scratch — same logic already proven on Feed and Search.
    if (items.length) {
      const ids = items.map((b: any) => b.id)
      const { data: cardsData } = await supabase
        .from('brand_feed_cards')
        .select('brand_id, best_code, best_offer, organic_pct, distinct_creator_count, any_active')
        .in('brand_id', ids)
      const cardMap = new Map((cardsData || []).map((c: any) => [c.brand_id, c]))
      items = items.map((b: any) => ({ ...b, ...(cardMap.get(b.id) || {}) }))
    }

    if (reset) setBrands(items)
      else setBrands(prev => [...prev, ...items])
      // hasMore should reflect whether the SUBSTRING query itself was full (i.e.
      // more raw pages might exist) — semantic extras are a one-time bonus on page
      // 0 and shouldn't affect pagination logic, or "no more results" gets reported
      // prematurely just because semantic only added a few items.
      setHasMore(data ? data.length === PAGE_SIZE : false)
      setLoading(false)
    }

  return (
    <Layout>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        .bc { animation: fadeUp .3s ease forwards; transition: border-color .15s, transform .15s }
        .bc:hover { border-color: rgba(255,255,255,.15) !important; transform: translateY(-1px) }
        .cat:hover { background: rgba(255,255,255,.07) !important }
      `}</style>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '16px 14px 40px' }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.03em', color: '#fff', margin: '0 0 4px' }}>
            Brands
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', margin: 0 }}>
            {totalCount.toLocaleString()} brands tracked across creator content
          </p>
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search brands..."
          style={{ width: '100%', padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,.05)', border: '0.5px solid rgba(255,255,255,.1)', color: '#fff', fontSize: 13, marginBottom: 12, outline: 'none', boxSizing: 'border-box' }}
        />

        {/* Category filters */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 2 }}>
          {CATEGORIES.map(c => (
            <button key={c} className="cat" onClick={() => setCategory(c)}
              style={{ fontSize: 11, padding: '5px 13px', borderRadius: 20, border: '0.5px solid', whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all .15s', borderColor: category === c ? '#6366F1' : 'rgba(255,255,255,.08)', background: category === c ? 'rgba(99,102,241,.15)' : 'transparent', color: category === c ? '#818CF8' : 'rgba(255,255,255,.4)' }}>
              {c}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading && page === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,.2)' }}>
            <p style={{ fontSize: 13 }}>Loading brands...</p>
          </div>
        ) : brands.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,.2)' }}>
            <p style={{ fontSize: 13 }}>No brands match those filters</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {brands.map((b, i) => {
                const delta = b.velocity_delta || 0
                const isRising = delta > 0
                return (
                  <Link key={b.id} href={`/brands/${b.slug}`} style={{ textDecoration: 'none' }}>
                    <div className="bc" style={{
                      animationDelay: `${Math.min(i, 12) * 0.03}s`,
                      background: 'rgba(255,255,255,.03)',
                      border: '0.5px solid rgba(255,255,255,.07)',
                      borderRadius: 14,
                      padding: '14px',
                      cursor: 'pointer',
                      height: '100%',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(99,102,241,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#818CF8' }}>
                          {b.name?.[0]?.toUpperCase()}
                        </div>
                        {delta !== 0 && (
                          <span style={{ fontSize: 10, color: isRising ? '#34D399' : '#F87171', background: isRising ? 'rgba(52,211,153,.1)' : 'rgba(239,68,68,.1)', padding: '2px 7px', borderRadius: 10 }}>
                            {isRising ? '↑' : '↓'} {Math.abs(Math.round(delta))}%
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', margin: '0 0 8px' }}>{b.category || 'Brand'}</p>
                      <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'rgba(255,255,255,.25)', marginBottom: (b.best_code || b.organic_pct >= 50) ? 8 : 0 }}>
                        {(b.distinct_creator_count ?? b.total_creator_count) > 0 && (
                          <span>{b.distinct_creator_count ?? b.total_creator_count} creator{(b.distinct_creator_count ?? b.total_creator_count) !== 1 ? 's' : ''}</span>
                        )}
                        {b.weekly_mention_count > 0 && (
                          <span>· {b.weekly_mention_count} this week</span>
                        )}
                      </div>
                      {b.best_code && (
                        <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 600, color: '#818CF8', background: 'rgba(99,102,241,.12)', padding: '2px 8px', borderRadius: 8, marginRight: 6, marginBottom: 4 }}>
                          🎟 Active deal
                        </span>
                      )}
                      {b.organic_pct >= 50 && (
                        <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 600, color: '#34D399', background: 'rgba(52,211,153,.12)', padding: '2px 8px', borderRadius: 8, marginBottom: 4 }}>
                          💡 {b.organic_pct}% organic
                        </span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
            <div ref={loaderRef} style={{ padding: '20px 0', textAlign: 'center' }}>
              {loading && page > 0 && <p style={{ fontSize: 12, color: 'rgba(255,255,255,.2)' }}>Loading more...</p>}
              {!hasMore && brands.length > 0 && <p style={{ fontSize: 12, color: 'rgba(255,255,255,.15)' }}>You've seen every brand that matches ✓</p>}
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}