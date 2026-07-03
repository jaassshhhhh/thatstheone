'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { getFreshnessTier, getFreshnessColor, getFreshnessLine } from '../lib/freshness'

const SESSION_KEY = 'tto_session'
function getSession() {
  if (typeof window === 'undefined') return null
  let s = localStorage.getItem(SESSION_KEY)
  if (!s) { s = crypto.randomUUID(); localStorage.setItem(SESSION_KEY, s) }
  return s
}

async function track(type: string, value: string, brandId?: string, categoryGroup?: string | null) {
    const session = getSession()
    if (!session) return
    await supabase.from('user_signals').insert({ session_id: session, signal_type: type, value, brand_id: brandId || null, category_group: categoryGroup || null }).then(() => {})
  }

const SIGNAL_WEIGHTS: Record<string, number> = { copy: 3, click: 2, search: 1 }
const AFFINITY_THRESHOLD = 3

async function computeAffinity(sessionId: string): Promise<string[]> {
  const { data } = await supabase
    .from('user_signals')
    .select('signal_type, category_group')
    .eq('session_id', sessionId)
    .not('category_group', 'is', null)

  const scores: Record<string, number> = {}
  for (const row of data || []) {
    const weight = SIGNAL_WEIGHTS[row.signal_type] || 1
    scores[row.category_group] = (scores[row.category_group] || 0) + weight
  }

  const totalSignal = Object.values(scores).reduce((a, b) => a + b, 0)
  if (totalSignal < AFFINITY_THRESHOLD) return []

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([category]) => category)
}

const CARD_CONFIGS: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
  VELOCITY: { label: 'Blowing up',          icon: 'ti-flame',        color: '#F87171', bg: 'rgba(239,68,68,.1)',   border: 'rgba(239,68,68,.25)' },
  ORGANIC:  { label: 'Genuine love',        icon: 'ti-heart',        color: '#34D399', bg: 'rgba(16,185,129,.1)',  border: 'rgba(16,185,129,.25)' },
  NEW_DEAL: { label: 'Just dropped',        icon: 'ti-speakerphone', color: '#818CF8', bg: 'rgba(99,102,241,.1)', border: 'rgba(99,102,241,.25)' },
  TRENDING: { label: 'Everyone\'s talking', icon: 'ti-trending-up',  color: '#FBBF24', bg: 'rgba(245,158,11,.1)', border: 'rgba(245,158,11,.25)' },
  MULTI:    { label: 'Creator consensus',   icon: 'ti-users',        color: '#C084FC', bg: 'rgba(139,92,246,.1)', border: 'rgba(139,92,246,.25)' },
  HOT:      { label: 'Limited deal',        icon: 'ti-bolt',         color: '#34D399', bg: 'rgba(16,185,129,.1)', border: 'rgba(16,185,129,.25)' },
  PERSONAL: { label: 'For you',             icon: 'ti-sparkles',     color: '#60A5FA', bg: 'rgba(59,130,246,.1)', border: 'rgba(59,130,246,.25)' },
  EARLY:    { label: 'Just spotted',        icon: 'ti-eye',          color: '#A78BFA', bg: 'rgba(167,139,250,.1)', border: 'rgba(167,139,250,.25)' },
}

const REACTIONS = [
  { type: 'upvote',       emoji: '👍', label: 'Helpful',    activeBg: 'rgba(99,102,241,.15)', activeColor: '#818CF8', activeBorder: 'rgba(99,102,241,.3)' },
  { type: 'code_worked',  emoji: '✓',  label: 'Worked',     activeBg: 'rgba(52,211,153,.1)',  activeColor: '#34D399', activeBorder: 'rgba(52,211,153,.3)' },
  { type: 'code_expired', emoji: '✗',  label: 'Expired',    activeBg: 'rgba(239,68,68,.1)',   activeColor: '#F87171', activeBorder: 'rgba(239,68,68,.3)' },
  { type: 'use_this',     emoji: '♥',  label: 'I use this', activeBg: 'rgba(236,72,153,.1)',  activeColor: '#F472B6', activeBorder: 'rgba(236,72,153,.3)' },
]

const ORGANIC_PHRASES = [
  (creator: string) => `${creator} genuinely uses this — no brand deal involved`,
  (creator: string) => `${creator} personally recommends this, unpaid`,
  (creator: string) => `No sponsorship here — just ${creator}'s honest opinion`,
  (creator: string) => `${creator} brought this up unprompted — real endorsement`,
  (creator: string) => `${creator} actually uses this day to day`,
]

const SPONSORED_PHRASES = [
  (creator: string, offer: string) => `Sponsored deal — ${offer}`,
  (creator: string, offer: string) => `${creator}'s paid partnership — ${offer}`,
  (creator: string, offer: string) => `Active sponsorship: ${offer}`,
  (creator: string, offer: string) => `${creator} is running a promo — ${offer}`,
]

const SPONSORED_NO_OFFER_PHRASES = [
  (creator: string) => `${creator}'s sponsor — check the deal below`,
  (creator: string) => `Paid partnership with ${creator}`,
  (creator: string) => `${creator} is sponsored by this brand`,
]

