import OpenAI from 'openai'
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
const YT_KEY = process.env.YOUTUBE_API_KEY
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET

// ─── Normalised content format ────────────────────────────
function makeContent(platform, externalId, creatorName, title, rawText, mediaUrl, publishedAt, contentType = 'video') {
  return { platform, externalId, creatorName, title, rawText, mediaUrl, publishedAt, contentType }
}

// ─── Shared utilities ─────────────────────────────────────
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
  ])
  if (junk.has(code.toUpperCase())) return false
  return true
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
  return Math.min(Math.max(score, 30), 80)
}

function makeSlug(name) {
  return name.toLowerCase()
    .replace(/[\s&']+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

function timeAgo(ms) {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

// ─── AI extraction (shared by all sources) ────────────────
async function extractFromContent(content) {
  if (!content.rawText || content.rawText.length < 40) return []
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Extract genuine brand sponsorships and product recommendations from creator content.

Return ONLY a JSON array. Each item:
{
  "brand": "Clean brand name",
  "sponsorship_type": "code"|"url"|"offer"|"mention",
  "promo_code": "2-12 char alphanumeric OR null",
  "promo_url": "custom tracking URL OR null",
  "offer_text": "deal like '3 months free' OR null",
  "exact_quote": "exact sentence mentioning this brand, max 200 chars OR null",
  "confidence": 0.85-1.0,
  "is_organic": true|false
}

promo_code: 2-12 chars, letters+numbers only. NOT: video IDs, generic words (FREE/WATCH/CLICK/CODE/LINK/GET), URLs, brand names.
is_organic: true if creator genuinely recommends this without payment language.

NEVER include as brands:
- Video games (Fortnite, Minecraft, Valorant, GTA, etc)
- Social platforms (YouTube, TikTok, Instagram, Twitter, Reddit)
- Streaming services (Netflix, Spotify, Apple Music)
- Other creators or YouTubers
- Generic words (Item Shop, Battle Pass)
- The creator's own name or channel

For Reddit and community posts: focus on organic product recommendations where someone says "I use X and love it" or "X changed my life" — these are valuable even without a deal.

Only confidence 0.85+. Return [] if nothing found. ONLY valid JSON array.`
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
      max_tokens: 600,
    })
    const raw = completion.choices[0].message.content?.trim() || '[]'
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(s => s.confidence >= 0.85 && s.brand?.length > 1)
      .map(s => ({
        ...s,
        promo_code: isValidCode(s.promo_code) ? s.promo_code.toUpperCase() : null,
        exact_quote: s.exact_quote?.slice(0, 200) || null,
        offer_text: s.offer_text?.slice(0, 100) || null,
        dar_score: computeDAR(s),
        dar_source: 'ai_extracted',
      }))
  } catch { return [] }
}

// ─── Database write (shared by all sources) ───────────────
async function saveToDatabase(content, sponsors, creatorId) {
  let saved = 0
  for (const s of sponsors) {
    const { data: brandData } = await supabase
      .from('brands')
      .upsert({ name: s.brand, slug: makeSlug(s.brand) }, { onConflict: 'slug' })
      .select()
      .single()
    if (!brandData) continue
    const { error } = await supabase
      .from('sponsorships')
      .upsert({
        creator_id: creatorId,
        brand_id: brandData.id,
        promo_code: s.promo_code,
        promo_url: s.promo_url,
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
      }, { onConflict: 'video_id,brand_id' })
    if (!error) {
      saved++
      const dar = s.dar_score >= 70 ? '🟢' : '🟡'
      const detail = s.promo_code || s.offer_text || s.sponsorship_type
      console.log(`    ${dar} [${content.platform}] ${s.brand} → ${detail}${s.is_organic ? ' (organic)' : ''}`)
    }
  }
  return saved
}

// ═══════════════════════════════════════════════════════════
// CONNECTOR 1 — YouTube (dynamic discovery)
// ═══════════════════════════════════════════════════════════
async function getKnownChannelIds() {
  const { data } = await supabase.from('creators').select('channel_id').not('channel_id', 'is', null)
  return new Set((data || []).map(c => c.channel_id))
}

async function searchYouTubeCreators(query, max = 8) {
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?key=${YT_KEY}&q=${encodeURIComponent(query)}&type=channel&part=snippet&maxResults=${max}&order=relevance`
    const res = await fetch(url)
    const data = await res.json()
    if (data.error) return []
    return (data.items || []).map(i => ({ channelId: i.id?.channelId, name: i.snippet?.channelTitle })).filter(c => c.channelId)
  } catch { return [] }
}

async function getYouTubeChannelStats(channelId) {
  try {
    const url = `https://www.googleapis.com/youtube/v3/channels?key=${YT_KEY}&id=${channelId}&part=snippet,statistics`
    const res = await fetch(url)
    const data = await res.json()
    const ch = data.items?.[0]
    if (!ch) return null
    return {
      name: ch.snippet.title,
      subscribers: parseInt(ch.statistics?.subscriberCount || '0'),
      thumbnail: ch.snippet.thumbnails?.default?.url,
    }
  } catch { return null }
}

async function getYouTubeVideos(channelId, max = 20) {
  const videos = []
  let pageToken = null
  while (videos.length < max) {
    const url = `https://www.googleapis.com/youtube/v3/search?key=${YT_KEY}&channelId=${channelId}&part=snippet&order=date&maxResults=50&type=video${pageToken ? `&pageToken=${pageToken}` : ''}`
    const res = await fetch(url)
    const data = await res.json()
    if (data.error || !data.items?.length) break
    const ids = data.items.map(v => v.id?.videoId).filter(Boolean)
    if (!ids.length) break
    const det = await fetch(`https://www.googleapis.com/youtube/v3/videos?key=${YT_KEY}&id=${ids.join(',')}&part=snippet`)
    const detData = await det.json()
    videos.push(...(detData.items || []))
    pageToken = data.nextPageToken || null
    if (!pageToken || videos.length >= max) break
    await new Promise(r => setTimeout(r, 200))
  }
  return videos.slice(0, max)
}

async function getDynamicYouTubeSeeds() {
  const base = [
    'tech review', 'personal finance', 'productivity', 'health wellness',
    'fitness', 'self improvement', 'entrepreneurship', 'investing',
    'education science', 'gaming', 'AI technology', 'crypto',
    'career advice', 'mental health', 'real estate', 'cooking food',
    'travel vlog', 'fashion style', 'beauty', 'sports',
  ]
  const { data: trends } = await supabase
    .from('search_trends')
    .select('query')
    .order('count', { ascending: false })
    .limit(10)
  const { data: topBrands } = await supabase
    .from('brands')
    .select('name')
    .limit(10)
  const brandSeeds = (topBrands || []).map(b => `${b.name} sponsor youtube`)
  const trendSeeds = (trends || []).map(t => t.query)
  return [...base, ...trendSeeds, ...brandSeeds]
}

async function runYouTube(knownIds, maxCreators = 40) {
  console.log('\n▶ YouTube connector starting...')
  const seeds = await getDynamicYouTubeSeeds()
  console.log(`  📋 ${seeds.length} seeds (base + user trends + brand discovery)`)
  let creators = 0
  let sponsorships = 0

  for (const seed of seeds) {
    if (creators >= maxCreators) break
    const candidates = await searchYouTubeCreators(seed, 6)
    for (const c of candidates) {
      if (creators >= maxCreators || !c.channelId || knownIds.has(c.channelId)) continue
      const stats = await getYouTubeChannelStats(c.channelId)
      if (!stats || stats.subscribers < 50000) continue
      knownIds.add(c.channelId)
      creators++

      const { data: creatorData } = await supabase
        .from('creators')
        .upsert({
          name: stats.name,
          slug: makeSlug(stats.name),
          channel_id: c.channelId,
          subscriber_count: stats.subscribers,
          avatar_url: stats.thumbnail,
          platform: 'youtube',
        }, { onConflict: 'channel_id' })
        .select().single()

      if (!creatorData) continue
      console.log(`  👤 ${stats.name} (${(stats.subscribers / 1000000).toFixed(1)}M)`)

      const videos = await getYouTubeVideos(c.channelId, 20)
      for (const video of videos) {
        const content = makeContent(
          'youtube', video.id, stats.name,
          video.snippet?.title || '',
          video.snippet?.description || '',
          `https://youtube.com/watch?v=${video.id}`,
          video.snippet?.publishedAt || new Date().toISOString()
        )
        const sponsors = await extractFromContent(content)
        sponsorships += await saveToDatabase(content, sponsors, creatorData.id)
        await new Promise(r => setTimeout(r, 150))
      }
      await new Promise(r => setTimeout(r, 400))
    }
    await new Promise(r => setTimeout(r, 300))
  }
  console.log(`  ✓ YouTube: ${creators} creators, ${sponsorships} sponsorships`)
  return sponsorships
}

// ═══════════════════════════════════════════════════════════
// CONNECTOR 2 — Podcasts (dynamic via iTunes Search API)
// ═══════════════════════════════════════════════════════════
const PODCAST_SEEDS = [
  'entrepreneurship', 'personal finance', 'productivity', 'health wellness',
  'technology', 'investing', 'education', 'comedy', 'true crime', 'fitness',
  'mental health', 'marketing', 'leadership', 'crypto', 'real estate',
  'self improvement', 'science', 'history', 'sports', 'food',
]

const BOOTSTRAP_PODCASTS = [
  { name: 'The Tim Ferriss Show', rss: 'https://rss.art19.com/tim-ferriss-show', category: 'Lifestyle' },
  { name: 'Huberman Lab', rss: 'https://feeds.megaphone.fm/hubermanlab', category: 'Health' },
  { name: 'My First Million', rss: 'https://feeds.megaphone.fm/mfmpod', category: 'Finance' },
  { name: 'Diary of a CEO', rss: 'https://feeds.acast.com/public/shows/diary-of-a-ceo-with-steven-bartlett', category: 'Entrepreneurship' },
  { name: 'Modern Wisdom', rss: 'https://feeds.acast.com/public/shows/modern-wisdom', category: 'Lifestyle' },
  { name: 'All-In Podcast', rss: 'https://feeds.megaphone.fm/allinpodcast', category: 'Tech' },
  { name: 'Acquired', rss: 'https://acquired.fm/rss', category: 'Finance' },
  { name: 'How I Built This', rss: 'https://feeds.simplecast.com/GHHnXNFD', category: 'Entrepreneurship' },
  { name: 'Darknet Diaries', rss: 'https://feeds.megaphone.fm/darknetdiaries', category: 'Tech' },
  { name: 'Crime Junkie', rss: 'https://feeds.simplecast.com/qm_9xx0g', category: 'True Crime' },
  { name: 'The Knowledge Project', rss: 'https://feeds.simplecast.com/qN5oPkwB', category: 'Productivity' },
  { name: 'Lex Fridman Podcast', rss: 'https://lexfridman.com/feed/podcast/', category: 'Tech' },
  { name: 'Founders Podcast', rss: 'https://feeds.transistor.fm/founders', category: 'Entrepreneurship' },
  { name: 'Planet Money', rss: 'https://feeds.npr.org/510289/podcast.xml', category: 'Finance' },
  { name: 'Freakonomics Radio', rss: 'https://feeds.simplecast.com/Y8lFbOT4', category: 'Education' },
]

async function discoverPodcasts(maxNew = 40) {
  const { data: existing } = await supabase
    .from('creators')
    .select('name')
    .eq('platform', 'podcast')
  const known = new Set((existing || []).map(c => c.name.toLowerCase()))

  const discovered = [...BOOTSTRAP_PODCASTS.filter(p => !known.has(p.name.toLowerCase()))]

  const { data: trends } = await supabase
    .from('search_trends')
    .select('query')
    .order('count', { ascending: false })
    .limit(10)

  const searchTerms = [...PODCAST_SEEDS, ...(trends || []).map(t => t.query)]

  for (const term of searchTerms) {
    if (discovered.length >= maxNew) break
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=podcast&limit=5&country=us`
      const res = await fetch(url, { headers: { 'User-Agent': 'ThatsTheOne/1.0' } })
      const data = await res.json()
      for (const pod of (data.results || [])) {
        if (!pod.feedUrl) continue
        if (known.has(pod.trackName?.toLowerCase())) continue
        if (discovered.find(d => d.name === pod.trackName)) continue
        discovered.push({
          name: pod.trackName,
          rss: pod.feedUrl,
          category: pod.primaryGenreName || 'General',
        })
        known.add(pod.trackName?.toLowerCase())
      }
      await new Promise(r => setTimeout(r, 200))
    } catch {}
  }

  const bootstrapNew = BOOTSTRAP_PODCASTS.filter(p => !known.has(p.name.toLowerCase())).length
  console.log(`  📋 ${discovered.length} podcasts (${bootstrapNew} bootstrap + ${discovered.length - bootstrapNew} via iTunes)`)
  return discovered
}

async function parsePodcastRSS(podcast) {
  try {
    const res = await fetch(podcast.rss, {
      headers: { 'User-Agent': 'ThatsTheOne/1.0 (+https://thatsthe.one)' },
    })
    if (!res.ok) return []
    const xml = await res.text()
    const items = []
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)
    for (const match of itemMatches) {
      const item = match[1]
      const title = item.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>|<title[^>]*>(.*?)<\/title>/)?.[1] || ''
      const desc = item.match(/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description[^>]*>([\s\S]*?)<\/description>/)?.[1] || ''
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''
      const link = item.match(/<link>(.*?)<\/link>/)?.[1] || ''
      const guid = item.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] || link || title
      if (title && desc) {
        const cleanDesc = desc.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
        items.push({ title, description: cleanDesc, pubDate, link, guid })
      }
      if (items.length >= 15) break
    }
    return items
  } catch (err) {
    console.log(`    ✗ RSS error: ${err.message}`)
    return []
  }
}

async function runPodcasts() {
  console.log('\n🎙 Podcast connector starting...')
  const podcasts = await discoverPodcasts(40)
  let total = 0

  for (const podcast of podcasts) {
    const { data: creatorData } = await supabase
      .from('creators')
      .upsert({
        name: podcast.name,
        slug: makeSlug(podcast.name),
        category: podcast.category,
        platform: 'podcast',
      }, { onConflict: 'slug' })
      .select().single()

    if (!creatorData) continue
    console.log(`  🎙 ${podcast.name}`)

    const episodes = await parsePodcastRSS(podcast)
    for (const ep of episodes) {
      const content = makeContent(
        'podcast',
        ep.guid.slice(0, 200),
        podcast.name,
        ep.title,
        `${ep.title}\n\n${ep.description}`,
        ep.link,
        ep.pubDate ? new Date(ep.pubDate).toISOString() : new Date().toISOString(),
        'audio'
      )
      const sponsors = await extractFromContent(content)
      total += await saveToDatabase(content, sponsors, creatorData.id)
      await new Promise(r => setTimeout(r, 200))
    }
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`  ✓ Podcasts: ${total} sponsorships`)
  return total
}

// ═══════════════════════════════════════════════════════════
// CONNECTOR 3 — Reddit (dynamic subreddit discovery)
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

  const { data: trends } = await supabase
    .from('search_trends')
    .select('query')
    .order('count', { ascending: false })
    .limit(10)

  for (const trend of (trends || [])) {
    try {
      const res = await fetch(
        `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(trend.query)}&limit=3`,
        { headers: { 'User-Agent': 'ThatsTheOne/1.0 (+https://thatsthe.one)' } }
      )
      if (!res.ok) continue
      const data = await res.json()
      for (const sub of (data?.data?.children || [])) {
        const name = sub.data?.display_name
        if (!name || known.has(name.toLowerCase())) continue
        if ((sub.data?.subscribers || 0) < 10000) continue
        discovered.push({ sub: name, category: 'General' })
        known.add(name.toLowerCase())
      }
      await new Promise(r => setTimeout(r, 300))
    } catch {}
  }

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
        { headers: { 'User-Agent': 'ThatsTheOne/1.0 (+https://thatsthe.one)' } }
      )
      if (!res.ok) continue
      const data = await res.json()
      const posts = data?.data?.children || []

      const { data: creatorData } = await supabase
        .from('creators')
        .upsert({
          name: `r/${sub}`,
          slug: `reddit-${sub}`,
          category,
          platform: 'reddit',
        }, { onConflict: 'slug' })
        .select().single()

      if (!creatorData) continue
      console.log(`  🔴 r/${sub}`)

      for (const post of posts) {
        const p = post.data
        if (!p.selftext || p.selftext.length < 200) continue
        if (p.score < 100) continue
        const content = makeContent(
          'reddit', p.id, `r/${sub}`,
          p.title,
          `${p.title}\n\n${p.selftext}`,
          `https://reddit.com${p.permalink}`,
          new Date(p.created_utc * 1000).toISOString(),
          'post'
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
// CONNECTOR 4 — Newsletters (dynamic via RSS)
// ═══════════════════════════════════════════════════════════
const NEWSLETTER_BOOTSTRAP = [
  { name: 'Lenny\'s Newsletter', url: 'https://www.lennysnewsletter.com/feed', category: 'Productivity' },
  { name: 'Not Boring', url: 'https://www.notboring.co/feed', category: 'Tech' },
  { name: 'TLDR Newsletter', url: 'https://tldr.tech/rss', category: 'Tech' },
  { name: 'The Hustle', url: 'https://thehustle.co/feed/', category: 'Entrepreneurship' },
  { name: 'Morning Brew', url: 'https://www.morningbrew.com/daily/feed', category: 'Finance' },
  { name: 'The Profile', url: 'https://theprofile.substack.com/feed', category: 'Lifestyle' },
  { name: 'Dense Discovery', url: 'https://densediscovery.com/feed', category: 'Lifestyle' },
  { name: 'Stratechery', url: 'https://stratechery.com/feed', category: 'Tech' },
  { name: 'Every Newsletter', url: 'https://every.to/feed', category: 'Tech' },
  { name: 'CB Insights Newsletter', url: 'https://www.cbinsights.com/research/feed/', category: 'Finance' },
]

async function discoverNewsletters() {
  const { data: existing } = await supabase
    .from('creators')
    .select('name')
    .eq('platform', 'newsletter')
  const known = new Set((existing || []).map(c => c.name.toLowerCase()))

  const discovered = [...NEWSLETTER_BOOTSTRAP.filter(n => !known.has(n.name.toLowerCase()))]

  // Search Substack discover for more newsletters
  try {
    const res = await fetch(
      'https://substack.com/api/v1/publication/best?page=0&limit=25',
      { headers: { 'User-Agent': 'ThatsTheOne/1.0' } }
    )
    if (res.ok) {
      const data = await res.json()
      const pubs = data?.publications || data || []
      for (const pub of pubs) {
        const name = pub.name || pub.title
        const subdomain = pub.subdomain
        if (!name || !subdomain || known.has(name.toLowerCase())) continue
        discovered.push({
          name,
          url: `https://${subdomain}.substack.com/feed`,
          category: pub.category_name || 'General',
        })
        known.add(name.toLowerCase())
      }
    }
  } catch {}

  console.log(`  📋 ${discovered.length} newsletters to process`)
  return discovered
}

async function runNewsletters() {
  console.log('\n📰 Newsletter connector starting...')
  const newsletters = await discoverNewsletters()
  let total = 0

  for (const nl of newsletters) {
    try {
      const res = await fetch(nl.url, {
        headers: { 'User-Agent': 'ThatsTheOne/1.0 (+https://thatsthe.one)' }
      })
      if (!res.ok) continue
      const xml = await res.text()

      const { data: creatorData } = await supabase
        .from('creators')
        .upsert({
          name: nl.name,
          slug: makeSlug(nl.name),
          category: nl.category,
          platform: 'newsletter',
        }, { onConflict: 'slug' })
        .select().single()

      if (!creatorData) continue
      console.log(`  📰 ${nl.name}`)

      const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 10)
      for (const match of itemMatches) {
        const item = match[1]
        const title = item.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>|<title[^>]*>(.*?)<\/title>/)?.[1] || ''
        const desc = (item.match(/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''
        const guid = item.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] || title
        if (!title || desc.length < 100) continue

        const content = makeContent(
          'newsletter',
          guid.slice(0, 200),
          nl.name,
          title,
          `${title}\n\n${desc}`,
          '',
          pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          'article'
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

  const headers = {
    'Client-ID': TWITCH_CLIENT_ID,
    'Authorization': `Bearer ${token}`,
  }
  let total = 0

  try {
    // Get top games/categories first dynamically
    const gamesRes = await fetch('https://api.twitch.tv/helix/games/top?first=10', { headers })
    const gamesData = await gamesRes.json()
    const games = gamesData.data || []

    for (const game of games) {
      const streamsRes = await fetch(
        `https://api.twitch.tv/helix/streams?game_id=${game.id}&first=5`,
        { headers }
      )
      const streamsData = await streamsRes.json()
      const streams = streamsData.data || []

      for (const stream of streams) {
        const userRes = await fetch(
          `https://api.twitch.tv/helix/users?id=${stream.user_id}`,
          { headers }
        )
        const userData = await userRes.json()
        const user = userData.data?.[0]
        if (!user) continue

        const channelRes = await fetch(
          `https://api.twitch.tv/helix/channels?broadcaster_id=${stream.user_id}`,
          { headers }
        )
        const channelData = await channelRes.json()
        const channel = channelData.data?.[0]

        const text = [
          stream.title,
          channel?.title || '',
          user.description || '',
          game.name,
        ].join('\n').trim()

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
          'twitch',
          `twitch_${stream.id}`,
          stream.user_name,
          stream.title,
          text,
          `https://twitch.tv/${stream.user_login}`,
          new Date().toISOString(),
          'stream'
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
  console.log(`${'═'.repeat(55)}`)

  const knownIds = await getKnownChannelIds()
  console.log(`📚 ${knownIds.size} creators already in database\n`)

  const results = {
    youtube: await runYouTube(knownIds, 40),
    podcasts: await runPodcasts(),
    reddit: await runReddit(),
    newsletters: await runNewsletters(),
    twitch: await runTwitch(),
  }

  const total = Object.values(results).reduce((a, b) => a + b, 0)

  console.log(`\n${'═'.repeat(55)}`)
  console.log(`✅ Pipeline complete in ${timeAgo(Date.now() - start)}`)
  console.log(`   YouTube:     ${results.youtube} sponsorships`)
  console.log(`   Podcasts:    ${results.podcasts} sponsorships`)
  console.log(`   Reddit:      ${results.reddit} sponsorships`)
  console.log(`   Newsletters: ${results.newsletters} sponsorships`)
  console.log(`   Twitch:      ${results.twitch} sponsorships`)
  console.log(`   Total:       ${total} sponsorships`)
  console.log(`${'═'.repeat(55)}`)
}

run().catch(console.error)