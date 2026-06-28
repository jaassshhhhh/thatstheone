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

const MIN_SUBSCRIBERS = 50000
const MAX_CREATORS_PER_RUN = 80
const VIDEOS_PER_CREATOR = 20

// Base category seeds — these never change
// Everything else is discovered dynamically
const BASE_SEEDS = [
  'tech review', 'personal finance', 'productivity',
  'health wellness', 'fitness', 'self improvement',
  'entrepreneurship', 'investing', 'education science',
  'gaming', 'cooking food', 'mental health',
  'career advice', 'AI technology', 'crypto',
  'travel vlog', 'fashion style', 'real estate',
]

// ─── Dynamic seed generation ──────────────────────────────

async function getDynamicSeeds() {
  // 1. What are users actually searching for on our platform?
  const { data: trends } = await supabase
    .from('search_trends')
    .select('query, count')
    .order('count', { ascending: false })
    .limit(15)

  const userSeeds = (trends || []).map(t => t.query)

  // 2. What brands do we already have? Search for more creators promoting them
  const { data: topBrands } = await supabase
    .from('brands')
    .select('name')
    .limit(20)

  const brandSeeds = (topBrands || []).map(b => `${b.name} sponsor youtube`)

  // 3. What categories have the most sponsorships? Double down on them
  const { data: hotCategories } = await supabase
    .from('creators')
    .select('category')
    .not('category', 'is', null)

  const categoryCounts = {}
  ;(hotCategories || []).forEach(c => {
    categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1
  })

  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat]) => `${cat} youtube creator`)

  const allSeeds = [...BASE_SEEDS, ...userSeeds, ...brandSeeds, ...topCategories]
  console.log(`\n📋 Seeds: ${BASE_SEEDS.length} base + ${userSeeds.length} from user trends + ${brandSeeds.length} from brands + ${topCategories.length} from hot categories = ${allSeeds.length} total`)

  return allSeeds
}

// ─── Already known channels ───────────────────────────────

async function getKnownChannelIds() {
  const { data } = await supabase
    .from('creators')
    .select('channel_id')
    .not('channel_id', 'is', null)

  return new Set((data || []).map(c => c.channel_id))
}

// ─── Channel discovery ────────────────────────────────────

