import OpenAI from 'openai'
import { YoutubeTranscript } from 'youtube-transcript'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const YT_KEYS = [
    process.env.YOUTUBE_API_KEY,
    process.env.YOUTUBE_API_KEY_2,
    process.env.YOUTUBE_API_KEY_3,
    process.env.YOUTUBE_API_KEY_4,
    process.env.YOUTUBE_API_KEY_5,
    process.env.YOUTUBE_API_KEY_6,
  ].filter(Boolean)
  
  // Each key gets its own quota tracker — 8000 unit safety budget per key
  const keyQuotas = YT_KEYS.map(() => ({ used: 0, limit: 8000 }))
  
  // Round-robin key selector with automatic skip when a key is exhausted
  let currentKeyIndex = 0
  function getActiveKey() {
    for (let i = 0; i < YT_KEYS.length; i++) {
      const idx = (currentKeyIndex + i) % YT_KEYS.length
      if (keyQuotas[idx].used < keyQuotas[idx].limit) {
        currentKeyIndex = idx
        return { key: YT_KEYS[idx], index: idx }
      }
    }
    return null // all keys exhausted
  }
  
  function useQuotaForKey(keyIndex, units) {
    keyQuotas[keyIndex].used += units
    return keyQuotas[keyIndex].used <= keyQuotas[keyIndex].limit
  }
  
  function totalQuotaUsed() {
    return keyQuotas.reduce((sum, q) => sum + q.used, 0)
  }
  
  function totalQuotaLimit() {
    return keyQuotas.reduce((sum, q) => sum + q.limit, 0)
  }
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET

const MIN_SUBSCRIBERS = 50000
const MAX_CREATORS_PER_RUN = 60
const VIDEOS_PER_CREATOR = 30

// ─── YouTube quota tracker ─────────────────────────────────
// Free tier: 10,000 units/day. Resets midnight Pacific (8am UK).
// search = 100 units, videos/channels = 5 units
// const quota = { used: 0, limit: 8000 }
// function useQuota(units) {
//   quota.used += units
//   if (quota.used > quota.limit) {
//     console.log(`  ⚠️  YouTube quota limit reached (~${quota.used} units used)`)
//     return false
//   }
//   return true
// }

// ─── Brand blocklist ───────────────────────────────────────
const PODCAST_YOUTUBE_CHANNELS = [
    { channelId: 'UC2D2CMWXMOVWx7giW1n3LIg', name: 'Huberman Lab', category: 'Health' },
    { channelId: 'UCGq-a57w-aPwyi3pW7XLiHw', name: 'My First Million', category: 'Finance' },
    { channelId: 'UCnUYZLuoy1rq1aVMwx4aTzw', name: 'Diary of a CEO', category: 'Entrepreneurship' },
    { channelId: 'UCm_OTHGeSMDJmYperpuNlog', name: 'Lex Fridman', category: 'Tech' },
    { channelId: 'UCXv0OcGQLepRNiAQ2GHqXZA', name: 'Modern Wisdom', category: 'Lifestyle' },
    { channelId: 'UC3-KIvmiIaZimgXaTdaor_g', name: 'Tim Ferriss', category: 'Lifestyle' },
    { channelId: 'UCpXwMqnXfJzazKS5os6V_3Q', name: 'All-In Podcast', category: 'Tech' },
    { channelId: 'UCWX3ygDGABMYPRo43wHFKnw', name: 'The Knowledge Project', category: 'Productivity' },
    { channelId: 'UCGoBXTuTaL5WBDm9n79FMVQ', name: 'Codie Sanchez', category: 'Finance' },
    { channelId: 'UCddiUEpeqJcYeBxX1IVBKvQ', name: 'Founders Podcast', category: 'Entrepreneurship' },
    { channelId: 'HCnyfMqiRRG1u-2MsSQLbXA', name: 'Veritasium', category: 'Education' },
    { channelId: 'UCVls1GmFKf6WlTraIb_IaJg', name: 'Pursuit of Wonder', category: 'Education' },
    { channelId: 'UC0vBXGSyV14uvJ4hECDOl0Q', name: 'Techquickie', category: 'Tech' },
  ]

  const BRAND_BLOCKLIST = new Set([
    'minecraft', 'roblox', 'valorant', 'league of legends',
    'call of duty', 'apex legends', 'overwatch', 'counter-strike',
    'grand theft auto', 'gta', 'dead by daylight', 'dota', 'warzone',
    'youtube', 'google', 'twitter', 'instagram', 'facebook', 'tiktok',
    'twitch', 'discord', 'reddit', 'spotify', 'apple', 'netflix',
    'amazon', 'meta', 'whatsapp', 'snapchat', 'linkedin',
    'muscleworks gym', 'item shop',
    'unknown', 'unknown brand', 'n/a', 'na', 'none', 'brand',
    'sponsor', 'this brand', 'the brand', 'unnamed', 'unnamed brand',
  ])

function isBlockedBrand(name) {
  if (!name) return true
  const lower = name.toLowerCase().trim()
  if (BRAND_BLOCKLIST.has(lower)) return true
  if (lower.length < 2) return true
  return false
}

// ─── Normalised content format ─────────────────────────────
function makeContent(platform, externalId, creatorName, title, rawText, mediaUrl, publishedAt, contentType = 'video') {
  return { platform, externalId, creatorName, title, rawText, mediaUrl, publishedAt, contentType }
}

// ─── Utilities ─────────────────────────────────────────────
function isValidCode(code) {
    if (!code) return false
    if (code.length < 2 || code.length > 12) return false
    if (/[./\\]/.test(code)) return false
    if (/^[0-9]+$/.test(code)) return false
    if (code.length === 11 && /^[a-zA-Z0-9_-]+$/.test(code)) return false
    const junk = new Set([
        'FREE', 'CLICK', 'DOWNLOAD', 'WATCH', 'LINK', 'PBS', 'HTTPS',
        'MORE', 'HERE', 'NOW', 'SHOP', 'CODE', 'WAN', 'GET', 'USE',
        'NEW', 'OFF', 'THE', 'AND', 'FOR', 'YOU', 'ALL', 'SUBSCRIBE',
        'REVIEWS', 'PROMO', 'DEAL', 'SAVE', 'LTT', 'HTTP', 'WWW',
        'BONUS', 'NON', 'STICKY', 'FIRST', 'BEST', 'TOP',
      ])
    if (junk.has(code.toUpperCase())) return false
    return true
  }
  
  // The AI sometimes returns a bare domain ("lexfridman.com/s/xyz") instead of
  // a full URL. Without a scheme, an <a href> resolves it as a relative path
  // on the current site instead of navigating out — this guarantees a scheme
  // or discards anything that isn't a plausible URL at all.
  function normalizeUrl(url) {
    if (!url) return null
    const trimmed = url.trim()
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(trimmed)) return `https://${trimmed}`
    return null
  }

function computeDAR(s) {
  let score = 50
  if (s.confidence >= 0.95) score += 15
  else if (s.confidence >= 0.90) score += 10
  else if (s.confidence >= 0.85) score += 5
  if (s.exact_quote?.length > 20) score += 10
  if (s.promo_code) score += 10
  if (s.offer_text) score += 5
  if (s.promo_url) score += 5
  if (s.sponsorship_type === 'mention') score -= 10
  if (s.is_organic) score += 5
  return Math.min(Math.max(score, 30), 80)
}

