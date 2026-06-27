'use client'
import { useState } from 'react'

const sponsors = [
  { brand: 'NordVPN', code: 'ALI10', creators: ['Ali Abdaal', 'MKBHD', 'Linus'], category: 'Tech', active: true, deals: 247, color: '#3B82F6' },
  { brand: 'Eight Sleep', code: 'MKBHD', creators: ['MKBHD', 'Lex Fridman', 'Andrew Huberman'], category: 'Health', active: true, deals: 89, color: '#10B981' },
  { brand: 'Squarespace', code: 'VERGE', creators: ['CGP Grey', 'Linus', 'Veritasium'], category: 'Tech', active: true, deals: 612, color: '#F59E0B' },
  { brand: 'Notion', code: 'ALI', creators: ['Ali Abdaal', 'Thomas Frank', 'Keep Productive'], category: 'Productivity', active: true, deals: 341, color: '#8B5CF6' },
  { brand: 'ExpressVPN', code: 'TECHLINKED', creators: ['Linus', 'MKBHD', 'Dave2D'], category: 'Tech', active: true, deals: 198, color: '#EF4444' },
  { brand: 'Brilliant', code: 'VERITASIUM', creators: ['Veritasium', 'CGP Grey', 'Kurzgesagt'], category: 'Education', active: true, deals: 156, color: '#06B6D4' },
  { brand: 'Athletic Greens', code: 'HUBERMAN', creators: ['Andrew Huberman', 'Lex Fridman', 'Peter Attia'], category: 'Health', active: true, deals: 203, color: '#84CC16' },
  { brand: 'Audible', code: 'ALIABDAAL', creators: ['Ali Abdaal', 'Thomas Frank', 'Matt D\'Avella'], category: 'Education', active: true, deals: 445, color: '#F97316' },
  { brand: 'Surfshark', code: 'TECHNO', creators: ['Technoblade', 'Dream', 'MrBeast'], category: 'Tech', active: true, deals: 312, color: '#EC4899' },
  { brand: 'Morning Brew', code: 'BREW', creators: ['Ali Abdaal', 'Graham Stephan', 'Andrei Jikh'], category: 'Finance', active: true, deals: 178, color: '#A78BFA' },
  { brand: 'Blinkist', code: 'THOMAS', creators: ['Thomas Frank', 'Ali Abdaal', 'Matt D\'Avella'], category: 'Education', active: false, deals: 134, color: '#34D399' },
  { brand: 'Honey', code: 'LINUS', creators: ['Linus', 'MKBHD', 'Dave2D'], category: 'Shopping', active: false, deals: 521, color: '#FBBF24' },
]

const categories = ['All', 'Tech', 'Health', 'Productivity', 'Education', 'Finance', 'Shopping']

const pills = ['NordVPN codes', 'Ali Abdaal tools', 'Huberman sponsors', 'MrBeast deals', 'Productivity apps', 'Finance creators']

export default function Home() {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [copied, setCopied] = useState<string | null>(null)

  const filtered = sponsors.filter(s => {
    const matchesQuery = query === '' ||
      s.brand.toLowerCase().includes(query.toLowerCase()) ||
      s.creators.some(c => c.toLowerCase().includes(query.toLowerCase())) ||
      s.category.toLowerCase().includes(query.toLowerCase())
    const matchesCategory = activeCategory === 'All' || s.category === activeCategory
    return matchesQuery && matchesCategory
  })

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <main style={{ background: '#080C14', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', color: '#fff' }}>

      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✦</div>
          <span style={{ fontWeight: 600, fontSize: 16, letterSpacing: '-0.02em' }}>that's the one</span>
        </div>
        <div style={{ display: 'flex', gap: 28 }}>
          {['Explore', 'Creators', 'Brands', 'For brands'].map(l => (
            <span key={l} style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>{l}</span>
          ))}
        </div>
        <div style={{ fontSize: 12, padding: '7px 16px', borderRadius: 8, background: 'rgba(59,130,246,0.15)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.25)', cursor: 'pointer' }}>
          Sign in
        </div>
      </nav>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '64px 24px 48px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '5px 14px', marginBottom: 24, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6', display: 'inline-block' }}></span>
          500k+ sponsorships indexed
        </div>
        <h1 style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 16, background: 'linear-gradient(180deg,#fff 50%,rgba(255,255,255,0.3))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Find any product you heard<br />from a creator
        </h1>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', marginBottom: 36, lineHeight: 1.6 }}>
          Search the memory layer of the creator economy.<br />Every deal, every code, every recommendation.
        </p>

        {/* Search */}
        <div style={{ maxWidth: 560, margin: '0 auto 20px', display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '6px 6px 6px 18px', gap: 10 }}>
          <span style={{ fontSize: 18, opacity: 0.3 }}>⌕</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder='Try "VPN Ali Abdaal" or "Huberman supplements"'
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 15, color: '#fff', padding: '8px 0' }}
          />
          <button style={{ background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Search
          </button>
        </div>

        {/* Pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {pills.map(p => (
            <span key={p} onClick={() => setQuery(p.split(' ')[0])} style={{ fontSize: 12, padding: '5px 14px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)', cursor: 'pointer' }}>{p}</span>
          ))}
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 8, padding: '0 32px 24px', overflowX: 'auto' }}>
        {categories.map(c => (
          <button key={c} onClick={() => setActiveCategory(c)} style={{ fontSize: 12, padding: '6px 16px', borderRadius: 20, border: '1px solid', borderColor: activeCategory === c ? '#3B82F6' : 'rgba(255,255,255,0.08)', background: activeCategory === c ? 'rgba(59,130,246,0.15)' : 'transparent', color: activeCategory === c ? '#60A5FA' : 'rgba(255,255,255,0.4)', cursor: 'pointer', whiteSpace: 'nowrap' }}>{c}</button>
        ))}
      </div>

      {/* Results */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, padding: '0 32px 48px' }}>
        {filtered.map(s => (
          <div key={s.brand} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20, position: 'relative', overflow: 'hidden', transition: 'border-color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}>
            <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: s.color, opacity: 0.12, filter: 'blur(20px)' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: s.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: s.color }}>
                {s.brand[0]}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{s.brand}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{s.deals} creator deals</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>
              {s.creators.slice(0, 2).join(', ')}{s.creators.length > 2 ? ` +${s.creators.length - 2} more` : ''}
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 13, background: 'rgba(255,255,255,0.07)', padding: '4px 10px', borderRadius: 6, letterSpacing: '0.05em' }}>{s.code}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: s.active ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)', color: s.active ? '#4ADE80' : 'rgba(255,255,255,0.3)', border: `1px solid ${s.active ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)'}` }}>
                  {s.active ? 'Active' : 'Unverified'}
                </span>
                <button onClick={() => copyCode(s.code)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: copied === s.code ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.15)', color: copied === s.code ? '#4ADE80' : '#60A5FA', border: `1px solid ${copied === s.code ? 'rgba(34,197,94,0.3)' : 'rgba(59,130,246,0.25)'}`, cursor: 'pointer' }}>
                  {copied === s.code ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        {['500k+ sponsorships', '12k creators', 'Updated daily', 'YouTube · TikTok · Podcasts'].map((t, i) => (
          <span key={t} style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>{i > 0 ? '· ' : ''}{t}</span>
        ))}
      </div>
    </main>
  )
}