import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const YT_KEY = process.env.YOUTUBE_API_KEY

const CATEGORY_SEEDS = [
    'tech review youtube 2024',
    'productivity youtube channel',
    'personal finance youtube',
    'health wellness youtube',
    'gaming youtube channel',
    'fitness youtube channel',
    'self improvement youtube',
    'podcast host youtube',
    'software engineering youtube',
    'investing youtube channel',
    'entrepreneurship youtube',
    'nutrition science youtube',
    'mental health youtube',
    'crypto bitcoin youtube',
    'travel youtube channel',
    'cooking food youtube',
    'education science youtube',
    'career advice youtube',
    'real estate investing youtube',
    'AI artificial intelligence youtube',
  ]

const MIN_SUBSCRIBERS = 100000
const VIDEOS_PER_CREATOR = 15
const CREATORS_PER_CATEGORY = 12

async function getDynamicSeeds() {
  const { data } = await supabase
    .from('search_trends')
    .select('query, count')
    .order('count', { ascending: false })
    .limit(10)

  const trendingSeeds = (data || []).map(t => `${t.query} youtube`)
  console.log(`Found ${trendingSeeds.length} trending seeds from user searches`)
  return [...CATEGORY_SEEDS, ...trendingSeeds]
}

async function searchTopCreators(query) {
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?key=${YT_KEY}&q=${encodeURIComponent(query)}&type=channel&part=snippet&maxResults=${CREATORS_PER_CATEGORY}&order=relevance`
    const res = await fetch(url)
    const data = await res.json()
    return data.items || []
  } catch { return [] }
}

async function getChannelStats(channelId) {
  try {
    const url = `https://www.googleapis.com/youtube/v3/channels?key=${YT_KEY}&id=${channelId}&part=snippet,statistics`
    const res = await fetch(url)
    const data = await res.json()
    const channel = data.items?.[0]
    if (!channel) return null
    return {
      subscribers: parseInt(channel.statistics?.subscriberCount || '0'),
      name: channel.snippet.title,
    }
  } catch { return null }
}

async function getRecentVideos(channelId) {
  try {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?key=${YT_KEY}&channelId=${channelId}&part=snippet&order=date&maxResults=${VIDEOS_PER_CREATOR}&type=video`
    const searchRes = await fetch(searchUrl)
    const searchData = await searchRes.json()
    const videoIds = (searchData.items || []).map(v => v.id?.videoId).filter(Boolean)
    if (!videoIds.length) return []

    const detailUrl = `https://www.googleapis.com/youtube/v3/videos?key=${YT_KEY}&id=${videoIds.join(',')}&part=snippet`
    const detailRes = await fetch(detailUrl)
    const detailData = await detailRes.json()
    return detailData.items || []
  } catch { return [] }
}

async function extractSponsors(videoTitle, description) {
  if (!description || description.length < 30) return []
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You extract brand sponsorships from YouTube video descriptions.
Return ONLY a JSON array. Each item: { "brand": string, "code": string|null, "confidence": number 0-1 }

STRICT rules for promo codes:
- A valid code is SHORT (2-12 characters), alphanumeric, like: ALI10, VIRAL, MKBHD, REVIEWS20
- URLs are NOT codes — reject anything with .com, .io, http, www, or slashes
- Generic words are NOT codes — reject: REVIEWS, SUBSCRIBE, DOWNLOAD, FREE, CLICK
- Shopify's "$1 per month" offer has no code — set code to null
- If unsure, set code to null rather than guessing
- Only include sponsorships with confidence 0.8 or above
- Return [] if nothing found
- Return ONLY valid JSON array, nothing else`
        },
        {
          role: 'user',
          content: `Title: "${videoTitle}"\n\nDescription:\n${description.slice(0, 2500)}`
        }
      ],
      temperature: 0.1,
      max_tokens: 400,
    })
    const content = completion.choices[0].message.content?.trim() || '[]'
    const clean = content.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    const isValidCode = (code) => {
        if (!code) return false
        if (code.length > 15) return false
        if (code.includes('.') || code.includes('/') || code.includes('http')) return false
        if (['REVIEWS', 'SUBSCRIBE', 'FREE', 'CLICK', 'DOWNLOAD', 'WATCH', 'LINK'].includes(code.toUpperCase())) return false
        return true
      }
      
      return Array.isArray(parsed) ? parsed
        .filter(s => s.confidence >= 0.8)
        .map(s => ({ ...s, code: isValidCode(s.code) ? s.code : null }))
        : []
  } catch { return [] }
}

function makeSlug(name) {
  return name.toLowerCase()
    .replace(/[\s&]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 60)
}

async function run() {
  console.log(`\n🚀 Smart scraper starting at ${new Date().toISOString()}`)

  const seeds = await getDynamicSeeds()
  console.log(`📋 Running ${seeds.length} category seeds (${CATEGORY_SEEDS.length} base + ${seeds.length - CATEGORY_SEEDS.length} from user trends)`)

  const processedChannels = new Set()
  let totalSponsors = 0
  let totalCreators = 0

  for (const seed of seeds) {
    console.log(`\n🔍 Category: "${seed}"`)
    const channels = await searchTopCreators(seed)

    for (const channel of channels) {
      const channelId = channel.id?.channelId || channel.snippet?.channelId
      if (!channelId || processedChannels.has(channelId)) continue
      processedChannels.add(channelId)

      const stats = await getChannelStats(channelId)
      if (!stats || stats.subscribers < MIN_SUBSCRIBERS) continue

      console.log(`\n👤 ${stats.name} (${stats.subscribers.toLocaleString()} subs)`)
      totalCreators++

      const slug = makeSlug(stats.name)
      const { data: creatorData } = await supabase
        .from('creators')
        .upsert({
          name: stats.name,
          slug,
          channel_id: channelId,
          subscriber_count: stats.subscribers,
          platform: 'youtube',
        }, { onConflict: 'channel_id' })
        .select()
        .single()

      if (!creatorData) continue

      const videos = await getRecentVideos(channelId)

      for (const video of videos) {
        const title = video.snippet?.title || ''
        const description = video.snippet?.description || ''
        const sponsors = await extractSponsors(title, description)

        for (const { brand, code, confidence } of sponsors) {
          const brandSlug = makeSlug(brand)

          const { data: brandData } = await supabase
            .from('brands')
            .upsert({ name: brand, slug: brandSlug }, { onConflict: 'slug' })
            .select()
            .single()

          if (!brandData) continue

          await supabase
            .from('sponsorships')
            .upsert({
              creator_id: creatorData.id,
              brand_id: brandData.id,
              promo_code: code,
              platform: 'youtube',
              video_id: video.id,
              video_title: title,
              first_seen: video.snippet?.publishedAt,
              last_seen: video.snippet?.publishedAt,
              is_active: true,
            }, { onConflict: 'video_id,brand_id' })

          totalSponsors++
          console.log(`  ✓ ${brand} (code: ${code || 'none'}, confidence: ${confidence})`)
        }

        await new Promise(r => setTimeout(r, 150))
      }

      await new Promise(r => setTimeout(r, 400))
    }

    await new Promise(r => setTimeout(r, 600))
  }

  console.log(`\n✅ Done!`)
  console.log(`   Creators processed: ${totalCreators}`)
  console.log(`   Sponsorships found: ${totalSponsors}`)
  console.log(`   Finished at: ${new Date().toISOString()}`)
}

run().catch(console.error)