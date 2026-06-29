'use client'
import { useState, useEffect } from 'react'
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

export default function BrandsPage() {
  const [brands, setBrands] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')

  useEffect(() => { loadBrands() }, [])

  async function loadBrands() {
    const { data } = await supabase
      .from('brands')
      .select(`
        id, name, slug, category, website_url, velocity_score,
        total_creator_count, weekly_mention_count, velocity_delta
      `)
      .order('velocity_score', { ascending: false, nullsFirst: false })
      .limit(200)
    setBrands(data || [])
    setLoading(false)
  }

  const filtered = brands.filter(b => {
    const matchSearch = !search || b.name?.toLowerCase().includes(search.toLowerCase())
    const matchCat = category === 'All' || b.category?.toLowerCase().includes(category.toLowerCase())
    return matchSearch && matchCat
  })

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
            {brands.length} brands tracked across creator content
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
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,.2)' }}>
            <p style={{ fontSize: 13 }}>Loading brands...</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {filtered.map((b, i) => {
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
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', margin: '0 0 10px' }}>{b.category || 'Brand'}</p>
                    <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'rgba(255,255,255,.25)' }}>
                      {b.total_creator_count > 0 && (
                        <span>{b.total_creator_count} creator{b.total_creator_count !== 1 ? 's' : ''}</span>
                      )}
                      {b.weekly_mention_count > 0 && (
                        <span>· {b.weekly_mention_count} this week</span>
                      )}
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