function makeSlug(name) {
  return name.toLowerCase()
    .replace(/[\s&']+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

function extractBrandUrl(description, brandName) {
  if (!description || !brandName) return null
  const brandLower = brandName.toLowerCase().replace(/\s+/g, '')
  const urlPattern = /https?:\/\/(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})(?:\/[a-zA-Z0-9\-_./]*)?/g
  const skip = new Set([
    'youtube.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com',
    'facebook.com', 'linkedin.com', 'spotify.com', 'apple.com', 'google.com',
    'bit.ly', 'linktr.ee', 'amzn.to', 'patreon.com', 'discord.gg', 'twitch.tv',
  ])
  let match
  while ((match = urlPattern.exec(description)) !== null) {
    const domain = match[1].toLowerCase()
    if (skip.has(domain)) continue
    if (domain.includes(brandLower.slice(0, 5))) return `https://${domain}`
  }
  return null
}

function cleanQuote(quote) {
  if (!quote) return null
  return quote.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, 200) || null
}

function timeAgo(ms) {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

// ─── Headline generation ───────────────────────────────────
async function generateHeadline(brand, creatorName, sponsorshipType, offerText, promoCode, exactQuote, platform) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You write punchy editorial headlines for a creator deal intelligence feed.

Rules:
- Max 12 words
- Write like a journalist, not an advertiser
- Third person — describe what is happening, never say "sign up", "get", "unlock", "grab"
- Be specific — mention numbers, names, actual offers when available
- No exclamation marks ever
- No quotes around the headline
- Never start with "Discover" or "Unlock"

Good examples:
Thomas Frank has been pushing Skillshare for 3 years straight
Audible giving away free audiobooks through creator codes right now
Brilliant cutting 20% for the next 200 signups via Veritasium
Trading 212 offering £100 in free shares through UK creators

Return ONLY the headline text. No quotes. No exclamation marks.`
        },
        {
          role: 'user',
          content: `Brand: ${brand}
Creator: ${creatorName}
Platform: ${platform}
Type: ${sponsorshipType}
Offer: ${offerText || 'none'}
Code: ${promoCode || 'none'}
Quote: ${exactQuote?.slice(0, 150) || 'none'}`
        }
      ],
      temperature: 0.7,
      max_tokens: 50,
    })
    return completion.choices[0].message.content?.trim().replace(/^["']|["']$/g, '').replace(/!+/g, '') || null
  } catch { return null }
}

// ─── AI extraction ─────────────────────────────────────────
async function extractFromContent(content) {
  if (!content.rawText || content.rawText.length < 40) return []
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a multilingual sponsorship extraction engine. Extract brand sponsorships AND genuine organic product recommendations from creator content in ANY language.

          First detect the language. Then extract accordingly — sponsorship patterns differ by language and culture:
          - English: "use code X", "sponsored by", "I personally use", "link in description"
          - Hindi: "इस्तेमाल करें" (use), "sponsored", "discount code", "link bio mein hai"
          - Japanese: "コード" (code), "スポンサー" (sponsor), "使っています" (I use), "おすすめ" (recommend)
          - Other languages: look for brand names + discount indicators + personal recommendation language
          
         Return ONLY a JSON array. Each item:
          {
            "brand": "Clean brand name in English where possible",
            "sponsorship_type": "code"|"url"|"offer"|"mention",
            "promo_code": "2-12 char alphanumeric OR null",
            "promo_url": "custom tracking URL OR null",
            "offer_text": "deal description in English OR null",
            "exact_quote": "exact sentence mentioning brand max 200 chars NO URLs OR null",
            "confidence": 0.85-1.0,
            "is_organic": true|false,
            "detected_language": "en"|"hi"|"ja"|"es"|"fr"|"other",
            "brand_category": "Tech"|"Finance"|"Health"|"Lifestyle"|"Education"|"Gaming"|"Beauty"|"Food"|null
          }

          brand_category: classify what the BRAND/PRODUCT itself actually is — a supplement company is "Health" even if it's advertised on a finance podcast. A budgeting app is "Finance" even if a gaming streamer reads the ad. Judge the product, never the show or creator it appears on. Use null only if genuinely unclear from the text.
          
          is_organic = true when creator expresses genuine personal use WITHOUT payment language — in ANY language. Look for: personal pronouns + product name + positive sentiment + no code/affiliate language.

          is_organic = false when there is a code, affiliate link, "sponsored by" or equivalent in any language.
          
          promo_code: 2-12 chars only. NOT video IDs, generic words, URLs.
          exact_quote: Remove URLs. Keep readable. Translate to English if non-English.
          
          IGNORE: YouTube, Google, Instagram, Twitter, TikTok, Facebook, Spotify, Netflix, Amazon, Meta.
          IGNORE video games as brands: Fortnite, Minecraft, Valorant, Roblox, GTA, Apex, Overwatch, CS, Dead by Daylight, Dota, Warzone, Elden Ring, Marvel Rivals, Hearthstone, Diablo.
          
          Return [] if nothing found. ONLY valid JSON array.`
        },
        {
          role: 'user',
          content: `Platform: ${content.platform}
Creator: ${content.creatorName}
Title: "${content.title}"
Content type: ${content.contentType}

Text:
${content.rawText.slice(0, 3000)}`
        }
      ],
      temperature: 0.05,
      max_tokens: 800,
    })
    const raw = completion.choices[0].message.content?.trim() || '[]'
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
    if (!Array.isArray(parsed)) return []
    const VALID_CATEGORIES = new Set(['Tech', 'Finance', 'Health', 'Lifestyle', 'Education', 'Gaming', 'Beauty', 'Food'])
    return parsed
      .filter(s => s.confidence >= 0.85 && s.brand?.length > 1 && !isBlockedBrand(s.brand))
      .map(s => ({
        ...s,
        promo_code: isValidCode(s.promo_code) ? s.promo_code.toUpperCase() : null,
        exact_quote: cleanQuote(s.exact_quote),
        offer_text: s.offer_text?.slice(0, 100) || null,
        brand_category: VALID_CATEGORIES.has(s.brand_category) ? s.brand_category : null,
        dar_score: computeDAR(s),
        dar_source: 'ai_extracted',
      }))
  } catch { return [] }
}

// ─── Database write ────────────────────────────────────────
async function saveToDatabase(content, sponsors, creatorId) {
    let saved = 0
    const { data: creatorRow } = await supabase
      .from('creators')
      .select('category')
      .eq('id', creatorId)
      .single()
  
    for (const s of sponsors) {
      if (isBlockedBrand(s.brand)) continue
  
      const { data: brandData } = await supabase
        .from('brands')
        .upsert({ name: s.brand, slug: makeSlug(s.brand) }, { onConflict: 'slug' })
        .select().single()
      if (!brandData) continue
  
      // Primary: the AI classified what the product actually is, at extraction time.
      // Fallback: if the AI couldn't tell, borrow the creator's category as a rough guess —
      // the periodic majority-vote backfill corrects that guess later using real agreement.
      // Never touch a brand that's been manually corrected (category_manual = true).
      const categoryGuess = s.brand_category || creatorRow?.category || null
      if (!brandData.category_group && categoryGuess) {
        await supabase.from('brands')
          .update({ category_group: categoryGuess })
          .eq('id', brandData.id)
          .is('category_group', null)
          .eq('category_manual', false)
      }
  
      const brandUrl = extractBrandUrl(content.rawText, s.brand)
    if (brandUrl) {
      await supabase.from('brands')
        .update({ website_url: brandUrl })
        .eq('id', brandData.id)
        .is('website_url', null)
    }

    const headline = await generateHeadline(
      s.brand, content.creatorName, s.sponsorship_type,
      s.offer_text, s.promo_code, s.exact_quote, content.platform
    )

    const { error } = await supabase
      .from('sponsorships')
      .upsert({
        creator_id: creatorId,
        brand_id: brandData.id,
        promo_code: s.promo_code,
        promo_url: normalizeUrl(s.promo_url),
        content_url: normalizeUrl(content.mediaUrl),
        offer_text: s.offer_text,
        exact_quote: s.exact_quote,
        sponsorship_type: s.sponsorship_type,
        is_organic: s.is_organic || false,
        platform: content.platform,
        video_id: content.externalId,
        video_title: content.title,
        first_seen: content.publishedAt,
        last_seen: content.publishedAt,
        is_active: true,
        dar_score: s.dar_score,
        dar_source: s.dar_source,
        headline,
      }, { onConflict: 'video_id,brand_id' })

    if (!error) {
      saved++
      const dar = s.dar_score >= 70 ? '🟢' : '🟡'
      const organic = s.is_organic ? ' 🌱' : ''
      const detail = s.promo_code || s.offer_text || s.sponsorship_type
      console.log(`    ${dar} [${content.platform}] ${s.brand} → ${detail}${organic}`)
      if (headline) console.log(`       📰 ${headline}`)
    }
  }
  return saved
}

// ═══════════════════════════════════════════════════════════
// TREND SEEDS — Layer 2
// ═══════════════════════════════════════════════════════════

