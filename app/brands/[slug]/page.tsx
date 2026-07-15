'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getFreshnessTier, getFreshnessColor, getFreshnessLine } from '../../lib/freshness'

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
  
  function formatDate(date: string) {
    if (!date) return ''
    return new Date(date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
  }

export default function BrandPage() {
  const params = useParams()
  const slug = params.slug as string
  const [brand, setBrand] = useState<any>(null)
  const [creators, setCreators] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [allMentions, setAllMentions] = useState<Record<string, any[]>>({})
  const [loadingMentions, setLoadingMentions] = useState<string | null>(null)

  useEffect(() => { if (slug) load() }, [slug])

  async function load() {
    const { data: brandData } = await supabase
      .from('brands')
      .select('*')
      .eq('slug', slug)
      .single()

    if (!brandData) { setLoading(false); return }
    setBrand(brandData)

    const { data: relationships } = await supabase
      .from('creator_brand_relationships')
      .select('*')
      .eq('brand_id', brandData.id)
      .order('freshness_rank', { ascending: true })
      .order('mention_count', { ascending: false })
      .limit(50)

    setCreators(relationships || [])
    setLoading(false)
  }

  const copyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  async function loadAllMentions(creatorId: string, brandId: string) {
    if (allMentions[creatorId]) return
    setLoadingMentions(creatorId)
    const { data } = await supabase
      .from('sponsorships')
      .select('video_id, video_title, first_seen, platform')
      .eq('creator_id', creatorId)
      .eq('brand_id', brandId)
      .order('first_seen', { ascending: false })
    setAllMentions(prev => ({ ...prev, [creatorId]: data || [] }))
    setLoadingMentions(null)
  }

  if (loading) return (
    <Layout>
      <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,.2)' }}>
        <p style={{ fontSize: 13 }}>Loading...</p>
      </div>
    </Layout>
  )

  if (!brand) return (
    <Layout>
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,.3)' }}>Brand not found</p>
        <Link href="/brands" style={{ color: '#818CF8', fontSize: 13 }}>← All brands</Link>
      </div>
    </Layout>
  )

  const bestDeal = creators.find(c => c.best_code || c.best_offer)
  const totalMentions = creators.reduce((a, c) => a + (c.mention_count || 0), 0)
  const isRising = (brand.velocity_delta || 0) > 0
  const brandUrl = brand.website_url || brand.website
  const earliestMention = creators.reduce((earliest: any, c: any) => {
    if (!c.first_seen) return earliest
    if (!earliest || new Date(c.first_seen) < new Date(earliest.first_seen)) return c
    return earliest
  }, null)

  return (
    <Layout>
      {/* <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: brand.name,
        url: brandUrl || undefined,
        ...(brand.category && { knowsAbout: brand.category }),
      }) }} /> */}
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        .cc { animation: fadeUp .3s ease forwards; transition: border-color .15s, transform .15s }
        .cc:hover { border-color: rgba(255,255,255,.15) !important; transform: translateY(-1px) }
      `}</style>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px 14px 40px' }}>

        {/* Back */}
        <Link href="/brands" style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>
          ← All brands
        </Link>

        {/* Brand header */}
        <div style={{ background: 'rgba(99,102,241,.06)', border: '0.5px solid rgba(99,102,241,.2)', borderRadius: 20, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: 13, background: 'rgba(99,102,241,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#818CF8', flexShrink: 0 }}>
              {brand.name?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-.02em' }}>{brand.name}</h1>
                {brand.velocity_delta != null && brand.velocity_delta !== 0 && (
                  <span style={{ fontSize: 11, color: isRising ? '#34D399' : '#F87171', background: isRising ? 'rgba(52,211,153,.1)' : 'rgba(239,68,68,.1)', padding: '2px 8px', borderRadius: 10 }}>
                    {isRising ? '↑' : '↓'} {Math.abs(Math.round(brand.velocity_delta))}% this week
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', margin: 0 }}>{brand.category || 'Brand'}</p>
              {brand.description && (
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', margin: '4px 0 0', lineHeight: 1.5 }}>{brand.description}</p>
              )}
            </div>
            {brandUrl && (
              <a href={brandUrl} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, padding: '6px 12px', borderRadius: 10, background: 'rgba(99,102,241,.15)', color: '#818CF8', border: '0.5px solid rgba(99,102,241,.3)', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                Visit brand →
              </a>
            )}
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { label: 'Creators', value: creators.length },
              { label: 'Total mentions', value: totalMentions },
              { label: 'Velocity score', value: brand.velocity_score ? Math.round(brand.velocity_score) : '—' },
            ].map(stat => (
              <div key={stat.label} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                <p style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 2px' }}>{stat.value}</p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', margin: 0 }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Trend origin */}
        {earliestMention && earliestMention.first_seen && (
          <div style={{ background: 'rgba(167,139,250,.06)', border: '0.5px solid rgba(167,139,250,.2)', borderRadius: 14, padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>👀</span>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', margin: 0, lineHeight: 1.5 }}>
              First mentioned by{' '}
              {earliestMention.creator_slug ? (
                <Link href={`/creators/${earliestMention.creator_slug}`} style={{ color: '#A78BFA', fontWeight: 600, textDecoration: 'none' }}>
                  {earliestMention.creator_name}
                </Link>
              ) : (
                <span style={{ color: '#A78BFA', fontWeight: 600 }}>{earliestMention.creator_name}</span>
              )}
              {' '}on {formatDate(earliestMention.first_seen)} — {timeAgo(earliestMention.first_seen)}
            </p>
          </div>
        )}

        {/* Best deal banner */}
        {bestDeal && (bestDeal.best_code || bestDeal.best_offer) && (() => {
          const dealUrl = bestDeal.best_promo_url || bestDeal.promo_url || bestDeal.brand_url || brandUrl
          return (
            <div style={{ background: 'rgba(52,211,153,.06)', border: '0.5px solid rgba(52,211,153,.2)', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <p style={{ fontSize: 11, color: '#34D399', margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Best deal available</p>
                  {bestDeal.best_offer && <p style={{ fontSize: 13, color: '#fff', margin: '0 0 2px' }}>{bestDeal.best_offer}</p>}
                  {bestDeal.creator_name && <p style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', margin: 0 }}>via {bestDeal.creator_name}</p>}
                </div>
                {bestDeal.best_code ? (
                  <button onClick={() => copyCode(bestDeal.best_code, 'best')}
                    style={{ fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 10, background: copied === 'best' ? 'rgba(34,197,94,.2)' : 'rgba(52,211,153,.15)', color: '#34D399', border: '0.5px solid rgba(52,211,153,.3)', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'monospace', letterSpacing: '.06em' }}>
                    {copied === 'best' ? '✓ Copied' : bestDeal.best_code}
                  </button>
                ) : dealUrl ? (
                  <a href={dealUrl} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 10, background: 'rgba(52,211,153,.15)', color: '#34D399', border: '0.5px solid rgba(52,211,153,.3)', whiteSpace: 'nowrap', textDecoration: 'none' }}>
                    Get deal →
                  </a>
                ) : null}
              </div>
              {bestDeal.best_code && dealUrl && (
                <a href={dealUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'rgba(52,211,153,.7)', textDecoration: 'none', marginTop: 10 }}>
                  Visit brand to use this code →
                </a>
              )}
            </div>
          )
        })()}

        {/* Creator list */}
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.5)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '.05em' }}>
          {creators.length} Creator{creators.length !== 1 ? 's' : ''} promoting this brand
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {creators.map((c, i) => {
            const isOpen = expanded === c.creator_id
            const promoUrl = c.best_product_url || c.best_promo_url || c.promo_url || c.brand_url

            return (
              <div key={c.creator_id} className="cc"
                style={{
                  animationDelay: `${Math.min(i, 10) * 0.04}s`,
                  background: 'rgba(255,255,255,.03)',
                  border: '0.5px solid rgba(255,255,255,.07)',
                  borderRadius: 14,
                  padding: '14px 16px',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  const next = isOpen ? null : c.creator_id
                  setExpanded(next)
                  if (next && c.mention_count > 1) loadAllMentions(c.creator_id, c.brand_id)
                }}>

                {/* Creator row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,.5)', flexShrink: 0 }}>
                    {c.creator_name?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: 0 }}>{c.creator_name}</p>
                      {c.subscriber_count > 0 && (
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', background: 'rgba(255,255,255,.05)', padding: '1px 5px', borderRadius: 6 }}>
                          {formatSubs(c.subscriber_count)}
                        </span>
                      )}
                     {c.mention_count > 1 && (
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', background: 'rgba(255,255,255,.04)', padding: '1px 6px', borderRadius: 6 }}>
                          {c.mention_count}× mentioned
                        </span>
                      )}
                    </div>
                    {c.best_product_mentioned && (
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', margin: '2px 0 0' }}>
                        recommends: <span style={{ color: 'rgba(255,255,255,.55)' }}>{c.best_product_mentioned}</span>
                      </p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                      <span style={{ color: getFreshnessColor(getFreshnessTier(c.last_seen)) }}>
                        {getFreshnessLine({ tier: getFreshnessTier(c.last_seen), lastSeen: c.last_seen, firstSeen: c.first_seen, mentionCount: c.mention_count || 1, timeAgo })}
                      </span>
                      {c.platform && <span style={{ color: 'rgba(255,255,255,.25)' }}>· {c.platform}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {c.best_code && (
                      <button onClick={e => { e.stopPropagation(); copyCode(c.best_code, c.creator_id) }}
                        style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 8, background: copied === c.creator_id ? 'rgba(34,197,94,.15)' : 'rgba(255,255,255,.06)', color: copied === c.creator_id ? '#34D399' : 'rgba(255,255,255,.5)', border: '0.5px solid rgba(255,255,255,.1)', cursor: 'pointer', fontFamily: 'monospace', letterSpacing: '.04em' }}>
                        {copied === c.creator_id ? '✓' : c.best_code}
                      </button>
                    )}
                    <Link href={`/creators/${c.creator_slug}`}
                      onClick={e => e.stopPropagation()}
                      style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', textDecoration: 'none', padding: '4px 8px', borderRadius: 6, border: '0.5px solid rgba(255,255,255,.08)' }}>
                      Profile →
                    </Link>
                  </div>
                </div>

                {/* Quote */}
                {/* Takeaway + Quote */}
{c.is_organic && (
  <p style={{ fontSize: 11, color: '#34D399', margin: '10px 0 6px', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 500 }}>
    💡 {c.creator_name} genuinely uses this — no deal involved
  </p>
)}
{c.best_quote && (
  <div style={{
    background: c.is_organic ? 'rgba(52,211,153,.05)' : 'rgba(255,255,255,.03)',
    borderRadius: 9, padding: '9px 12px', marginTop: c.is_organic ? 0 : 10,
    borderLeft: `2px solid ${c.is_organic ? '#34D399' : 'rgba(255,255,255,.15)'}`
  }}>
    <p style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', margin: 0, fontStyle: 'italic', lineHeight: 1.6 }}>
      "{c.best_quote.slice(0, isOpen ? 300 : 120)}{!isOpen && c.best_quote.length > 120 ? '...' : ''}"
    </p>
  </div>
)}

                {/* All individual mentions — the real evidence behind the count */}
                {isOpen && c.mention_count > 1 && (
                  <div style={{ marginTop: 12 }} onClick={e => e.stopPropagation()}>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      All {c.mention_count} mentions
                    </p>
                    {loadingMentions === c.creator_id ? (
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.25)' }}>Loading...</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                        {(allMentions[c.creator_id] || []).map((m, mi) => (
                          <div key={mi} style={{ background: 'rgba(255,255,255,.03)', borderRadius: 9, padding: '8px 11px' }}>
                            <p style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {m.video_title || 'Untitled'}
                            </p>
                            <p style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', margin: '2px 0 0' }}>
                              {timeAgo(m.first_seen)}{m.platform ? ` · ${m.platform}` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Expanded deal panel */}
                {isOpen && (c.best_code || c.best_offer || promoUrl) && (
                  <div style={{ marginTop: 12, padding: 12, background: 'rgba(255,255,255,.04)', borderRadius: 12, border: '0.5px solid rgba(255,255,255,.1)' }}
                    onClick={e => e.stopPropagation()}>
                    {c.best_offer && (
                      <p style={{ fontSize: 12, color: '#34D399', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
                        🎁 {c.best_offer}
                      </p>
                    )}
                    {c.best_code && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,.06)', borderRadius: 9, padding: '9px 12px', marginBottom: promoUrl ? 10 : 0 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '.08em' }}>
                          {c.best_code}
                        </span>
                        <button onClick={() => copyCode(c.best_code, c.creator_id)}
                          style={{ fontSize: 12, padding: '5px 14px', borderRadius: 7, background: copied === c.creator_id ? 'rgba(34,197,94,.2)' : 'rgba(99,102,241,.15)', color: copied === c.creator_id ? '#34D399' : '#818CF8', border: `0.5px solid ${copied === c.creator_id ? 'rgba(34,197,94,.3)' : 'rgba(99,102,241,.3)'}`, cursor: 'pointer', fontWeight: 600 }}>
                          {copied === c.creator_id ? '✓ Copied!' : 'Copy code'}
                        </button>
                      </div>
                    )}
                    {promoUrl && (
                      <a href={promoUrl} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#818CF8', textDecoration: 'none', marginTop: c.best_code ? 10 : 0 }}>
                        Visit brand →
                      </a>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {creators.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,.2)' }}>
            <p style={{ fontSize: 13 }}>No creator data yet for this brand</p>
          </div>
        )}
      </div>
    </Layout>
  )
}