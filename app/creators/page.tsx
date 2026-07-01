'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import Link from 'next/link'

const PLATFORM_ICONS: Record<string, string> = {
  youtube: '▶', podcast: '🎙', twitch: '🎮', reddit: '🔴', newsletter: '📰',
}

const PAGE_SIZE = 30

function formatSubs(n: number) {
  if (!n) return ''
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return `${n}`
}

export default function CreatorsPage() {
  const [creators, setCreators] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [categories, setCategories] = useState<string[]>(['All'])
  const [platform, setPlatform] = useState('All')
  const [totalCount, setTotalCount] = useState(0)
  const [creatorStats, setCreatorStats] = useState<Record<string, { brands: number; organic: number }>>({})
  const loaderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.from('creators').select('*', { count: 'exact', head: true }).then(({ count }) => setTotalCount(count || 0))
    loadCategories()
  }, [])

  async function loadCategories() {
    const { data } = await supabase.from('creators').select('category').not('category', 'is', null).limit(2000)
    const unique = Array.from(new Set((data || []).map((c: any) => c.category).filter(Boolean))) as string[]
    setCategories(['All', ...unique.sort()])
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(0); loadCreators(0, true) }, [debouncedSearch, category, platform])

  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        const next = page + 1
        setPage(next)
        loadCreators(next)
      }
    }, { threshold: 0.1 })
    if (loaderRef.current) obs.observe(loaderRef.current)
    return () => obs.disconnect()
  }, [hasMore, loading, page])

  async function loadCreators(pageNum: number, reset = false) {
    setLoading(true)
    const from = pageNum * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let q = supabase
      .from('creators')
      .select('id, name, slug, category, platform, subscriber_count, avatar_url, total_sponsorships')
      .order('subscriber_count', { ascending: false, nullsFirst: false })
      .range(from, to)

    if (debouncedSearch) q = q.ilike('name', `%${debouncedSearch}%`)
    if (category !== 'All') q = q.eq('category', category)
    if (platform !== 'All') q = q.eq('platform', platform)

    const { data } = await q
    const items = data || []

    if (reset) setCreators(items)
    else setCreators(prev => [...prev, ...items])
    setHasMore(items.length === PAGE_SIZE)
    setLoading(false)

    // Batched stats — one query for the whole visible page, not one per creator
    const ids = items.map((c: any) => c.id).filter(Boolean)
    if (ids.length) {
      const { data: spData } = await supabase
        .from('sponsorships')
        .select('creator_id, brand_id, is_organic')
        .in('creator_id', ids)
      const statsMap: Record<string, { brands: number; organic: number }> = {}
      const brandSets: Record<string, Set<string>> = {}
      for (const row of spData || []) {
        if (!row.creator_id) continue
        if (!brandSets[row.creator_id]) brandSets[row.creator_id] = new Set()
        if (row.brand_id) brandSets[row.creator_id].add(row.brand_id)
        if (!statsMap[row.creator_id]) statsMap[row.creator_id] = { brands: 0, organic: 0 }
        if (row.is_organic) statsMap[row.creator_id].organic++
      }
      for (const cid of Object.keys(brandSets)) {
        if (!statsMap[cid]) statsMap[cid] = { brands: 0, organic: 0 }
        statsMap[cid].brands = brandSets[cid].size
      }
      setCreatorStats(prev => ({ ...prev, ...statsMap }))
    }
  }

  return (
    <Layout>
      <style>{`.cc{transition:border-color .2s,transform .2s}.cc:hover{border-color:rgba(255,255,255,.14)!important;transform:translateY(-1px)}`}</style>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px 14px 40px' }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#fff', margin: '0 0 3px' }}>Creators</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', margin: 0 }}>{totalCount.toLocaleString()} creators tracked</p>
        </div>

        <div style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,.05)', border: '0.5px solid rgba(255,255,255,.1)', borderRadius: 12, padding: '5px 5px 5px 14px', marginBottom: 12 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search creators..."
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: '#fff', padding: '7px 0' }} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.3)', cursor: 'pointer', padding: '0 8px', fontSize: 16 }}>×</button>}
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto' }}>
          {['All', 'youtube', 'podcast', 'twitch'].map(p => (
            <button key={p} onClick={() => setPlatform(p)}
              style={{ fontSize: 11, padding: '5px 12px', borderRadius: 20, border: '0.5px solid', whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all .15s', borderColor: platform === p ? '#6366F1' : 'rgba(255,255,255,.08)', background: platform === p ? 'rgba(99,102,241,.15)' : 'transparent', color: platform === p ? '#818CF8' : 'rgba(255,255,255,.4)' }}>
              {p === 'All' ? 'All platforms' : `${PLATFORM_ICONS[p]} ${p.charAt(0).toUpperCase() + p.slice(1)}`}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }}>
          {categories.slice(0, 8).map(c => (
            <button key={c} onClick={() => setCategory(c)}
              style={{ fontSize: 11, padding: '5px 12px', borderRadius: 20, border: '0.5px solid', whiteSpace: 'nowrap', cursor: 'pointer', borderColor: category === c ? '#6366F1' : 'rgba(255,255,255,.06)', background: category === c ? 'rgba(99,102,241,.12)' : 'transparent', color: category === c ? '#818CF8' : 'rgba(255,255,255,.3)' }}>
              {c}
            </button>
          ))}
        </div>

        {loading && page === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,.2)' }}><p>Loading...</p></div>
        ) : creators.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,.2)' }}><p style={{ fontSize: 13 }}>No creators match those filters</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {creators.map((c, i) => (
              <Link key={c.id} href={`/creators/${c.slug}`} style={{ textDecoration: 'none' }}>
                <div className="cc" style={{ background: 'rgba(255,255,255,.03)', border: '0.5px solid rgba(255,255,255,.07)', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: 'rgba(99,102,241,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#818CF8', flexShrink: 0, overflow: 'hidden' }}>
                    {c.avatar_url ? <img src={c.avatar_url} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 11 }} /> : c.name?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {c.subscriber_count > 0 && <span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{formatSubs(c.subscriber_count)}</span>}
                      {c.category && <><span style={{ fontSize: 10, color: 'rgba(255,255,255,.15)' }}>·</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,.25)' }}>{c.category}</span></>}
                      {c.platform && <><span style={{ fontSize: 10, color: 'rgba(255,255,255,.15)' }}>·</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>{PLATFORM_ICONS[c.platform]} {c.platform}</span></>}
                      {creatorStats[c.id]?.brands > 0 && <><span style={{ fontSize: 10, color: 'rgba(255,255,255,.15)' }}>·</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>{creatorStats[c.id].brands} sponsor{creatorStats[c.id].brands !== 1 ? 's' : ''}</span></>}
                      {creatorStats[c.id]?.organic > 0 && <><span style={{ fontSize: 10, color: 'rgba(255,255,255,.15)' }}>·</span><span style={{ fontSize: 11, color: '#34D399' }}>{creatorStats[c.id].organic} reco{creatorStats[c.id].organic !== 1 ? 's' : ''}</span></>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {c.total_sponsorships > 0 && <p style={{ fontSize: 13, fontWeight: 600, color: '#818CF8', margin: '0 0 2px' }}>{c.total_sponsorships}</p>}
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', margin: 0 }}>deals</p>
                  </div>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,.2)' }}>›</span>
                </div>
              </Link>
            ))}
            <div ref={loaderRef} style={{ padding: '20px 0', textAlign: 'center' }}>
              {loading && page > 0 && <p style={{ fontSize: 12, color: 'rgba(255,255,255,.2)' }}>Loading more...</p>}
              {!hasMore && creators.length > 0 && <p style={{ fontSize: 12, color: 'rgba(255,255,255,.15)' }}>You've seen every creator that matches ✓</p>}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}