async function getTrendingYouTubeTopics() {
    const topics = []
    try {
      const regions = ['GB', 'US']
      for (const region of regions) {
        const active = getActiveKey()
        if (!active || !useQuotaForKey(active.index, 5)) break
        const url = `https://www.googleapis.com/youtube/v3/videos?key=${active.key}&chart=mostPopular&regionCode=${region}&part=snippet&maxResults=50&videoCategoryId=0`
      const res = await fetch(url)
      const data = await res.json()
      if (data.error || !data.items?.length) continue
      for (const video of data.items) {
        const title = video.snippet?.title || ''
        const cleaned = title
          .replace(/[^\w\s]/g, ' ')
          .replace(/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by|from|vs|ft|feat|official|video|full|new|how|why|what|when|where|who|this|that|my|your|our|we|i|it|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|can|must)\b/gi, ' ')
          .replace(/\s+/g, ' ').trim()
        const words = cleaned.split(' ').filter(w => w.length > 3).slice(0, 3)
        if (words.length >= 1) topics.push(words.join(' '))
      }
      await new Promise(r => setTimeout(r, 200))
    }
    const unique = [...new Set(topics)].slice(0, 20)
    console.log(`  📈 YouTube trending: ${unique.length} topic seeds`)
    return unique
  } catch (err) {
    console.log(`  ✗ YouTube trending: ${err.message}`)
    return []
  }
}

async function getTrendingRedditTopics() {
  const topics = []
  const subs = ['popular', 'personalfinance', 'technology', 'fitness', 'productivity', 'investing']
  try {
    for (const sub of subs) {
      const res = await fetch(
        `https://www.reddit.com/r/${sub}/hot.json?limit=25`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } }
      )
      if (!res.ok) continue
      const data = await res.json()
      for (const post of (data?.data?.children || [])) {
        const title = post.data?.title || ''
        if (title.length < 10 || post.data?.score < 150) continue
        const cleaned = title
          .replace(/[^\w\s]/g, ' ')
          .replace(/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by|from|this|that|my|your|i|it|is|are|was|were)\b/gi, ' ')
          .replace(/\s+/g, ' ').trim()
        const words = cleaned.split(' ').filter(w => w.length > 4).slice(0, 3)
        if (words.length >= 2) topics.push(words.join(' '))
      }
      await new Promise(r => setTimeout(r, 300))
    }
    const unique = [...new Set(topics)].slice(0, 15)
    console.log(`  📈 Reddit trending: ${unique.length} topic seeds`)
    return unique
  } catch (err) {
    console.log(`  ✗ Reddit trending: ${err.message}`)
    return []
  }
}

async function getUserTrendSeeds() {
  try {
    const { data } = await supabase
      .from('search_trends')
      .select('query, count')
      .order('count', { ascending: false })
      .limit(20)
    const seeds = (data || []).filter(t => t.query?.length > 2 && t.count >= 2).map(t => t.query)
    if (seeds.length > 0) console.log(`  📈 User trends: ${seeds.length} seeds`)
    return seeds
  } catch { return [] }
}

async function getAllTrendSeeds() {
  console.log('\n🌊 Fetching trend seeds...')
  const [ytTopics, userTopics] = await Promise.all([
    getTrendingYouTubeTopics(),
    getUserTrendSeeds(),
  ])
  const redditTopics = []
  // Save new trends to search_trends for personalisation layer
  for (const topic of [...ytTopics, ...redditTopics]) {
    await supabase.from('search_trends')
      .upsert({ query: topic.toLowerCase(), count: 1 }, { onConflict: 'query' })
      .then(() => {})
  }
  const all = [...new Set([...ytTopics, ...redditTopics, ...userTopics])]
  console.log(`  ✅ Total: ${all.length} trend seeds (YT:${ytTopics.length} Reddit:${redditTopics.length} Users:${userTopics.length})`)
  return all
}

// ═══════════════════════════════════════════════════════════
// CONNECTOR 1 — YouTube (6 strategies + re-processing)
// ═══════════════════════════════════════════════════════════

async function getKnownChannelIds() {
  const { data } = await supabase.from('creators').select('channel_id').not('channel_id', 'is', null)
  return new Set((data || []).map(c => c.channel_id))
}

async function getYouTubeChannelStats(channelId) {
    const active = getActiveKey()
    if (!active || !useQuotaForKey(active.index, 5)) return null
    try {
      const url = `https://www.googleapis.com/youtube/v3/channels?key=${active.key}&id=${channelId}&part=snippet,statistics`
    const res = await fetch(url)
    const data = await res.json()
    const ch = data.items?.[0]
    if (!ch) return null
    return {
      name: ch.snippet.title,
      subscribers: parseInt(ch.statistics?.subscriberCount || '0'),
      viewCount: parseInt(ch.statistics?.viewCount || '0'),
      thumbnail: ch.snippet.thumbnails?.default?.url,
    }
  } catch { return null }
}