function hashString(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function getTakeawayLine(s: any, cardId: string) {
  const creator = s.creator_name || s.creators?.name || 'This creator'
  const offer = s.best_offer || s.offer_text
  const hasDeal = s.best_code || s.promo_code || offer
  if (s.is_organic) {
    const idx = hashString(cardId + 'organic') % ORGANIC_PHRASES.length
    return { text: ORGANIC_PHRASES[idx](creator), color: '#34D399', icon: '💡' }
  }
  if (hasDeal && offer) {
    const idx = hashString(cardId + 'sponsored') % SPONSORED_PHRASES.length
    return { text: SPONSORED_PHRASES[idx](creator, offer), color: '#818CF8', icon: '🎯' }
  }
  if (hasDeal) {
    const idx = hashString(cardId + 'sponsorednooffer') % SPONSORED_NO_OFFER_PHRASES.length
    return { text: SPONSORED_NO_OFFER_PHRASES[idx](creator), color: '#818CF8', icon: '🎯' }
  }
  return null
}

function getSignalBreakdown(s: any, cardType: string): { title: string; lines: string[] } | null {
  const brand = s.brand_name || s.brands?.name || 'This brand'
  const creator = s.creator_name || s.creators?.name || 'This creator'
  const mentions = s.mention_count || 1
  const days = s.first_seen ? Math.floor((Date.now() - new Date(s.first_seen).getTime()) / 86400000) : 999
  const months = Math.round(days / 30)

  if (cardType === 'EARLY') return {
    title: 'Why you\'re seeing this early',
    lines: [
      `${brand} first appeared ${days <= 7 ? 'this week' : `${days} days ago`} — very few creators have mentioned it yet.`,
      'Brands at this stage often fly under the radar before wider adoption. Worth watching.',
    ]
  }
  if (cardType === 'ORGANIC') return {
    title: 'Why we think this is genuine',
    lines: [
      `${creator} has mentioned ${brand} ${mentions} time${mentions > 1 ? 's' : ''}${months > 1 ? ` over ${months} months` : ''} without any promo code or deal language.`,
      'Organic mentions like this are rare and typically indicate real personal use — not a paid arrangement.',
    ]
  }
  if (cardType === 'MULTI') return {
    title: 'Why this is a consensus signal',
    lines: [
      `Multiple creators are independently mentioning ${brand} — that kind of spread is harder to manufacture than a single paid campaign.`,
      'When several creators in different niches mention the same brand, it often indicates genuine product-market fit.',
    ]
  }
  if (cardType === 'VELOCITY' || cardType === 'TRENDING') return {
    title: 'Why this is trending',
    lines: [
      `${brand} has accumulated ${mentions} creator mention${mentions > 1 ? 's' : ''} — activity is concentrated recently rather than spread over time.`,
      'Rapid mention growth often precedes mainstream discovery. This is the window before it becomes obvious.',
    ]
  }
  if (cardType === 'HOT' || cardType === 'NEW_DEAL') return {
    title: 'About this deal',
    lines: [
      `${creator} is actively running a promotion for ${brand}${days <= 14 ? ' — started recently' : ''}.`,
      'Creator codes are often time-limited. The deal details are below.',
    ]
  }
  return null
}

function getVelocityStat(s: any): string | null {
  const days = s.first_seen ? Math.floor((Date.now() - new Date(s.first_seen).getTime()) / 86400000) : 999
  const mentions = s.mention_count || 1
  if (days <= 7 && mentions === 1) return '🆕 First spotted this week'
  if (days <= 14 && mentions === 1) return '👀 Just starting to appear'
  if (mentions >= 10) return `🔥 ${mentions} mentions — high conviction signal`
  if (mentions >= 5) return `📈 ${mentions} creators have mentioned this`
  if (s.best_dar_score >= 80) return '✓ High confidence data point'
  return null
}

function classifyCard(s: any, brandCountMap: Record<string, number>, userSearches: string[]): string {
  const brand = s.brand_name || s.brands?.name || ''
  const isSearched = userSearches.some(q => brand.toLowerCase().includes(q.toLowerCase()))
  if (isSearched) return 'PERSONAL'
  const days = s.first_seen ? Math.floor((Date.now() - new Date(s.first_seen).getTime()) / 86400000) : 999
  if (days <= 14 && (s.mention_count || 1) <= 2) return 'EARLY'
  if (s.is_organic) return 'ORGANIC'
  const count = brandCountMap[brand] || 1
  if (count >= 3) return 'MULTI'
  if ((s.best_code || s.promo_code) && (s.best_offer || s.offer_text)) return 'HOT'
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
  if (cardType === 'EARLY') return `${brand} is just starting to appear — ${creator} spotted it first`
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

const FILTERS = ['All', 'For you', 'Trending', 'Deals', 'Organic', 'New', 'Saved']

// Insight config — what each signal means and implies
const INSIGHT_CONFIG = {
  blowingUp: {
    emoji: '🔥',
    color: '#F87171',
    bg: 'rgba(239,68,68,.08)',
    border: 'rgba(239,68,68,.2)',
    label: 'Blowing up',
    what: (brand: string, count: number) => `${brand} — ${count} creator mention${count > 1 ? 's' : ''} in the last 2 weeks`,
    why: 'When mention volume clusters in a short window like this, it typically precedes mainstream discovery. This is the pattern we see before a brand breaks out.',
    implication: 'If this follows the pattern, wider awareness is likely coming. Worth watching now before it becomes obvious.',
  },
  justStarted: {
    emoji: '👀',
    color: '#A78BFA',
    bg: 'rgba(167,139,250,.08)',
    border: 'rgba(167,139,250,.2)',
    label: 'Just appeared',
    what: (brand: string, creator: string) => `${brand} — first spotted by ${creator}`,
    why: 'This brand just entered our dataset for the first time. Only one or two creators have mentioned it — it hasn\'t been picked up widely yet.',
    implication: 'Early signals like this are rare. Most brands we track were spotted here before they appeared in mainstream press.',
  },
  mostGenuine: {
    emoji: '💡',
    color: '#34D399',
    bg: 'rgba(52,211,153,.08)',
    border: 'rgba(52,211,153,.2)',
    label: 'Most genuine',
    what: (brand: string, count: number) => `${brand} — ${count} unpaid mention${count > 1 ? 's' : ''}, no deals found`,
    why: 'Every mention of this brand in our dataset is flagged as organic — no promo codes, no affiliate language, no sponsored markers.',
    implication: 'Organic word-of-mouth at this scale is rare. Creators are talking about this because they actually use it.',
  },
  hiddenGem: {
    emoji: '💎',
    color: '#FBBF24',
    bg: 'rgba(245,158,11,.08)',
    border: 'rgba(245,158,11,.2)',
    label: 'Hidden gem',
    why: 'This brand has an active deal but very few creators are talking about it yet — it hasn\'t been widely picked up. Under the radar, but verified.',
    implication: 'Hidden gems like this often get flooded with promotions once they break through. This is the window to use the deal before everyone knows about it.',
  },
  bestDeal: {
    emoji: '🏆',
    color: '#34D399',
    bg: 'rgba(52,211,153,.08)',
    border: 'rgba(52,211,153,.2)',
    label: 'Best verified deal',
    why: 'Highest confidence score in our dataset right now — multiple signals confirm this deal is real, active, and worth using.',
    implication: 'Our confidence score combines creator mention frequency, code validation, and community verification. This one scores highest this week.',
  },
}

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
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set())
  const [affinityCategories, setAffinityCategories] = useState<string[]>([])
  const [weeklyInsights, setWeeklyInsights] = useState<{ blowingUp: any; justStarted: any; mostGenuine: any; hiddenGem: any; bestDeal: any } | null>(null)
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null)
  const loaderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const recent = JSON.parse(localStorage.getItem('tto_recent') || '[]')
    setUserSearches(recent)
    supabase.from('sponsorships').select('*', { count: 'exact', head: true }).then(({ count }) => setTotalCount(count || 0))
    loadBookmarks()
    loadWeeklyInsights()
    const session = getSession()
    if (session) computeAffinity(session).then(setAffinityCategories)
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

  async function loadBookmarks() {
    const session = getSession()
    if (!session) return
    const { data } = await supabase.from('user_bookmarks').select('target_id').eq('session_id', session)
    setBookmarks(new Set((data || []).map((b: any) => b.target_id)))
  }

  async function loadWeeklyInsights() {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString()
    const [{ data: velocityData }, { data: earlyData }, { data: organicData }, { data: hiddenGemData }, { data: bestDealData }] = await Promise.all([
      supabase.from('creator_brand_relationships').select('brand_name, mention_count, brand_slug').gte('last_seen', twoWeeksAgo).order('mention_count', { ascending: false }).limit(1),
      supabase.from('creator_brand_relationships').select('brand_name, creator_name, first_seen, brand_slug').gte('first_seen', twoWeeksAgo).order('first_seen', { ascending: false }).limit(1),
      supabase.from('creator_brand_relationships').select('brand_name, mention_count, brand_slug').eq('is_organic', true).order('mention_count', { ascending: false }).limit(1),
    // Hidden gem: has a code, low mention count (under the radar), active
    supabase.from('creator_brand_relationships').select('brand_name, creator_name, best_code, best_offer, brand_slug, best_promo_url').not('best_code', 'is', null).lt('mention_count', 4).not('brand_name', 'in', '("iTrustCapital","Coinbase","Binance","Kraken","eToro","Robinhood","Webull","Public","Moomoo","Acorns")').order('best_dar_score', { ascending: false }).limit(1),
     // Best verified deal: highest DAR score with an active code, excluding crypto/finance categories
     supabase.from('creator_brand_relationships').select('brand_name, creator_name, best_code, best_offer, best_dar_score, brand_slug, best_promo_url').not('best_code', 'is', null).eq('is_active', true).not('brand_name', 'in', '("iTrustCapital","Coinbase","Binance","Kraken","eToro","Robinhood","Webull","Public","Moomoo","Acorns")').order('best_dar_score', { ascending: false }).limit(1),])
    setWeeklyInsights({
      blowingUp: velocityData?.[0] || null,
      justStarted: earlyData?.[0] || null,
      mostGenuine: organicData?.[0] || null,
      hiddenGem: hiddenGemData?.[0] || null,
      bestDeal: bestDealData?.[0] || null,
    })
  }
  async function toggleBookmark(e: React.MouseEvent, cardId: string, brandName: string, creatorName: string) {
    e.stopPropagation()
    const session = getSession()
    if (!session) return
    const isBookmarked = bookmarks.has(cardId)
    setBookmarks(prev => { const next = new Set(prev); isBookmarked ? next.delete(cardId) : next.add(cardId); return next })
    if (isBookmarked) {
      await supabase.from('user_bookmarks').delete().eq('session_id', session).eq('target_id', cardId)
    } else {
      await supabase.from('user_bookmarks').insert({ session_id: session, target_type: 'sponsorship', target_id: cardId, brand_name: brandName, creator_name: creatorName })
    }
  }

  async function loadFeed(pageNum: number, reset = false) {
    setLoading(true)
    const from = pageNum * 20
    const to = from + 19

    if ((filter === 'For you' && userSearches.length === 0) || (filter === 'Saved' && bookmarks.size === 0)) {
      setFeed([]); setLoading(false); return
    }

    let q = supabase.from('creator_brand_relationships').select('*').order('freshness_rank', { ascending: true }).order('best_dar_score', { ascending: false }).order('last_seen', { ascending: false }).range(from, to)
    if (filter === 'Deals') q = q.not('best_code', 'is', null)
    if (filter === 'Organic') q = q.eq('is_organic', true)
    if (filter === 'New') q = q.gte('first_seen', new Date(Date.now() - 14 * 86400000).toISOString())
    if (filter === 'Trending') q = q.gte('best_dar_score', 70)
    if (filter === 'Saved') q = q.in('id', [...bookmarks])

    const { data } = await q
    const items = (data || []).filter((s: any) => s.brand_name && s.creator_name)
    const brandMap: Record<string, number> = {}
    items.forEach((s: any) => { brandMap[s.brand_name || ''] = (brandMap[s.brand_name || ''] || 0) + 1 })

    const classified = items.map((s: any) => {
      const cardType = classifyCard(s, brandMap, userSearches)
      return { ...s, cardType, headline: s.headline || generateHeadline(s, cardType, userSearches, brandMap) }
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
    setReactionCounts(prev => { const cur = prev[stateKey] || {}; return { ...prev, [stateKey]: { ...cur, [reactionType]: Math.max(0, (cur[reactionType] || 0) + (isActive ? -1 : 1)) } } })
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

  const copyCode = async (code: string, id: string, brand: string, brandId?: string, categoryGroup?: string | null) => {
    await navigator.clipboard.writeText(code)
    setCopied(id)
    track('copy', brand, brandId, categoryGroup)
    setTimeout(() => setCopied(null), 2000)
  }

  const isHero = (s: any, i: number) => i === 0 || s.cardType === 'PERSONAL' || s.cardType === 'VELOCITY'
  const breakingOut = feed.filter(s => s.cardType !== 'EARLY')
  const justSpotted = feed.filter(s => s.cardType === 'EARLY')
  const showSplit = filter === 'All' && justSpotted.length > 0

  return (
    <Layout>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.4} }
        @keyframes slideDown { from { opacity:0; transform:translateY(-6px) } to { opacity:1; transform:translateY(0) } }
        .fc { animation: fadeUp .35s ease forwards; transition: border-color .2s, transform .2s }
        .fc:hover { border-color: rgba(255,255,255,.15) !important; transform: translateY(-1px) }
        .filt:hover { background: rgba(255,255,255,.07) !important }
        .rxn:hover { opacity: .8 }
        .bm:hover { opacity: 1 !important }
        .ins-row:hover { background: rgba(255,255,255,.03) !important }
        .ins-expanded { animation: slideDown .2s ease forwards }
      `}</style>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 14px 40px' }}>

        {/* Header */}
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

        {/* Weekly insight bar — interactive, expandable */}
        {weeklyInsights && filter === 'All' && (
          <div style={{ background: 'rgba(255,255,255,.02)', border: '0.5px solid rgba(255,255,255,.07)', borderRadius: 16, marginBottom: 16, overflow: 'hidden' }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.06em', margin: 0, padding: '12px 16px 8px' }}>
              This week in creator commerce
            </p>

            {/* Blowing up */}
            {weeklyInsights.blowingUp && (() => {
              const cfg = INSIGHT_CONFIG.blowingUp
              const isExp = expandedInsight === 'blowingUp'
              return (
                <div>
                  <div className="ins-row"
                    onClick={() => setExpandedInsight(isExp ? null : 'blowingUp')}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', borderRadius: 8, transition: 'background .15s' }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{cfg.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', margin: 0, lineHeight: 1.4 }}>
                        <span style={{ color: cfg.color, fontWeight: 600 }}>{weeklyInsights.blowingUp.brand_name}</span>
                        {' '}— {weeklyInsights.blowingUp.mention_count} creator mention{weeklyInsights.blowingUp.mention_count > 1 ? 's' : ''} in the last 2 weeks
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: cfg.bg, color: cfg.color, border: `0.5px solid ${cfg.border}`, fontWeight: 600 }}>
                        {cfg.label}
                      </span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,.25)', transform: isExp ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s', display: 'inline-block' }}>↓</span>
                    </div>
                  </div>
                  {isExp && (
                    <div className="ins-expanded" style={{ margin: '0 12px 10px', padding: '12px 14px', background: cfg.bg, borderRadius: 10, border: `0.5px solid ${cfg.border}` }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: cfg.color, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '.04em' }}>What this means</p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', margin: '0 0 6px', lineHeight: 1.6 }}>{cfg.why}</p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', margin: '0 0 10px', lineHeight: 1.6, fontStyle: 'italic' }}>{cfg.implication}</p>
                      {weeklyInsights.blowingUp.brand_slug && (
                        <a href={`/brands/${weeklyInsights.blowingUp.brand_slug}`}
                          style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, background: 'rgba(255,255,255,.08)', color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          View {weeklyInsights.blowingUp.brand_name} →
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Divider */}
            {weeklyInsights.blowingUp && weeklyInsights.justStarted && (
              <div style={{ height: '0.5px', background: 'rgba(255,255,255,.05)', margin: '0 16px' }} />
            )}

            {/* Just started */}
            {weeklyInsights.justStarted && (() => {
              const cfg = INSIGHT_CONFIG.justStarted
              const isExp = expandedInsight === 'justStarted'
              return (
                <div>
                  <div className="ins-row"
                    onClick={() => setExpandedInsight(isExp ? null : 'justStarted')}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', borderRadius: 8, transition: 'background .15s' }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{cfg.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', margin: 0, lineHeight: 1.4 }}>
                        <span style={{ color: cfg.color, fontWeight: 600 }}>{weeklyInsights.justStarted.brand_name}</span>
                        {' '}just appeared — first spotted by{' '}
                        <span style={{ color: 'rgba(255,255,255,.5)' }}>{weeklyInsights.justStarted.creator_name}</span>
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: cfg.bg, color: cfg.color, border: `0.5px solid ${cfg.border}`, fontWeight: 600 }}>
                        {cfg.label}
                      </span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,.25)', transform: isExp ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s', display: 'inline-block' }}>↓</span>
                    </div>
                  </div>
                  {isExp && (
                    <div className="ins-expanded" style={{ margin: '0 12px 10px', padding: '12px 14px', background: cfg.bg, borderRadius: 10, border: `0.5px solid ${cfg.border}` }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: cfg.color, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '.04em' }}>What this means</p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', margin: '0 0 6px', lineHeight: 1.6 }}>{cfg.why}</p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', margin: '0 0 10px', lineHeight: 1.6, fontStyle: 'italic' }}>{cfg.implication}</p>
                      {weeklyInsights.justStarted.brand_slug && (
                        <a href={`/brands/${weeklyInsights.justStarted.brand_slug}`}
                          style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, background: 'rgba(255,255,255,.08)', color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          View {weeklyInsights.justStarted.brand_name} →
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Divider */}
            {weeklyInsights.justStarted && weeklyInsights.mostGenuine && (
              <div style={{ height: '0.5px', background: 'rgba(255,255,255,.05)', margin: '0 16px' }} />
            )}

            {/* Most genuine */}
            {weeklyInsights.mostGenuine && (() => {
              const cfg = INSIGHT_CONFIG.mostGenuine
              const isExp = expandedInsight === 'mostGenuine'
              return (
                <div>
                  <div className="ins-row"
                    onClick={() => setExpandedInsight(isExp ? null : 'mostGenuine')}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', borderRadius: 8, transition: 'background .15s' }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{cfg.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', margin: 0, lineHeight: 1.4 }}>
                        <span style={{ color: cfg.color, fontWeight: 600 }}>{weeklyInsights.mostGenuine.brand_name}</span>
                        {' '}— {weeklyInsights.mostGenuine.mention_count} unpaid mention{weeklyInsights.mostGenuine.mention_count > 1 ? 's' : ''}, no deals found
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: cfg.bg, color: cfg.color, border: `0.5px solid ${cfg.border}`, fontWeight: 600 }}>
                        {cfg.label}
                      </span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,.25)', transform: isExp ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s', display: 'inline-block' }}>↓</span>
                    </div>
                  </div>
                  {isExp && (
                    <div className="ins-expanded" style={{ margin: '0 12px 10px', padding: '12px 14px', background: cfg.bg, borderRadius: 10, border: `0.5px solid ${cfg.border}` }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: cfg.color, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '.04em' }}>What this means</p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', margin: '0 0 6px', lineHeight: 1.6 }}>{cfg.why}</p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', margin: '0 0 10px', lineHeight: 1.6, fontStyle: 'italic' }}>{cfg.implication}</p>
                      {weeklyInsights.mostGenuine.brand_slug && (
                        <a href={`/brands/${weeklyInsights.mostGenuine.brand_slug}`}
                          style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, background: 'rgba(255,255,255,.08)', color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          View {weeklyInsights.mostGenuine.brand_name} →
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Divider */}
            {weeklyInsights.mostGenuine && weeklyInsights.hiddenGem && (
              <div style={{ height: '0.5px', background: 'rgba(255,255,255,.05)', margin: '0 16px' }} />
            )}

            {/* Hidden gem */}
            {weeklyInsights.hiddenGem && (() => {
              const cfg = INSIGHT_CONFIG.hiddenGem
              const isExp = expandedInsight === 'hiddenGem'
              return (
                <div>
                  <div className="ins-row"
                    onClick={() => setExpandedInsight(isExp ? null : 'hiddenGem')}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', borderRadius: 8, transition: 'background .15s' }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{cfg.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', margin: 0, lineHeight: 1.4 }}>
                        <span style={{ color: cfg.color, fontWeight: 600 }}>{weeklyInsights.hiddenGem.brand_name}</span>
                        {' '}— active deal, barely anyone's talking about it yet
                        {weeklyInsights.hiddenGem.best_code && (
                          <span style={{ marginLeft: 6, fontFamily: 'monospace', fontSize: 11, color: cfg.color, background: cfg.bg, padding: '1px 6px', borderRadius: 5 }}>
                            {weeklyInsights.hiddenGem.best_code}
                          </span>
                        )}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: cfg.bg, color: cfg.color, border: `0.5px solid ${cfg.border}`, fontWeight: 600 }}>
                        {cfg.label}
                      </span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,.25)', transform: isExp ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s', display: 'inline-block' }}>↓</span>
                    </div>
                  </div>
                  {isExp && (
                    <div className="ins-expanded" style={{ margin: '0 12px 10px', padding: '12px 14px', background: cfg.bg, borderRadius: 10, border: `0.5px solid ${cfg.border}` }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: cfg.color, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '.04em' }}>What this means</p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', margin: '0 0 6px', lineHeight: 1.6 }}>{cfg.why}</p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', margin: '0 0 10px', lineHeight: 1.6, fontStyle: 'italic' }}>{cfg.implication}</p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {weeklyInsights.hiddenGem.best_code && (
                          <button
                            onClick={() => copyCode(weeklyInsights.hiddenGem.best_code, 'insight-gem', weeklyInsights.hiddenGem.brand_name)}
                            style={{ fontSize: 12, padding: '5px 14px', borderRadius: 8, background: copied === 'insight-gem' ? 'rgba(34,197,94,.2)' : cfg.bg, color: copied === 'insight-gem' ? '#34D399' : cfg.color, border: `0.5px solid ${cfg.border}`, cursor: 'pointer', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '.04em' }}>
                            {copied === 'insight-gem' ? '✓ Copied!' : weeklyInsights.hiddenGem.best_code}
                          </button>
                        )}
                        {weeklyInsights.hiddenGem.brand_slug && (
                          <a href={`/brands/${weeklyInsights.hiddenGem.brand_slug}`}
                            style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, background: 'rgba(255,255,255,.08)', color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            Brand page →
                          </a>
                        )}
                        {weeklyInsights.hiddenGem.best_promo_url && (
                          <a href={weeklyInsights.hiddenGem.best_promo_url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, background: 'rgba(255,255,255,.08)', color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            Visit website →
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Divider */}
            {weeklyInsights.hiddenGem && weeklyInsights.bestDeal && (
              <div style={{ height: '0.5px', background: 'rgba(255,255,255,.05)', margin: '0 16px' }} />
            )}

            {/* Best verified deal */}
            {weeklyInsights.bestDeal && (() => {
              const cfg = INSIGHT_CONFIG.bestDeal
              const isExp = expandedInsight === 'bestDeal'
              return (
                <div>
                  <div className="ins-row"
                    onClick={() => setExpandedInsight(isExp ? null : 'bestDeal')}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', borderRadius: 8, transition: 'background .15s' }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{cfg.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', margin: 0, lineHeight: 1.4 }}>
                        <span style={{ color: cfg.color, fontWeight: 600 }}>{weeklyInsights.bestDeal.brand_name}</span>
                        {' '}via {weeklyInsights.bestDeal.creator_name}
                        {weeklyInsights.bestDeal.best_offer && (
                          <span style={{ color: 'rgba(255,255,255,.4)', marginLeft: 4 }}>— {weeklyInsights.bestDeal.best_offer}</span>
                        )}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: cfg.bg, color: cfg.color, border: `0.5px solid ${cfg.border}`, fontWeight: 600 }}>
                        {cfg.label}
                      </span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,.25)', transform: isExp ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s', display: 'inline-block' }}>↓</span>
                    </div>
                  </div>
                  {isExp && (
                    <div className="ins-expanded" style={{ margin: '0 12px 10px', padding: '12px 14px', background: cfg.bg, borderRadius: 10, border: `0.5px solid ${cfg.border}` }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: cfg.color, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '.04em' }}>What this means</p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', margin: '0 0 6px', lineHeight: 1.6 }}>{cfg.why}</p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', margin: '0 0 10px', lineHeight: 1.6, fontStyle: 'italic' }}>{cfg.implication}</p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {weeklyInsights.bestDeal.best_code && (
                          <button
                            onClick={() => copyCode(weeklyInsights.bestDeal.best_code, 'insight-best', weeklyInsights.bestDeal.brand_name)}
                            style={{ fontSize: 12, padding: '5px 14px', borderRadius: 8, background: copied === 'insight-best' ? 'rgba(34,197,94,.2)' : cfg.bg, color: copied === 'insight-best' ? '#34D399' : cfg.color, border: `0.5px solid ${cfg.border}`, cursor: 'pointer', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '.04em' }}>
                            {copied === 'insight-best' ? '✓ Copied!' : weeklyInsights.bestDeal.best_code}
                          </button>
                        )}
                        {weeklyInsights.bestDeal.brand_slug && (
                          <a href={`/brands/${weeklyInsights.bestDeal.brand_slug}`}
                            style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, background: 'rgba(255,255,255,.08)', color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            Brand page →
                          </a>
                        )}
                        {weeklyInsights.bestDeal.best_promo_url && (
                          <a href={weeklyInsights.bestDeal.best_promo_url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, background: 'rgba(255,255,255,.08)', color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            Visit website →
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            <div style={{ height: 4 }} />
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 2 }}>
          {FILTERS.map(f => (
            <button key={f} className="filt" onClick={() => { setFilter(f); setPage(0) }}
              style={{ fontSize: 11, padding: '5px 13px', borderRadius: 20, border: '0.5px solid', whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all .15s', borderColor: filter === f ? '#6366F1' : 'rgba(255,255,255,.08)', background: filter === f ? 'rgba(99,102,241,.15)' : 'transparent', color: filter === f ? '#818CF8' : 'rgba(255,255,255,.4)' }}>
              {f === 'For you' ? '✦ For you' : f === 'Saved' ? `🔖 Saved${bookmarks.size > 0 ? ` · ${bookmarks.size}` : ''}` : f}
            </button>
          ))}
        </div>

        {/* Feed */}
        {loading && page === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,.2)' }}>
            <p style={{ fontSize: 13 }}>Loading pulse...</p>
          </div>
        ) : filter === 'For you' && feed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', background: 'rgba(255,255,255,.02)', borderRadius: 16, border: '0.5px solid rgba(255,255,255,.07)' }}>
            <p style={{ fontSize: 28, marginBottom: 12 }}>✦</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 8 }}>Nothing personalised yet</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', marginBottom: 20, lineHeight: 1.6 }}>Search for brands or creators you care about<br />and we'll tailor your feed automatically</p>
            <button onClick={() => setFilter('All')} style={{ fontSize: 13, padding: '8px 20px', borderRadius: 20, background: 'rgba(99,102,241,.15)', color: '#818CF8', border: '0.5px solid rgba(99,102,241,.25)', cursor: 'pointer' }}>Browse all</button>
          </div>
        ) : filter === 'Saved' && feed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', background: 'rgba(255,255,255,.02)', borderRadius: 16, border: '0.5px solid rgba(255,255,255,.07)' }}>
            <p style={{ fontSize: 28, marginBottom: 12 }}>🔖</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 8 }}>Nothing saved yet</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', marginBottom: 20, lineHeight: 1.6 }}>Tap the bookmark icon on any card<br />to save it for later</p>
            <button onClick={() => setFilter('All')} style={{ fontSize: 13, padding: '8px 20px', borderRadius: 20, background: 'rgba(99,102,241,.15)', color: '#818CF8', border: '0.5px solid rgba(99,102,241,.25)', cursor: 'pointer' }}>Browse all</button>
          </div>
        ) : feed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: 28, marginBottom: 10 }}>◎</p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.3)' }}>Nothing here yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {showSplit && breakingOut.length > 0 && (
              <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '4px 0 2px' }}>Breaking out</p>
            )}
            {(showSplit ? breakingOut : feed).map((s: any, i: number) => renderCard(s, i))}
            {showSplit && justSpotted.length > 0 && (
              <>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(167,139,250,.6)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '8px 0 2px', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span>👀</span> Just spotted — catch it early
                </p>
                {justSpotted.map((s: any, i: number) => renderCard(s, i + breakingOut.length))}
              </>
            )}
            <div ref={loaderRef} style={{ padding: '20px 0', textAlign: 'center' }}>
              {loading && page > 0 && <p style={{ fontSize: 12, color: 'rgba(255,255,255,.2)' }}>Loading more...</p>}
              {!hasMore && feed.length > 0 && <p style={{ fontSize: 12, color: 'rgba(255,255,255,.15)' }}>You're all caught up ✓</p>}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )

  function renderCard(s: any, i: number) {
    const cfg = CARD_CONFIGS[s.cardType] || CARD_CONFIGS.TRENDING
    const isOpen = expanded === s.id || expanded === `${s.creator_id}-${s.brand_id}`
    const cardId = s.id || `${s.creator_id}-${s.brand_id}`
    const hasDeal = s.best_code || s.promo_code || s.best_offer || s.offer_text || s.best_promo_url || s.promo_url
    const hero = isHero(s, i)
    const quote = s.best_quote || s.exact_quote
    const code = s.best_code || s.promo_code
    const offer = s.best_offer || s.offer_text
    const videoId = s.best_video_id || s.video_id
    const promoUrl = s.best_promo_url || s.promo_url || s.brand_url
    const sourceUrl = s.best_content_url
    const takeaway = getTakeawayLine(s, cardId)
    const velocityStat = getVelocityStat(s)
    const signalBreakdown = getSignalBreakdown(s, s.cardType)
    const fallbackUrl = !promoUrl && s.is_organic
      ? `https://www.google.com/search?q=${encodeURIComponent('"' + (s.brand_name || s.brands?.name || '') + '" official website')}&btnI=1`
      : null
    const isBookmarked = bookmarks.has(cardId)
    const brandName = s.brand_name || s.brands?.name
    const creatorName = s.creator_name || s.creators?.name
    const subs = s.subscriber_count || s.creators?.subscriber_count
    const metaBits = [
      s.mention_count > 1 ? `${s.mention_count}× mentioned` : null,
      subs > 0 ? formatSubs(subs) : null,
    ].filter(Boolean).join(' · ')

    return (
      <div key={cardId} className="fc"
        style={{ animationDelay: `${Math.min(i, 8) * 0.04}s`, background: `${cfg.color}0d`, border: `0.5px solid ${cfg.border}`, borderRadius: hero ? 20 : 16, padding: hero ? '20px' : '16px', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
        onClick={() => { setExpanded(isOpen ? null : cardId); track('click', s.brand_name || '', s.brand_id, s.brand_category_group) }}>

        <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: cfg.color, opacity: hero ? .1 : .06, filter: 'blur(24px)', pointerEvents: 'none' }} />

        {/* Badge + time + bookmark */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, padding: '4px 11px', borderRadius: 20, background: cfg.bg, color: cfg.color }}>
            <i className={`ti ${cfg.icon}`} style={{ fontSize: 12 }} aria-hidden="true" />
            {cfg.label}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.25)' }}>{timeAgo(s.last_seen || s.first_seen)}</span>
            <button className="bm" onClick={e => toggleBookmark(e, cardId, s.brand_name || '', s.creator_name || '')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: 14, opacity: isBookmarked ? 1 : 0.35, color: isBookmarked ? '#FBBF24' : 'rgba(255,255,255,.5)', transition: 'all .15s' }}>
              🔖
            </button>
          </div>
        </div>

        {/* Headline — serif for warmth */}
        <p style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif', fontSize: hero ? 19 : 16, fontWeight: 400, color: '#fff', margin: '0 0 10px', lineHeight: 1.35 }}>
          {s.headline}
        </p>

        {/* Takeaway */}
        {takeaway && (
          <p style={{ fontSize: 12, color: takeaway.color, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span>{takeaway.icon}</span> {takeaway.text}
          </p>
        )}

        {/* Velocity stat */}
        {velocityStat && (
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', margin: '0 0 14px' }}>
            {velocityStat}
          </p>
        )}

        {/* Brand + Creator — bigger avatar, condensed meta line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: cfg.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600, color: cfg.color, flexShrink: 0 }}>
            {brandName?.[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
              {brandName}
              {(s.best_dar_score || s.dar_score) >= 75 && (
                <i className="ti ti-shield-check" style={{ fontSize: 13, color: '#34D399', opacity: .7 }} aria-hidden="true" />
              )}
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', margin: '2px 0 0' }}>
              via {creatorName}{metaBits ? ` · ${metaBits}` : ''}
            </p>
          </div>
        </div>

        {/* Quote — soft filled panel, no hard border accent */}
        {quote && (
          <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 12, padding: '13px 15px', marginTop: 14 }}>
            <p style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif', fontSize: hero ? 14 : 13, color: 'rgba(255,255,255,.75)', margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
              "{quote.slice(0, isOpen ? 300 : 130)}{!isOpen && quote.length > 130 ? '...' : ''}"
            </p>
          </div>
        )}

        {/* Freshness — leads with recency of confirmation, not age of origin */}
        {(() => {
          const tier = getFreshnessTier(s.last_seen)
          return (
            <>
              <p style={{ fontSize: 11, color: getFreshnessColor(tier), margin: '10px 0 0' }}>
                {getFreshnessLine({ tier, lastSeen: s.last_seen, firstSeen: s.first_seen, mentionCount: s.mention_count || 1, timeAgo })}
              </p>
              {tier === 'dormant' && (hasDeal || s.is_organic) && (
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', fontStyle: 'italic', margin: '3px 0 0' }}>
                  Still valid? Let us know below ↓
                </p>
              )}
            </>
          )
        })()}

        {/* Bottom row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, marginTop: 14, borderTop: '0.5px solid rgba(255,255,255,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: s.is_active ? '#34D399' : 'rgba(255,255,255,.25)' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.is_active ? '#34D399' : 'rgba(255,255,255,.25)', display: 'inline-block' }} />
            {s.is_active ? 'Active' : 'Unverified'}
            {s.platform && <span style={{ color: 'rgba(255,255,255,.2)' }}> · {s.platform}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {sourceUrl && (
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ width: 30, height: 30, borderRadius: '50%', background: 'transparent', border: '0.5px solid rgba(255,255,255,.15)', color: 'rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, textDecoration: 'none' }}>
                <i className="ti ti-player-play" style={{ fontSize: 13 }} aria-hidden="true" />
              </a>
            )}
            {hasDeal ? (
              code ? (
                <>
                  {promoUrl && (
                    <a href={promoUrl} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ fontSize: 12, padding: '7px 12px', borderRadius: 9, background: 'transparent', color: 'rgba(255,255,255,.5)', border: '0.5px solid rgba(255,255,255,.12)', fontWeight: 500, textDecoration: 'none' }}>
                      Visit brand
                    </a>
                  )}
                  <button onClick={e => { e.stopPropagation(); copyCode(code, cardId, s.brand_name || '', s.brand_id, s.brand_category_group) }}
                    style={{ fontSize: 12, padding: '7px 14px', borderRadius: 9, background: copied === cardId ? '#34D399' : cfg.color, color: '#060810', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                    {copied === cardId ? '✓ Copied' : 'Get code'}
                  </button>
                </>
              ) : promoUrl ? (
                <a href={promoUrl} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{ fontSize: 12, padding: '7px 14px', borderRadius: 9, background: cfg.color, color: '#060810', fontWeight: 600, textDecoration: 'none' }}>
                  Visit brand
                </a>
              ) : (
                <button onClick={e => { e.stopPropagation(); setExpanded(cardId) }}
                  style={{ fontSize: 12, padding: '7px 14px', borderRadius: 9, background: cfg.color, color: '#060810', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  See deal
                </button>
              )
            ) : s.is_organic ? (
              <a href={promoUrl || fallbackUrl || '#'} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                style={{ fontSize: 12, padding: '7px 14px', borderRadius: 9, background: '#34D399', color: '#052e21', fontWeight: 600, textDecoration: 'none' }}>
                Find this
              </a>
            ) : null}
          </div>
        </div>

        {/* Reactions — icon-only row */}
        <div style={{ display: 'flex', gap: 16, paddingTop: 12, marginTop: 12, borderTop: '0.5px solid rgba(255,255,255,.04)' }}
          onClick={e => e.stopPropagation()}>
          {REACTIONS.map(r => {
            const count = reactionCounts[cardId]?.[r.type] || 0
            const active = myReactions[cardId]?.includes(r.type)
            return (
              <button key={r.type} className="rxn" title={r.label}
                onClick={e => toggleReaction(e, cardId, r.type, s.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: active ? r.activeColor : 'rgba(255,255,255,.3)', padding: 0 }}>
                <span style={{ fontSize: 15 }}>{r.emoji}</span>
                {count > 0 && <span>{count}</span>}
              </button>
            )
          })}
        </div>

        {/* Expanded panel — signal breakdown + deal */}
        {isOpen && (
          <div style={{ marginTop: 14 }} onClick={e => e.stopPropagation()}>

            {/* Signal breakdown — the "why this matters" */}
            {signalBreakdown && (
              <div style={{ padding: '13px 15px', background: `${cfg.color}0d`, borderRadius: 12, marginBottom: hasDeal ? 10 : 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: cfg.color, margin: '0 0 8px' }}>
                  {signalBreakdown.title}
                </p>
                {signalBreakdown.lines.map((line, idx) => (
                  <p key={idx} style={{ fontSize: 12, color: idx === 0 ? 'rgba(255,255,255,.65)' : 'rgba(255,255,255,.4)', margin: idx < signalBreakdown.lines.length - 1 ? '0 0 6px' : 0, lineHeight: 1.6, fontStyle: idx === 1 ? 'italic' : 'normal' }}>
                    {line}
                  </p>
                ))}
                {s.brand_slug && (
                  <a href={`/brands/${s.brand_slug}`} onClick={e => e.stopPropagation()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: cfg.color, textDecoration: 'none', marginTop: 10, opacity: .8 }}>
                    View {s.brand_name} brand page →
                  </a>
                )}
              </div>
            )}

            {/* Deal panel */}
            {hasDeal && (
              <div style={{ padding: 14, background: 'rgba(255,255,255,.04)', borderRadius: 12 }}>
                {offer && (
                  <p style={{ fontSize: 12, color: '#34D399', marginBottom: code ? 10 : 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <i className="ti ti-gift" style={{ fontSize: 13 }} aria-hidden="true" />
                    {offer}
                  </p>
                )}
                {code && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,.06)', borderRadius: 9, padding: '9px 12px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '.08em' }}>{code}</span>
                    <button onClick={() => copyCode(code, cardId, s.brand_name || '', s.brand_id, s.brand_category_group)}
                      style={{ fontSize: 12, padding: '5px 14px', borderRadius: 7, background: copied === cardId ? '#34D399' : cfg.color, color: '#060810', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      {copied === cardId ? '✓ Copied!' : 'Copy code'}
                    </button>
                  </div>
                )}
                {promoUrl && !code && (
                  <a href={promoUrl} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: cfg.color, textDecoration: 'none', marginTop: 6 }}>
                    <i className="ti ti-external-link" style={{ fontSize: 13 }} aria-hidden="true" />
                    Go to deal
                  </a>
                )}
                {(promoUrl || fallbackUrl) && (
                  <a href={promoUrl || fallbackUrl || '#'} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'rgba(255,255,255,.28)', textDecoration: 'none', marginTop: 10 }}>
                    Visit brand →
                  </a>
                )}
              </div>
            )}

            {/* Video title */}
            {s.video_title && (
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', margin: '10px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <i className="ti ti-brand-youtube" style={{ fontSize: 12, marginRight: 4 }} aria-hidden="true" />
                {s.video_title}
              </p>
            )}
          </div>
        )}
      </div>
    )
  }
}