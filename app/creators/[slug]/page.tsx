'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import Link from 'next/link'
import { use } from 'react'

const PLATFORM_ICONS: Record<string, string> = {
  youtube: '▶', podcast: '🎙', twitch: '🎮', reddit: '🔴', newsletter: '📰',
}

function formatSubs(n: number) {
  if (!n) return ''
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return `${n}`
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

export default function CreatorProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [creator, setCreator] = useState<any>(null)
  const [sponsorships, setSponsorships] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { if (slug) loadCreator() }, [slug])

  async function loadCreator() {
    setLoading(true)
    const { data: creatorData } = await supabase
      .from('creators').select('*').eq('slug', slug).single()
    if (!creatorData) { setLoading(false); return }
    setCreator(creatorData)
    const { data: spData } = await supabase
      .from('sponsorships')
      .select('id, promo_code, promo_url, offer_text, exact_quote, sponsorship_type, is_active, is_organic, first_seen, video_title, video_id, dar_score, platform, brands ( name, slug )')
      .eq('creator_id', creatorData.id)
      .order('first_seen', { ascending: false })
      .limit(50)
    setSponsorships(spData || [])
    setLoading(false)
  }

  const copyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) return (
    <Layout>
      <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,.2)' }}>
        <p style={{ fontSize: 13 }}>Loading...</p>
      </div>
    </Layout>
  )

  if (!creator) return (
    <Layout>
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,.3)', marginBottom: 16 }}>Creator not found</p>
        <Link href="/creators" style={{ fontSize: 13, color: '#818CF8', textDecoration: 'none' }}>← Back</Link>
      </div>
    </Layout>
  )

  const withCodes = sponsorships.filter(s => s.promo_code)
  const organic = sponsorships.filter(s => s.is_organic)
  const uniqueBrands = new Set(sponsorships.map(s => s.brands?.name)).size
  const convictionScore = Math.min(100, Math.round(
    (withCodes.length * 15) +
    (organic.length * 20) +
    (sponsorships.filter(s => s.is_active).length * 5) +
    (uniqueBrands * 3)
  ))

  return (
    <Layout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: creator.name,
        ...(creator.avatar_url && { image: creator.avatar_url }),
        ...(creator.category && { knowsAbout: creator.category }),
      }) }} />
      <style>{`
        .sc { transition: border-color .2s }
        .sc:hover { border-color: rgba(255,255,255,.14) !important }
      `}</style>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px 14px 40px' }}>

        <Link href="/creators"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'rgba(255,255,255,.3)', textDecoration: 'none', marginBottom: 16 }}>
          ← Creators
        </Link>

        {/* Creator header card */}
        <div style={{ background: 'rgba(255,255,255,.03)', border: '0.5px solid rgba(255,255,255,.07)', borderRadius: 18, padding: 20, marginBottom: 16 }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(99,102,241,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#818CF8', flexShrink: 0, overflow: 'hidden' }}>
              {creator.avatar_url
                ? <img src={creator.avatar_url} alt={creator.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : creator.name?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>{creator.name}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {creator.subscriber_count > 0 && (
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>
                    {formatSubs(creator.subscriber_count)} followers
                  </span>
                )}
                {creator.category && (
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'rgba(99,102,241,.1)', color: '#818CF8', border: '0.5px solid rgba(99,102,241,.2)' }}>
                    {creator.category}
                  </span>
                )}
                {creator.platform && (
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,.25)' }}>
                    {PLATFORM_ICONS[creator.platform]} {creator.platform}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {[
              { label: 'Total deals', value: sponsorships.length },
              { label: 'Brands', value: uniqueBrands },
              { label: 'With codes', value: withCodes.length },
              { label: 'Organic', value: organic.length },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '10px' }}>
                <p style={{ fontSize: 18, fontWeight: 600, color: '#fff', margin: '0 0 2px' }}>{s.value}</p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', margin: 0 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Conviction score */}
          {convictionScore > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid rgba(255,255,255,.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>Conviction score</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: convictionScore >= 70 ? '#34D399' : '#FBBF24' }}>
                  {convictionScore}/100
                </span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,.08)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${convictionScore}%`, background: convictionScore >= 70 ? '#34D399' : '#818CF8', borderRadius: 4 }} />
              </div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', margin: '5px 0 0' }}>
                Based on deal frequency, organic mentions and code usage
              </p>
            </div>
          )}
        </div>

        {/* Sponsorship history */}
        <h2 style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,.4)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '.06em' }}>
          Sponsorship history
        </h2>

        {sponsorships.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.25)' }}>No sponsorships found yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sponsorships.map((s, i) => (
              <div key={s.id} className="sc"
                style={{ animationDelay: `${Math.min(i, 10) * 0.03}s`, background: 'rgba(255,255,255,.03)', border: '0.5px solid rgba(255,255,255,.07)', borderRadius: 14, padding: '14px 16px', cursor: 'pointer' }}
                onClick={() => setExpanded(expanded === s.id ? null : s.id)}>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: s.is_organic ? 'rgba(16,185,129,.15)' : 'rgba(99,102,241,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: s.is_organic ? '#34D399' : '#818CF8', flexShrink: 0 }}>
                    {s.brands?.name?.[0]?.toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
    {s.brands?.slug ? (
      <Link href={`/brands/${s.brands.slug}`} onClick={e => e.stopPropagation()}
        style={{ fontSize: 13, fontWeight: 600, color: '#fff', textDecoration: 'none' }}>
        {s.brands?.name}
      </Link>
    ) : (
      <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{s.brands?.name}</span>
    )}
    {s.is_organic && (
      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 6, background: 'rgba(16,185,129,.1)', color: '#34D399', border: '0.5px solid rgba(16,185,129,.2)' }}>
        Organic
      </span>
    )}
                      {s.dar_score >= 75 && (
                        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 6, background: 'rgba(99,102,241,.1)', color: '#818CF8', border: '0.5px solid rgba(99,102,241,.2)' }}>
                          Verified
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.25)' }}>{timeAgo(s.first_seen)}</span>
                      {s.platform && (
                        <>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.15)' }}>·</span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>{PLATFORM_ICONS[s.platform] || s.platform}</span>
                        </>
                      )}
                      {s.sponsorship_type && (
                        <>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.15)' }}>·</span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>{s.sponsorship_type}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: s.is_active ? 'rgba(34,197,94,.1)' : 'rgba(255,255,255,.04)', color: s.is_active ? '#4ADE80' : 'rgba(255,255,255,.25)', border: `0.5px solid ${s.is_active ? 'rgba(34,197,94,.2)' : 'rgba(255,255,255,.06)'}` }}>
                      {s.is_active ? 'Active' : 'Past'}
                    </span>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,.2)' }}>
                      {expanded === s.id ? '↑' : '↓'}
                    </span>
                  </div>
                </div>

                {/* Expanded panel */}
                {expanded === s.id && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid rgba(255,255,255,.06)' }}>

{s.is_organic && (
  <p style={{ fontSize: 12, color: '#34D399', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 500 }}>
    💡 Personal recommendation — no brand deal involved
  </p>
)}
{s.exact_quote && (
  <div style={{
    background: s.is_organic ? 'rgba(52,211,153,.05)' : 'rgba(255,255,255,.04)',
    borderRadius: 9, padding: '10px 13px', marginBottom: 10,
    borderLeft: `3px solid ${s.is_organic ? '#34D399' : 'rgba(99,102,241,.4)'}`
  }}>
    <p style={{ fontSize: 13, color: 'rgba(255,255,255,.8)', margin: 0, lineHeight: 1.6, fontStyle: 'italic', fontWeight: 500 }}>
      "{s.exact_quote}"
    </p>
  </div>
)}

                    {s.offer_text && (
                      <p style={{ fontSize: 12, color: '#34D399', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                        🎁 {s.offer_text}
                      </p>
                    )}

                    {s.video_title && (
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        ▶ {s.video_title}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {s.video_id && (
                        <a href={`https://youtube.com/watch?v=${s.video_id}`}
                          target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.4)', border: '0.5px solid rgba(255,255,255,.08)', textDecoration: 'none' }}>
                          Watch ↗
                        </a>
                      )}
                      {s.promo_url ? (
  <a href={s.promo_url}
    target="_blank" rel="noopener noreferrer"
    onClick={e => e.stopPropagation()}
    style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, background: 'rgba(16,185,129,.08)', color: '#34D399', border: '0.5px solid rgba(16,185,129,.2)', textDecoration: 'none' }}>
    Visit deal ↗
  </a>
) : s.is_organic && (
  <a href={`https://www.google.com/search?q=${encodeURIComponent('"' + (s.brands?.name || '') + '" official website')}&btnI=1`}
    target="_blank" rel="noopener noreferrer"
    onClick={e => e.stopPropagation()}
    style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, background: 'rgba(16,185,129,.08)', color: '#34D399', border: '0.5px solid rgba(16,185,129,.2)', textDecoration: 'none' }}>
    Find this →
  </a>
)}
                      {s.promo_code && (
                        <button
                          onClick={e => { e.stopPropagation(); copyCode(s.promo_code, s.id) }}
                          style={{ fontSize: 11, padding: '5px 14px', borderRadius: 8, background: copied === s.id ? 'rgba(34,197,94,.15)' : 'rgba(99,102,241,.15)', color: copied === s.id ? '#4ADE80' : '#818CF8', border: `0.5px solid ${copied === s.id ? 'rgba(34,197,94,.3)' : 'rgba(99,102,241,.25)'}`, cursor: 'pointer', fontWeight: 600 }}>
                          {copied === s.id ? '✓ Copied' : `${s.promo_code} — Copy`}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}