async function searchYouTubeChannels(query, max = 5) {
    const active = getActiveKey()
    if (!active || !useQuotaForKey(active.index, 100)) return []
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?key=${active.key}&q=${encodeURIComponent(query)}&type=channel&part=snippet&maxResults=${max}&order=relevance`
    const res = await fetch(url)
    const data = await res.json()
    if (data.error) return []
    return (data.items || []).map(i => ({ channelId: i.id?.channelId, name: i.snippet?.channelTitle })).filter(c => c.channelId)
  } catch { return [] }
}

// Strategy 1: Fixed category seeds
async function discoverByCategory() {
  const categories = [
    'personal finance', 'stock investing', 'crypto trading', 'real estate investing',
    'tech review', 'software tools', 'AI productivity', 'coding tutorial',
    'health wellness', 'fitness workout', 'nutrition diet', 'mental health',
    'productivity', 'self improvement', 'entrepreneurship', 'business strategy',
    'lifestyle vlog', 'travel', 'food recipe', 'fashion style', 'beauty makeup',
    'science education', 'history documentary', 'philosophy',
    'gaming review', 'car review', 'watch review', 'photography',
    'parenting', 'home improvement', 'language learning', 'book review',
  ]
  const channels = []
  for (const cat of categories) {
    if (totalQuotaUsed() > totalQuotaLimit() * 0.4) break // stop at 40% quota used
    const results = await searchYouTubeChannels(`${cat} channel`, 3)
    channels.push(...results)
    await new Promise(r => setTimeout(r, 150))
  }
  return channels
}

// Strategy 2: Popularity signals
async function discoverByPopularity() {
  const queries = [
    'top youtube creators million subscribers',
    'viral youtube channel sponsorship',
    'most subscribed youtube creator',
    'popular youtube creator brand deal',
    'youtube influencer product recommendation',
  ]
  const channels = []
  for (const q of queries) {
    if (totalQuotaUsed() > totalQuotaLimit() * 0.5) break
    const results = await searchYouTubeChannels(q, 4)
    channels.push(...results)
    await new Promise(r => setTimeout(r, 150))
  }
  return channels
}

// Strategy 3: Brand association
async function discoverByBrand() {
  const { data: brands } = await supabase
    .from('brands')
    .select('name, velocity_score')
    .order('velocity_score', { ascending: false, nullsFirst: false })
    .limit(15)
  const channels = []
  for (const brand of (brands || [])) {
    if (totalQuotaUsed() > totalQuotaLimit() * 0.6) break
    const results = await searchYouTubeChannels(`${brand.name} review sponsor`, 3)
    channels.push(...results)
    await new Promise(r => setTimeout(r, 150))
  }
  return channels
}

// Strategy 4: Related channel expansion
async function discoverByRelated(knownIds) {
  const { data: existingCreators } = await supabase
    .from('creators')
    .select('channel_id, name')
    .eq('platform', 'youtube')
    .not('channel_id', 'is', null)
    .limit(15)
  const channels = []
  for (const creator of (existingCreators || [])) {
    if (totalQuotaUsed() > totalQuotaLimit() * 0.65) break
    const results = await searchYouTubeChannels(`${creator.name} similar creator`, 3)
    channels.push(...results.filter(c => !knownIds.has(c.channelId)))
    await new Promise(r => setTimeout(r, 150))
  }
  return channels
}

// Strategy 5: Trend-based seeds
async function discoverByTrends(trendSeeds) {
  if (!trendSeeds.length) return []
  const channels = []
  for (const topic of trendSeeds.slice(0, 15)) {
    if (totalQuotaUsed() > totalQuotaLimit() * 0.7) break
    const results = await searchYouTubeChannels(`${topic} youtube creator`, 3)
    channels.push(...results)
    await new Promise(r => setTimeout(r, 150))
  }
  return channels
}

// Strategy 6: Gap fill for underserved categories
async function discoverByGapFill(knownIds) {
  try {
    const { data } = await supabase.from('creators').select('category').not('category', 'is', null)
    const counts = {}
    ;(data || []).forEach(c => { counts[c.category] = (counts[c.category] || 0) + 1 })
    const underserved = Object.entries(counts)
      .filter(([_, n]) => n < 8)
      .sort(([, a], [, b]) => a - b)
      .slice(0, 4)
      .map(([cat]) => cat)
    const channels = []
    for (const cat of underserved) {
        if (totalQuotaUsed() > totalQuotaLimit() * 0.75) break
      const results = await searchYouTubeChannels(`${cat} youtube creator`, 3)
      channels.push(...results.filter(c => !knownIds.has(c.channelId)))
      await new Promise(r => setTimeout(r, 150))
    }
    if (channels.length) console.log(`     ${channels.length} from gap fill (${underserved.join(', ')})`)
    return channels
  } catch { return [] }
}

async function getYouTubeVideos(channelId, max = VIDEOS_PER_CREATOR) {
    const half = Math.floor(max / 2)
    const videos = []
    const seen = new Set()
  
    // Half by recency — new deals and trends
    try {
      const active1 = getActiveKey()
      if (active1 && useQuotaForKey(active1.index, 100)) {
        const url = `https://www.googleapis.com/youtube/v3/search?key=${active1.key}&channelId=${channelId}&part=snippet&order=date&maxResults=50&type=video`
        const res = await fetch(url)
        const data = await res.json()
        if (!data.error && data.items?.length) {
          const ids = data.items.map(v => v.id?.videoId).filter(Boolean).slice(0, half)
          const active2 = getActiveKey()
          if (ids.length && active2 && useQuotaForKey(active2.index, ids.length)) {
            const det = await fetch(`https://www.googleapis.com/youtube/v3/videos?key=${active2.key}&id=${ids.join(',')}&part=snippet,statistics,contentDetails`)
            const detData = await det.json()
            for (const v of (detData.items || [])) {
              if (!seen.has(v.id)) { seen.add(v.id); videos.push(v) }
            }
          }
        }
      }
    } catch {}
  
    await new Promise(r => setTimeout(r, 200))
  
    // Half by view count — high-reach sponsorships
    try {
      const active3 = getActiveKey()
      if (active3 && useQuotaForKey(active3.index, 100)) {
        const url = `https://www.googleapis.com/youtube/v3/search?key=${active3.key}&channelId=${channelId}&part=snippet&order=viewCount&maxResults=50&type=video`
        const res = await fetch(url)
        const data = await res.json()
        if (!data.error && data.items?.length) {
          const ids = data.items.map(v => v.id?.videoId).filter(Boolean)
          const newIds = ids.filter(id => !seen.has(id)).slice(0, max - videos.length)
          const active4 = getActiveKey()
          if (newIds.length && active4 && useQuotaForKey(active4.index, newIds.length)) {
            const det = await fetch(`https://www.googleapis.com/youtube/v3/videos?key=${active4.key}&id=${newIds.join(',')}&part=snippet,statistics,contentDetails`)
            const detData = await det.json()
            for (const v of (detData.items || [])) {
              if (!seen.has(v.id)) { seen.add(v.id); videos.push(v) }
            }
          }
        }
      }
    } catch {}
  
    return videos.slice(0, max)
}

// ─── YouTube chapters ──────────────────────────────────────
function extractChapters(video) {
    try {
      const desc = video.snippet?.description || ''
      // Chapters appear as timestamps in description: "0:00 Intro\n5:30 AG1 sponsor"
      const lines = desc.split('\n')
      const chapterLines = lines.filter(l => /^\d+:\d+/.test(l.trim()))
      if (chapterLines.length < 2) return null
      return chapterLines.slice(0, 20).join('\n')
    } catch { return null }
  }
  
  // ─── YouTube comments ──────────────────────────────────────
  async function getVideoComments(videoId) {
    try {
      const active = getActiveKey()
      if (!active || !useQuotaForKey(active.index, 1)) return null
      const url = `https://www.googleapis.com/youtube/v3/commentThreads?key=${active.key}&videoId=${videoId}&part=snippet&maxResults=30&order=relevance`
      const res = await fetch(url)
      const data = await res.json()
      if (data.error || !data.items?.length) return null
      const comments = data.items
        .map(item => item.snippet?.topLevelComment?.snippet?.textDisplay || '')
        .filter(c => c.length > 10 && c.length < 300)
        .slice(0, 20)
        .join('\n')
      return comments || null
    } catch { return null }
  }
  
  // ─── YouTube transcript ────────────────────────────────────
  async function getVideoTranscript(videoId) {
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId)
      if (!transcript?.length) return null
      // Combine into readable text, max 3000 chars
      const text = transcript
        .map(t => t.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 3000)
      return text || null
    } catch { return null }
  }
  
  // ─── Build rich video context ──────────────────────────────
  async function buildVideoContext(video, creatorName) {
    const videoId = video.id
    const description = video.snippet?.description || ''
    const title = video.snippet?.title || ''
    const chapters = extractChapters(video)
  
    // Fetch comments and transcript in parallel
    const [comments, transcript] = await Promise.all([
      getVideoComments(videoId),
      getVideoTranscript(videoId),
    ])
  
    const parts = []
    parts.push(`TITLE: ${title}`)
    parts.push(`\nDESCRIPTION:\n${description.slice(0, 1500)}`)
    if (chapters) parts.push(`\nCHAPTERS:\n${chapters}`)
    if (transcript) parts.push(`\nTRANSCRIPT (partial):\n${transcript}`)
    if (comments) parts.push(`\nTOP COMMENTS:\n${comments}`)
  
    return parts.join('\n')
  }
  
  // ─── Process trending videos directly ─────────────────────
  async function processTrendingVideos(trendSeeds, sponsorships, knownIds) {
    console.log('  🔥 Processing trending videos directly...')
    let total = 0
    try {
      const regions = ['GB', 'US']
      for (const region of regions) {
        const active = getActiveKey()
        if (!active || !useQuotaForKey(active.index, 5)) break
        const url = `https://www.googleapis.com/youtube/v3/videos?key=${active.key}&chart=mostPopular&regionCode=${region}&part=snippet,statistics,contentDetails&maxResults=25&videoCategoryId=0`
        const res = await fetch(url)
        const data = await res.json()
        if (data.error || !data.items?.length) continue
  
        for (const video of data.items) {
          const channelId = video.snippet?.channelId
          if (!channelId) continue
  
          // Get or create creator
          let creatorId
          const { data: existing } = await supabase
            .from('creators')
            .select('id, name')
            .eq('channel_id', channelId)
            .single()
  
          if (existing) {
            creatorId = existing.id
          } else {
            const stats = await getYouTubeChannelStats(channelId)
            if (!stats || stats.subscribers < MIN_SUBSCRIBERS) continue
            const { data: newCreator } = await supabase
              .from('creators')
              .upsert({
                name: stats.name,
                slug: makeSlug(stats.name),
                channel_id: channelId,
                subscriber_count: stats.subscribers,
                avatar_url: stats.thumbnail,
                platform: 'youtube',
                last_scraped_at: new Date().toISOString(),
              }, { onConflict: 'channel_id' })
              .select().single()
            if (!newCreator) continue
            creatorId = newCreator.id
            knownIds.add(channelId)
          }
  
          const creatorName = video.snippet?.channelTitle || 'Unknown'
          const richContext = await buildVideoContext(video, creatorName)
          const content = makeContent(
            'youtube', video.id, creatorName,
            video.snippet?.title || '',
            richContext,
            `https://youtube.com/watch?v=${video.id}`,
            video.snippet?.publishedAt || new Date().toISOString()
          )
          const sponsors = await extractFromContent(content)
          total += await saveToDatabase(content, sponsors, creatorId)
          await new Promise(r => setTimeout(r, 200))
        }
        await new Promise(r => setTimeout(r, 300))
      }
    } catch (err) {
      console.log(`  ✗ Trending video processing: ${err.message}`)
    }
    console.log(`  ✓ Trending videos: ${total} sponsorships`)
    return total
  }