async function searchCreators(query, maxResults = 10) {
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?key=${YT_KEY}&q=${encodeURIComponent(query)}&type=channel&part=snippet&maxResults=${maxResults}&order=relevance`
    const res = await fetch(url)
    const data = await res.json()
    if (data.error) return []
    return (data.items || []).map(item => ({
      channelId: item.id?.channelId || item.snippet?.channelId,
      name: item.snippet?.channelTitle,
    })).filter(c => c.channelId)
  } catch { return [] }
}

async function getRelatedChannels(channelId) {
  // Search for channels that frequently appear alongside this one
  try {
    // Get channel name first
    const chanUrl = `https://www.googleapis.com/youtube/v3/channels?key=${YT_KEY}&id=${channelId}&part=snippet`
    const chanRes = await fetch(chanUrl)
    const chanData = await chanRes.json()
    const channelName = chanData.items?.[0]?.snippet?.title
    if (!channelName) return []

    // Search for similar channels
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?key=${YT_KEY}&q=${encodeURIComponent(channelName + ' similar channel')}&type=channel&part=snippet&maxResults=5`
    const searchRes = await fetch(searchUrl)
    const searchData = await searchRes.json()
    return (searchData.items || []).map(item => ({
      channelId: item.id?.channelId,
      name: item.snippet?.channelTitle,
    })).filter(c => c.channelId && c.channelId !== channelId)
  } catch { return [] }
}

async function getChannelStats(channelId) {
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
      description: ch.snippet.description?.slice(0, 200),
    }
  } catch { return null }
}

// ─── Video processing ─────────────────────────────────────

async function getVideos(channelId, maxVideos = VIDEOS_PER_CREATOR) {
  const videos = []
  let pageToken = null

  while (videos.length < maxVideos) {
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
    if (!pageToken || videos.length >= maxVideos) break
    await new Promise(r => setTimeout(r, 200))
  }

  return videos.slice(0, maxVideos)
}

// ─── DAR scoring ──────────────────────────────────────────

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

function isValidCode(code) {
  if (!code) return false
  if (code.length < 2 || code.length > 12) return false
  if (/[./\\]/.test(code)) return false
  if (/^[0-9]+$/.test(code)) return false
  if (code.length === 11 && /^[a-zA-Z0-9_-]+$/.test(code)) return false
  const junk = new Set(['FREE', 'CLICK', 'DOWNLOAD', 'WATCH', 'LINK',
    'PBS', 'HTTPS', 'MORE', 'HERE', 'NOW', 'SHOP', 'CODE', 'WAN',
    'GET', 'USE', 'NEW', 'OFF', 'THE', 'AND', 'FOR', 'YOU', 'ALL',
    'SUBSCRIBE', 'REVIEWS', 'PROMO', 'DEAL', 'SAVE', 'LTT'])
  if (junk.has(code.toUpperCase())) return false
  return true
}

// ─── AI extraction ────────────────────────────────────────

async function extractSponsors(videoTitle, description, publishedAt) {
  if (!description || description.length < 50) return []

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Extract genuine brand sponsorships from YouTube video descriptions.
Return ONLY a JSON array with items:
{
  "brand": "Clean brand name",
  "sponsorship_type": "code"|"url"|"offer"|"mention",
  "promo_code": "2-12 char alphanumeric OR null",
  "promo_url": "custom tracking URL OR null",
  "offer_text": "deal description OR null",
  "exact_quote": "exact sentence from description OR null",
  "confidence": 0.85-1.0,
  "is_organic": false
}

promo_code rules:
- 2-12 chars, letters+numbers only
- NOT: video IDs, generic words (FREE/WATCH/CLICK/SUBSCRIBE/CODE/LINK/GET/USE/NEW/OFF)
- NOT: brand names themselves
- NOT: 11-char YouTube IDs
- If unsure → null

Only include confidence 0.85+.
Ignore: YouTube, Google, social platforms, streaming services.
Return [] if nothing found.
ONLY valid JSON array.`
        },
        {
          role: 'user',
          content: `Title: "${videoTitle}"\nDescription:\n${description.slice(0, 3000)}`
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

// ─── Database writes ──────────────────────────────────────

function makeSlug(name) {
  return name.toLowerCase()
    .replace(/[\s&']+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

async function processCreator(channelId, knownIds, stats = null) {
  if (knownIds.has(channelId)) return 0

  const channelStats = stats || await getChannelStats(channelId)
  if (!channelStats) return 0
  if (channelStats.subscribers < MIN_SUBSCRIBERS) return 0

  knownIds.add(channelId)

  const { data: creatorData } = await supabase
    .from('creators')
    .upsert({
      name: channelStats.name,
      slug: makeSlug(channelStats.name),
      channel_id: channelId,
      subscriber_count: channelStats.subscribers,
      avatar_url: channelStats.thumbnail,
      platform: 'youtube',
    }, { onConflict: 'channel_id' })
    .select()
    .single()

  if (!creatorData) return 0

  const videos = await getVideos(channelId)
  let count = 0

  for (const video of videos) {
    const title = video.snippet?.title || ''
    const desc = video.snippet?.description || ''
    const publishedAt = video.snippet?.publishedAt || new Date().toISOString()
    const sponsors = await extractSponsors(title, desc, publishedAt)

    for (const s of sponsors) {
      const { data: brandData } = await supabase
        .from('brands')
        .upsert({ name: s.brand, slug: makeSlug(s.brand) }, { onConflict: 'slug' })
        .select()
        .single()

      if (!brandData) continue

      await supabase
        .from('sponsorships')
        .upsert({
          creator_id: creatorData.id,
          brand_id: brandData.id,
          promo_code: s.promo_code,
          promo_url: s.promo_url,
          offer_text: s.offer_text,
          exact_quote: s.exact_quote,
          sponsorship_type: s.sponsorship_type,
          is_organic: s.is_organic || false,
          platform: 'youtube',
          video_id: video.id,
          video_title: title,
          first_seen: publishedAt,
          last_seen: publishedAt,
          is_active: true,
          dar_score: s.dar_score,
          dar_source: s.dar_source,
        }, { onConflict: 'video_id,brand_id' })

      count++
      const dar = s.dar_score >= 70 ? '🟢' : s.dar_score >= 55 ? '🟡' : '🔴'
      const detail = s.promo_code || s.offer_text || s.sponsorship_type
      console.log(`    ${dar} ${s.brand} → ${detail}`)
    }

    await new Promise(r => setTimeout(r, 200))
  }

  await supabase
    .from('creators')
    .update({ total_sponsorships: count })
    .eq('id', creatorData.id)

  return count
}

// ─── Main run ─────────────────────────────────────────────

async function run() {
  console.log(`\n🚀 Dynamic scraper starting — ${new Date().toISOString()}`)
  console.log(`   Max creators this run: ${MAX_CREATORS_PER_RUN}`)
  console.log(`   Videos per creator: ${VIDEOS_PER_CREATOR}`)
  console.log(`   Min subscribers: ${MIN_SUBSCRIBERS.toLocaleString()}\n`)

  const knownIds = await getKnownChannelIds()
  console.log(`📚 Already know ${knownIds.size} creators — skipping those`)

  const seeds = await getDynamicSeeds()
  let totalSponsors = 0
  let totalCreators = 0
  const discoveredForNextRun = new Set()

  for (const seed of seeds) {
    if (totalCreators >= MAX_CREATORS_PER_RUN) break

    console.log(`\n🔍 "${seed}"`)
    const candidates = await searchCreators(seed, 8)

    for (const candidate of candidates) {
      if (totalCreators >= MAX_CREATORS_PER_RUN) break
      if (knownIds.has(candidate.channelId)) continue

      const stats = await getChannelStats(candidate.channelId)
      if (!stats || stats.subscribers < MIN_SUBSCRIBERS) continue

      console.log(`\n  👤 ${stats.name} (${(stats.subscribers/1000000).toFixed(1)}M subs)`)
      totalCreators++

      const count = await processCreator(candidate.channelId, knownIds, stats)
      totalSponsors += count
      console.log(`     → ${count} sponsorships`)

      // Discover related channels for next seed expansion
      if (count > 0) {
        const related = await getRelatedChannels(candidate.channelId)
        related.forEach(r => {
          if (!knownIds.has(r.channelId)) {
            discoveredForNextRun.add(r.channelId)
          }
        })
      }

      await new Promise(r => setTimeout(r, 400))
    }

    await new Promise(r => setTimeout(r, 600))
  }

  // Save discovered channels for next run as dynamic seeds
  if (discoveredForNextRun.size > 0) {
    console.log(`\n💾 Saving ${discoveredForNextRun.size} discovered channels for next run...`)
    for (const channelId of Array.from(discoveredForNextRun).slice(0, 20)) {
      const stats = await getChannelStats(channelId)
      if (stats && stats.subscribers >= MIN_SUBSCRIBERS) {
        await supabase
          .from('search_trends')
          .upsert({
            query: `channel:${channelId}:${stats.name}`,
            count: 1,
            last_searched: new Date().toISOString(),
          }, { onConflict: 'query' })
      }
    }
  }

  console.log(`\n${'═'.repeat(50)}`)
  console.log(`✅ Done`)
  console.log(`   New creators processed: ${totalCreators}`)
  console.log(`   Sponsorships found:     ${totalSponsors}`)
  console.log(`   Channels queued for next run: ${discoveredForNextRun.size}`)
  console.log(`   Finished: ${new Date().toISOString()}`)
}

run().catch(console.error)