async function refreshSubscriberCounts() {
  console.log('  🔄 Refreshing subscriber counts (weekly)...')
  try {
    const { data: creators } = await supabase
      .from('creators')
      .select('id, channel_id, name')
      .eq('platform', 'youtube')
      .not('channel_id', 'is', null)
      .limit(30)
    let updated = 0
    for (const creator of (creators || [])) {
      if (creator.channel_id?.startsWith('twitch_')) continue
      if (totalQuotaUsed() > totalQuotaLimit() * 0.9) break
      const stats = await getYouTubeChannelStats(creator.channel_id)
      if (!stats) continue
      await supabase.from('creators')
        .update({ subscriber_count: stats.subscribers, avatar_url: stats.thumbnail })
        .eq('id', creator.id)
      updated++
      await new Promise(r => setTimeout(r, 200))
    }
    console.log(`  ✓ Updated ${updated} creator subscriber counts`)
  } catch (err) {
    console.log(`  ✗ Subscriber refresh failed: ${err.message}`)
  }
}

async function runYouTube(knownIds, maxCreators = MAX_CREATORS_PER_RUN, trendSeeds = []) {
  console.log('\n▶ YouTube connector starting...')
  console.log('  🔍 Running 6 discovery strategies...')

  const [byCategory, byPopularity, byBrand, byRelated, byTrends, byGapFill] = await Promise.all([
    discoverByCategory(),
    discoverByPopularity(),
    discoverByBrand(),
    discoverByRelated(knownIds),
    discoverByTrends(trendSeeds),
    discoverByGapFill(knownIds),
  ])

  const seen = new Set()
  const allCandidates = [...byCategory, ...byPopularity, ...byBrand, ...byRelated, ...byTrends, ...byGapFill]
    .filter(c => {
      if (!c.channelId || seen.has(c.channelId) || knownIds.has(c.channelId)) return false
      seen.add(c.channelId)
      return true
    })

  console.log(`  📋 ${allCandidates.length} unique candidates:`)
  console.log(`     ${byCategory.length} from categories`)
  console.log(`     ${byPopularity.length} from popularity`)
  console.log(`     ${byBrand.length} from brands`)
  console.log(`     ${byRelated.length} from related channels`)
  console.log(`     ${byTrends.length} from trend seeds`)
  console.log(`     ${byGapFill.length} from gap fill`)
  console.log(`  📊 Quota used so far: ~${totalQuotaUsed()} / ${totalQuotaLimit()} units`)

  let creators = 0
  let sponsorships = 0

  // Always process high-value podcast YouTube channels first
  console.log('  📺 Processing podcast YouTube channels...')
  for (const channel of PODCAST_YOUTUBE_CHANNELS) {
    if (totalQuotaUsed() > totalQuotaLimit() * 0.5) break
    const { data: existingCreator } = await supabase
      .from('creators')
      .select('id, name')
      .eq('channel_id', channel.channelId)
      .single()

    if (existingCreator) {
      const videos = await getYouTubeVideos(channel.channelId, 10)
      for (const video of videos) {
        const richContext = await buildVideoContext(video, existingCreator.name)
        const content = makeContent(
          'youtube', video.id, existingCreator.name,
          video.snippet?.title || '',
          richContext,
          `https://youtube.com/watch?v=${video.id}`,
          video.snippet?.publishedAt || new Date().toISOString()
        )
        const sponsors = await extractFromContent(content)
        sponsorships += await saveToDatabase(content, sponsors, existingCreator.id)
        await new Promise(r => setTimeout(r, 150))
      }
    } else {
      const stats = await getYouTubeChannelStats(channel.channelId)
      if (!stats) continue
      knownIds.add(channel.channelId)
      creators++
      const { data: creatorData } = await supabase
        .from('creators')
        .upsert({
          name: stats.name || channel.name,
          slug: makeSlug(stats.name || channel.name),
          channel_id: channel.channelId,
          subscriber_count: stats.subscribers,
          avatar_url: stats.thumbnail,
          platform: 'youtube',
          category: channel.category,
          last_scraped_at: new Date().toISOString(),
        }, { onConflict: 'channel_id' })
        .select().single()
      if (!creatorData) continue
      console.log(`  📺 Added podcast channel: ${channel.name}`)
      const videos = await getYouTubeVideos(channel.channelId, 20)
      for (const video of videos) {
        const richContext = await buildVideoContext(video, channel.name)
        const content = makeContent(
          'youtube', video.id, channel.name,
          video.snippet?.title || '',
          richContext,
          `https://youtube.com/watch?v=${video.id}`,
          video.snippet?.publishedAt || new Date().toISOString()
        )
        const sponsors = await extractFromContent(content)
        sponsorships += await saveToDatabase(content, sponsors, creatorData.id)
        await new Promise(r => setTimeout(r, 150))
      }
    }
    await new Promise(r => setTimeout(r, 400))
  }

  // Process new creators
  for (const candidate of allCandidates) {
    if (creators >= maxCreators) break
    if (!candidate.channelId || knownIds.has(candidate.channelId)) continue
    if (totalQuotaUsed() > totalQuotaLimit() * 0.8) {
      console.log(`  ⚠️  Quota limit approaching — stopping new creator discovery`)
      break
    }

    const stats = await getYouTubeChannelStats(candidate.channelId)
    if (!stats || stats.subscribers < MIN_SUBSCRIBERS) continue

    const viewsPerSub = stats.viewCount / Math.max(stats.subscribers, 1)
    const isHighEngagement = viewsPerSub > 50

    knownIds.add(candidate.channelId)
    creators++

    const { data: creatorData } = await supabase
      .from('creators')
      .upsert({
        name: stats.name,
        slug: makeSlug(stats.name),
        channel_id: candidate.channelId,
        subscriber_count: stats.subscribers,
        avatar_url: stats.thumbnail,
        platform: 'youtube',
        last_scraped_at: new Date().toISOString(),
      }, { onConflict: 'channel_id' })
      .select().single()

    if (!creatorData) continue
    console.log(`  👤 ${stats.name} (${(stats.subscribers / 1000000).toFixed(1)}M)${isHighEngagement ? ' ⚡' : ''}`)

    const videos = await getYouTubeVideos(candidate.channelId, VIDEOS_PER_CREATOR)
    for (const video of videos) {
        const richContext = await buildVideoContext(video, stats.name)
        const content = makeContent(
          'youtube', video.id, stats.name,
          video.snippet?.title || '',
          richContext,
          `https://youtube.com/watch?v=${video.id}`,
          video.snippet?.publishedAt || new Date().toISOString()
        )
      const sponsors = await extractFromContent(content)
      sponsorships += await saveToDatabase(content, sponsors, creatorData.id)
      await new Promise(r => setTimeout(r, 150))
    }
    await new Promise(r => setTimeout(r, 400))
  }

  // Re-process existing creators to catch new videos
  // Ordered by least recently scraped — null first
  const { data: existingToRefresh } = await supabase
    .from('creators')
    .select('id, channel_id, name')
    .eq('platform', 'youtube')
    .not('channel_id', 'is', null)
    .order('last_scraped_at', { ascending: true, nullsFirst: true })
    .limit(20)

  console.log(`  🔄 Re-processing ${(existingToRefresh || []).length} existing creators for new content...`)
  for (const creator of (existingToRefresh || [])) {
    if (creator.channel_id?.startsWith('twitch_')) continue
    if (totalQuotaUsed() > totalQuotaLimit() * 0.92) {
      console.log(`  ⚠️  Quota limit approaching — stopping re-processing`)
      break
    }
    const videos = await getYouTubeVideos(creator.channel_id, 15)
    for (const video of videos) {
        const richContext = await buildVideoContext(video, creator.name)
        const content = makeContent(
          'youtube', video.id, creator.name,
          video.snippet?.title || '',
          richContext,
          `https://youtube.com/watch?v=${video.id}`,
          video.snippet?.publishedAt || new Date().toISOString()
        )
      const sponsors = await extractFromContent(content)
      sponsorships += await saveToDatabase(content, sponsors, creator.id)
      await new Promise(r => setTimeout(r, 150))
    }
    await supabase.from('creators')
      .update({ last_scraped_at: new Date().toISOString() })
      .eq('id', creator.id)
    await new Promise(r => setTimeout(r, 300))
  }

  // Refresh subscriber counts on Mondays
  // Process trending videos directly for immediate signal
  sponsorships += await processTrendingVideos(trendSeeds, sponsorships, knownIds)

  // Refresh subscriber counts on Mondays
  if (new Date().getDay() === 1) {
    await refreshSubscriberCounts()
  }

  console.log(`  ✓ YouTube: ${creators} new creators, ${sponsorships} sponsorships`)
  return sponsorships
}

// ═══════════════════════════════════════════════════════════
// CONNECTOR 2 — Podcasts
// ═══════════════════════════════════════════════════════════

const PODCAST_SEEDS = [
  'entrepreneurship', 'personal finance', 'productivity', 'health wellness',
  'technology', 'investing', 'education', 'comedy', 'true crime', 'fitness',
  'mental health', 'marketing', 'leadership', 'crypto', 'real estate',
  'self improvement', 'science', 'history', 'sports', 'food',
  'business', 'interview', 'news', 'storytelling', 'philosophy',
]

const BOOTSTRAP_PODCASTS = [
    { name: 'The Tim Ferriss Show', rss: 'https://rss.art19.com/tim-ferriss-show', category: 'Lifestyle' },
    { name: 'Huberman Lab', rss: 'https://feeds.megaphone.fm/hubermanlab', category: 'Health' },
    { name: 'My First Million', rss: 'https://feeds.megaphone.fm/HS2300184645', category: 'Finance' },
    { name: 'Diary of a CEO', rss: 'https://rss2.flightcast.com/xmsftuzjjykcmqwolaqn6mdn', category: 'Entrepreneurship' },
    { name: 'Modern Wisdom', rss: 'https://feeds.megaphone.fm/SIXMSB5088139739', category: 'Lifestyle' },
    { name: 'All-In Podcast', rss: 'https://rss.libsyn.com/shows/254861/destinations/1928300.xml', category: 'Tech' },
    { name: 'Acquired', rss: 'https://feeds.transistor.fm/acquired', category: 'Finance' },
    { name: 'How I Built This', rss: 'https://rss.art19.com/how-i-built-this', category: 'Entrepreneurship' },
    { name: 'Darknet Diaries', rss: 'https://feeds.megaphone.fm/darknetdiaries', category: 'Tech' },
    { name: 'Crime Junkie', rss: 'https://feeds.simplecast.com/qm_9xx0g', category: 'True Crime' },
    { name: 'The Knowledge Project', rss: 'https://feeds.megaphone.fm/FSMI7575968096', category: 'Productivity' },
    { name: 'Lex Fridman Podcast', rss: 'https://lexfridman.com/feed/podcast/', category: 'Tech' },
    { name: 'Founders Podcast', rss: 'https://feeds.megaphone.fm/DSLLC6297708582', category: 'Entrepreneurship' },
    { name: 'Planet Money', rss: 'https://feeds.npr.org/510289/podcast.xml', category: 'Finance' },
    { name: 'Freakonomics Radio', rss: 'https://feeds.simplecast.com/Y8lFbOT4', category: 'Education' },
    { name: 'SmartLess', rss: 'https://feeds.simplecast.com/hNaFxXpO', category: 'Comedy' },
    { name: 'Armchair Expert', rss: 'https://rss.art19.com/armchair-expert', category: 'Lifestyle' },
    { name: 'The Daily', rss: 'https://feeds.simplecast.com/54nAGcIl', category: 'News' },
    // 'Contrarian Thinking' removed — genuinely unfindable on Apple Podcasts under
    // that title after two independent lookups (one wrongly matched a different
    // show called "POWERS"). Needs manual research before re-adding — see notes.
    { name: 'The Game w/ Alex Hormozi', rss: 'https://rss2.flightcast.com/zz5nwp81tktx53wb8fw6qq7j.xml', category: 'Entrepreneurship' },
  ]

async function discoverPodcasts(maxNew = 50) {
  const { data: existing } = await supabase.from('creators').select('name').eq('platform', 'podcast')
  const known = new Set((existing || []).map(c => c.name.toLowerCase()))
  const discovered = [...BOOTSTRAP_PODCASTS.filter(p => !known.has(p.name.toLowerCase()))]

  for (const term of PODCAST_SEEDS) {
    if (discovered.length >= maxNew) break
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=podcast&limit=8&country=us`
      const res = await fetch(url, { headers: { 'User-Agent': 'ThatsTheOne/1.0' } })
      const data = await res.json()
      for (const pod of (data.results || [])) {
        if (!pod.feedUrl) continue
        if (known.has(pod.trackName?.toLowerCase())) continue
        if (discovered.find(d => d.name === pod.trackName)) continue
        if ((pod.trackCount || 0) < 5) continue
        discovered.push({ name: pod.trackName, rss: pod.feedUrl, category: pod.primaryGenreName || 'General' })
        known.add(pod.trackName?.toLowerCase())
      }
      await new Promise(r => setTimeout(r, 200))
    } catch {}
  }

  console.log(`  📋 ${discovered.length} podcasts to process`)
  return discovered
}

async function parsePodcastRSS(podcast) {
  try {
    const res = await fetch(podcast.rss, { headers: { 'User-Agent': 'ThatsTheOne/1.0 (+https://thatsthe.one)' } })
    if (!res.ok) return []
    const xml = await res.text()
    const items = []
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)
    for (const match of itemMatches) {
      const item = match[1]
      const title = (
        item.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] ||
        item.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ||
        ''
      )
      const desc = (
        item.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/)?.[1] ||
        item.match(/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ||
        item.match(/<description[^>]*>([\s\S]*?)<\/description>/)?.[1] ||
        ''
      )
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''
      const link = item.match(/<link>(.*?)<\/link>/)?.[1] || ''
      const guid = item.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] || link || title
      if (title && desc) {
        const cleanDesc = desc
          .replace(/<[^>]*>/g, ' ')
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ').trim()
        items.push({ title, description: cleanDesc, pubDate, link, guid })
      }
      if (items.length >= 20) break
    }
    console.log(`    📄 ${items.length} episodes parsed, avg desc length: ${items.length ? Math.round(items.reduce((a,i) => a + i.description.length, 0) / items.length) : 0} chars`)
    return items
  } catch { return [] }
}

async function runPodcasts() {
    console.log('\n🎙 Podcast connector starting...')
    
    // Sync RSS URLs from the bootstrap list — code is the source of truth,
    // so a corrected URL here always overwrites whatever's stored, instead
    // of silently skipping rows that already have a (possibly stale) value
    for (const podcast of BOOTSTRAP_PODCASTS) {
        await supabase.from('creators')
          .update({ rss_url: podcast.rss })
          .eq('slug', makeSlug(podcast.name))
      }
  
    const newPodcasts = await discoverPodcasts(50)
    let total = 0
  
    // Process newly discovered podcasts
    for (const podcast of newPodcasts) {
        const { data: creatorData } = await supabase
          .from('creators')
          .upsert({ name: podcast.name, slug: makeSlug(podcast.name), category: podcast.category, platform: 'podcast', rss_url: podcast.rss || podcast.url }, { onConflict: 'slug' })
          .select().single()
      if (!creatorData) continue
  
      console.log(`  🎙 ${podcast.name}`)
      const episodes = await parsePodcastRSS(podcast)
  
      for (const ep of episodes) {
        const content = makeContent(
          'podcast', ep.guid.slice(0, 200), podcast.name,
          ep.title, `${ep.title}\n\n${ep.description}`, ep.link,
          ep.pubDate ? new Date(ep.pubDate).toISOString() : new Date().toISOString(), 'audio'
        )
        const sponsors = await extractFromContent(content)
        total += await saveToDatabase(content, sponsors, creatorData.id)
        await new Promise(r => setTimeout(r, 200))
      }
      await new Promise(r => setTimeout(r, 300))
    }
  
    // Re-process existing podcasts for new episodes — same pattern as YouTube
    const { data: existingPodcasts } = await supabase
    .from('creators')
    .select('id, name, slug, rss_url')
    .eq('platform', 'podcast')
    .not('rss_url', 'is', null)
    .order('last_scraped_at', { ascending: true, nullsFirst: true })
    .limit(30)

  console.log(`  🔄 Re-processing ${(existingPodcasts || []).length} existing podcasts for new episodes...`)

  for (const creator of (existingPodcasts || [])) {
    const rss = creator.rss_url
    if (!rss) continue
  
      console.log(`  🎙 ${creator.name} (refresh)`)
      const episodes = await parsePodcastRSS({ rss })
  
      for (const ep of episodes) {
        const content = makeContent(
          'podcast', ep.guid.slice(0, 200), creator.name,
          ep.title, `${ep.title}\n\n${ep.description}`, ep.link,
          ep.pubDate ? new Date(ep.pubDate).toISOString() : new Date().toISOString(), 'audio'
        )
        const sponsors = await extractFromContent(content)
        total += await saveToDatabase(content, sponsors, creator.id)
        await new Promise(r => setTimeout(r, 200))
      }
  
      await supabase.from('creators')
        .update({ last_scraped_at: new Date().toISOString() })
        .eq('id', creator.id)
      await new Promise(r => setTimeout(r, 300))
    }
  
    console.log(`  ✓ Podcasts: ${total} sponsorships`)
    return total
  }

// ═══════════════════════════════════════════════════════════
// CONNECTOR 3 — Reddit
// ═══════════════════════════════════════════════════════════

const REDDIT_BOOTSTRAP = [
  { sub: 'personalfinance', category: 'Finance' },
  { sub: 'Entrepreneur', category: 'Entrepreneurship' },
  { sub: 'productivity', category: 'Productivity' },
  { sub: 'fitness', category: 'Fitness' },
  { sub: 'technology', category: 'Tech' },
  { sub: 'investing', category: 'Finance' },
  { sub: 'startups', category: 'Entrepreneurship' },
  { sub: 'nutrition', category: 'Health' },
  { sub: 'biohackers', category: 'Health' },
  { sub: 'digitalnomad', category: 'Lifestyle' },
  { sub: 'coffee', category: 'Lifestyle' },
  { sub: 'audiophile', category: 'Tech' },
  { sub: 'running', category: 'Fitness' },
  { sub: 'supplements', category: 'Health' },
  { sub: 'frugal', category: 'Finance' },
]

async function discoverSubreddits() {
  const known = new Set(REDDIT_BOOTSTRAP.map(s => s.sub.toLowerCase()))
  const discovered = [...REDDIT_BOOTSTRAP]

  const categorySearches = [
    'finance investing', 'technology software', 'health fitness',
    'entrepreneurship business', 'productivity self improvement',
    'food cooking', 'travel lifestyle', 'fashion beauty',
    'gaming esports', 'science education', 'crypto blockchain',
    'real estate', 'career jobs', 'sports fitness', 'photography',
  ]

  for (const category of categorySearches) {
    if (discovered.length >= 40) break
    try {
      const res = await fetch(
        `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(category)}&sort=relevance&limit=5`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } }
      )
      if (!res.ok) continue
      const data = await res.json()
      for (const sub of (data?.data?.children || [])) {
        const name = sub.data?.display_name
        if (!name || known.has(name.toLowerCase())) continue
        if ((sub.data?.subscribers || 0) < 50000) continue
        discovered.push({ sub: name, category: category.split(' ')[0] })
        known.add(name.toLowerCase())
      }
      await new Promise(r => setTimeout(r, 400))
    } catch {}
  }

  try {
    const res = await fetch(
      'https://www.reddit.com/subreddits/popular.json?limit=25',
      { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }}
    )
    if (res.ok) {
      const data = await res.json()
      for (const sub of (data?.data?.children || [])) {
        const name = sub.data?.display_name
        if (!name || known.has(name.toLowerCase())) continue
        if ((sub.data?.subscribers || 0) < 100000) continue
        discovered.push({ sub: name, category: 'General' })
        known.add(name.toLowerCase())
      }
    }
  } catch {}

  console.log(`  📋 ${discovered.length} subreddits to process`)
  return discovered
}

async function runReddit() {
  console.log('\n🔴 Reddit connector starting...')
  const subs = await discoverSubreddits()
  let total = 0

  for (const { sub, category } of subs) {
    try {
      const res = await fetch(
        `https://www.reddit.com/r/${sub}/hot.json?limit=25`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } }
      )
      if (!res.ok) continue
      const data = await res.json()
      const posts = data?.data?.children || []

      const { data: creatorData } = await supabase
        .from('creators')
        .upsert({ name: `r/${sub}`, slug: `reddit-${sub}`, category, platform: 'reddit' }, { onConflict: 'slug' })
        .select().single()
      if (!creatorData) continue

      console.log(`  🔴 r/${sub}`)
      for (const post of posts) {
        const p = post.data
        if (!p.selftext || p.selftext.length < 200) continue
        if (p.score < 150) continue
        const content = makeContent(
          'reddit', p.id, `r/${sub}`,
          p.title, `${p.title}\n\n${p.selftext}`,
          `https://reddit.com${p.permalink}`,
          new Date(p.created_utc * 1000).toISOString(), 'post'
        )
        const sponsors = await extractFromContent(content)
        total += await saveToDatabase(content, sponsors, creatorData.id)
        await new Promise(r => setTimeout(r, 150))
      }
      await new Promise(r => setTimeout(r, 500))
    } catch (err) {
      console.log(`  ✗ r/${sub}: ${err.message}`)
    }
  }

  console.log(`  ✓ Reddit: ${total} sponsorships`)
  return total
}

// ═══════════════════════════════════════════════════════════
// CONNECTOR 4 — Newsletters
// ═══════════════════════════════════════════════════════════

const NEWSLETTER_BOOTSTRAP = [
  { name: "Lenny's Newsletter", url: 'https://www.lennysnewsletter.com/feed', category: 'Productivity' },
  { name: 'Not Boring', url: 'https://www.notboring.co/feed', category: 'Tech' },
  { name: 'TLDR Newsletter', url: 'https://tldr.tech/rss', category: 'Tech' },
  { name: 'The Hustle', url: 'https://thehustle.co/feed/', category: 'Entrepreneurship' },
  { name: 'Morning Brew', url: 'https://www.morningbrew.com/daily/feed', category: 'Finance' },
  { name: 'The Profile', url: 'https://theprofile.substack.com/feed', category: 'Lifestyle' },
  { name: 'Dense Discovery', url: 'https://densediscovery.com/feed', category: 'Lifestyle' },
  { name: 'Every Newsletter', url: 'https://every.to/feed', category: 'Tech' },
  { name: 'CB Insights Newsletter', url: 'https://www.cbinsights.com/research/feed/', category: 'Finance' },
  { name: 'Milk Road', url: 'https://milkroad.com/feed', category: 'Crypto' },
]

async function discoverNewsletters() {
  const { data: existing } = await supabase.from('creators').select('name').eq('platform', 'newsletter')
  const known = new Set((existing || []).map(c => c.name.toLowerCase()))
  const discovered = [...NEWSLETTER_BOOTSTRAP.filter(n => !known.has(n.name.toLowerCase()))]

  try {
    const res = await fetch('https://substack.com/api/v1/publication/best?page=0&limit=25', { headers: { 'User-Agent': 'ThatsTheOne/1.0' } })
    if (res.ok) {
      const data = await res.json()
      const pubs = data?.publications || data || []
      for (const pub of pubs) {
        const name = pub.name || pub.title
        const subdomain = pub.subdomain
        if (!name || !subdomain || known.has(name.toLowerCase())) continue
        discovered.push({ name, url: `https://${subdomain}.substack.com/feed`, category: pub.category_name || 'General' })
        known.add(name.toLowerCase())
      }
    }
  } catch {}

  console.log(`  📋 ${discovered.length} newsletters to process`)
  return discovered
}

async function runNewsletters() {
    console.log('\n📰 Newsletter connector starting...')
  
    // Backfill URL for existing newsletters missing it
    for (const nl of NEWSLETTER_BOOTSTRAP) {
      await supabase.from('creators')
        .update({ rss_url: nl.url })
        .eq('slug', makeSlug(nl.name))
        .is('rss_url', null)
    }
  
    const newsletters = await discoverNewsletters()
    let total = 0
  
    // Process new newsletters
    for (const nl of newsletters) {
      try {
        const res = await fetch(nl.url, { headers: { 'User-Agent': 'ThatsTheOne/1.0 (+https://thatsthe.one)' } })
        if (!res.ok) continue
        const xml = await res.text()
  
        const { data: creatorData } = await supabase
          .from('creators')
          .upsert({ name: nl.name, slug: makeSlug(nl.name), category: nl.category, platform: 'newsletter', rss_url: nl.url }, { onConflict: 'slug' })
          .select().single()
        if (!creatorData) continue
  
        console.log(`  📰 ${nl.name}`)
        const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 10)
  
        for (const match of itemMatches) {
          const item = match[1]
          const title = (
            item.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] ||
            item.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ||
            ''
          )
          const desc = (
            item.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/)?.[1] ||
            item.match(/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ||
            ''
          ).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
          const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''
          const link = item.match(/<link[^>]*>(.*?)<\/link>/)?.[1] || ''
          const guid = item.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] || title
          if (!title || desc.length < 100) continue
  
          const content = makeContent(
            'newsletter', guid.slice(0, 200), nl.name,
            title, `${title}\n\n${desc}`, link,
            pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(), 'article'
          )
          const sponsors = await extractFromContent(content)
          total += await saveToDatabase(content, sponsors, creatorData.id)
          await new Promise(r => setTimeout(r, 200))
        }
        await new Promise(r => setTimeout(r, 400))
      } catch (err) {
        console.log(`  ✗ ${nl.name}: ${err.message}`)
      }
    }
  
    // Re-process existing newsletters for new issues
    const { data: existingNewsletters } = await supabase
      .from('creators')
      .select('id, name, rss_url')
      .eq('platform', 'newsletter')
      .not('rss_url', 'is', null)
      .order('last_scraped_at', { ascending: true, nullsFirst: true })
      .limit(20)
  
    console.log(`  🔄 Re-processing ${(existingNewsletters || []).length} existing newsletters...`)
  
    for (const creator of (existingNewsletters || [])) {
      if (!creator.rss_url) continue
      try {
        const res = await fetch(creator.rss_url, { headers: { 'User-Agent': 'ThatsTheOne/1.0 (+https://thatsthe.one)' } })
        if (!res.ok) continue
        const xml = await res.text()
        console.log(`  📰 ${creator.name} (refresh)`)
  
        const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 10)
        for (const match of itemMatches) {
          const item = match[1]
          const title = (
            item.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] ||
            item.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ||
            ''
          )
          const desc = (
            item.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/)?.[1] ||
            item.match(/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ||
            ''
          ).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
          const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''
          const link = item.match(/<link[^>]*>(.*?)<\/link>/)?.[1] || ''
          const guid = item.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] || title
          if (!title || desc.length < 100) continue
  
          const content = makeContent(
            'newsletter', guid.slice(0, 200), creator.name,
            title, `${title}\n\n${desc}`, link,
            pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(), 'article'
          )
          const sponsors = await extractFromContent(content)
          total += await saveToDatabase(content, sponsors, creator.id)
          await new Promise(r => setTimeout(r, 200))
        }
  
        await supabase.from('creators')
          .update({ last_scraped_at: new Date().toISOString() })
          .eq('id', creator.id)
        await new Promise(r => setTimeout(r, 400))
      } catch (err) {
        console.log(`  ✗ ${creator.name}: ${err.message}`)
      }
    }
  
    console.log(`  ✓ Newsletters: ${total} sponsorships`)
    return total
  }

// ═══════════════════════════════════════════════════════════
// CONNECTOR 5 — Twitch
// ═══════════════════════════════════════════════════════════

async function getTwitchToken() {
  try {
    const res = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
      { method: 'POST' }
    )
    const data = await res.json()
    return data.access_token
  } catch { return null }
}

async function runTwitch() {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || TWITCH_CLIENT_SECRET === 'pending') {
    console.log('\n🎮 Twitch skipped — no credentials')
    return 0
  }

  console.log('\n🎮 Twitch connector starting...')
  const token = await getTwitchToken()
  if (!token) { console.log('  ✗ Could not get Twitch token'); return 0 }

  const headers = { 'Client-ID': TWITCH_CLIENT_ID, 'Authorization': `Bearer ${token}` }
  let total = 0

  try {
    const gamesRes = await fetch('https://api.twitch.tv/helix/games/top?first=15', { headers })
    const gamesData = await gamesRes.json()
    const games = gamesData.data || []

    for (const game of games) {
      const streamsRes = await fetch(`https://api.twitch.tv/helix/streams?game_id=${game.id}&first=8`, { headers })
      const streamsData = await streamsRes.json()
      const streams = streamsData.data || []

      for (const stream of streams) {
        const userRes = await fetch(`https://api.twitch.tv/helix/users?id=${stream.user_id}`, { headers })
        const userData = await userRes.json()
        const user = userData.data?.[0]
        if (!user) continue

        const channelRes = await fetch(`https://api.twitch.tv/helix/channels?broadcaster_id=${stream.user_id}`, { headers })
        const channelData = await channelRes.json()
        const channel = channelData.data?.[0]

        const text = [stream.title, channel?.title || '', user.description || '', game.name].join('\n').trim()
        if (text.length < 30) continue

        const { data: creatorData } = await supabase
          .from('creators')
          .upsert({
            name: stream.user_name,
            slug: makeSlug(stream.user_name),
            channel_id: `twitch_${stream.user_id}`,
            category: game.name,
            platform: 'twitch',
          }, { onConflict: 'channel_id' })
          .select().single()
        if (!creatorData) continue

        const content = makeContent(
          'twitch', `twitch_${stream.id}`, stream.user_name,
          stream.title, text, `https://twitch.tv/${stream.user_login}`,
          new Date().toISOString(), 'stream'
        )

        console.log(`  🎮 ${stream.user_name} (${game.name})`)
        const sponsors = await extractFromContent(content)
        total += await saveToDatabase(content, sponsors, creatorData.id)
        await new Promise(r => setTimeout(r, 300))
      }
      await new Promise(r => setTimeout(r, 400))
    }
  } catch (err) {
    console.log(`  ✗ Twitch error: ${err.message}`)
  }

  console.log(`  ✓ Twitch: ${total} sponsorships`)
  return total
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════

async function run() {
  const start = Date.now()
  console.log(`\n${'═'.repeat(55)}`)
  console.log(`🚀 Unified pipeline — ${new Date().toISOString()}`)
  console.log(`   Sources: YouTube · Podcasts · Reddit · Newsletters · Twitch`)
  console.log(`   YouTube strategies: Category · Popularity · Brand · Related · Trends · Gap`)
  console.log(`${'═'.repeat(55)}`)

  const knownIds = await getKnownChannelIds()
  console.log(`📚 ${knownIds.size} creators already in database\n`)

  // Fetch trend seeds first
  const trendSeeds = await getAllTrendSeeds()

  const results = {
    youtube: await runYouTube(knownIds, MAX_CREATORS_PER_RUN, trendSeeds),
    podcasts: await runPodcasts(),
    reddit: 0,
    newsletters: await runNewsletters(),
    twitch: await runTwitch(),
  }

  // Update brand velocity scores
  await supabase.rpc('compute_brand_velocity').then(() => {
    console.log('\n📊 Brand velocity scores updated')
  }).catch(() => {})

  const total = Object.values(results).reduce((a, b) => a + b, 0)

  console.log(`\n${'═'.repeat(55)}`)
  console.log(`✅ Pipeline complete in ${timeAgo(Date.now() - start)}`)
  console.log(`   YouTube:     ${results.youtube} sponsorships`)
  console.log(`   Podcasts:    ${results.podcasts} sponsorships`)
  console.log(`   Reddit:      ${results.reddit} sponsorships`)
  console.log(`   Newsletters: ${results.newsletters} sponsorships`)
  console.log(`   Twitch:      ${results.twitch} sponsorships`)
  console.log(`   Total:       ${total} sponsorships`)
  console.log(`   YT Quota:    ~${totalQuotaUsed()} / ${totalQuotaLimit()} units used across ${YT_KEYS.length} keys`)
  console.log(`   Trend seeds: ${trendSeeds.length} active this run`)
  console.log(`${'═'.repeat(55)}`)
}

run().catch(console.error)