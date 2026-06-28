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

const CREATORS = [
  { name: 'Ali Abdaal', channelId: 'UCoOae5nYA7VqaXzerajD0lg', category: 'Productivity' },
  { name: 'MKBHD', channelId: 'UCBJycsmduvYEL83R_U4JriQ', category: 'Tech' },
  { name: 'Linus Tech Tips', channelId: 'UCXuqSBlHAE6Xw-yeJA0Tunw', category: 'Tech' },
  { name: 'Andrew Huberman', channelId: 'UC2D2CMWXMOVWx7giW1n3LIg', category: 'Health' },
  { name: 'Thomas Frank', channelId: 'UCG-KntY7aVnIGXYEBQvmBAQ', category: 'Productivity' },
  { name: 'Graham Stephan', channelId: 'UCV6KDgJskWaEckne5aPA0aQ', category: 'Finance' },
  { name: 'Lex Fridman', channelId: 'UCSHZKyawb77ixDdsGog4iWA', category: 'Tech' },
  { name: 'Veritasium', channelId: 'UCHnyfMqiRRG1u-2MsSQLbXA', category: 'Education' },
  { name: 'Mark Rober', channelId: 'UCY1kMZp36IQSyNx_9h4mpCg', category: 'Education' },
  { name: 'Dave2D', channelId: 'UCVhQ2NnY5Rskt6UjCUkJ_VA', category: 'Tech' },
  { name: 'Peter Attia', channelId: 'UCNHItQ7UJE7Jnl9HiDKrXBw', category: 'Health' },
  { name: 'Andrei Jikh', channelId: 'UCF9IOB2TExg3QIBupFtBDxg', category: 'Finance' },
  { name: 'Kurzgesagt', channelId: 'UCsXVk37bltHxD1rDPwtNM8Q', category: 'Education' },
  { name: 'CGP Grey', channelId: 'UC7_gcs09iThXybpVgjHZ_7g', category: 'Education' },
  { name: 'Matt D\'Avella', channelId: 'UCJ24N4O0bP7LGLBDvye7oCA', category: 'Lifestyle' },
  { name: 'Humphrey Yang', channelId: 'UCFCEuCsyWP0YkP3CZ3Mr01Q', category: 'Finance' },
  { name: 'Nischa', channelId: 'UCcJKDMSY4xOOt-xOGqPNRoA', category: 'Finance' },
  { name: 'Nate O\'Brien', channelId: 'UCO_MoHBMFRSTCPGasTnMAbw', category: 'Finance' },
  { name: 'Codie Sanchez', channelId: 'UCiNcDGl0GBiJLGKn5lWkQsQ', category: 'Finance' },
  { name: 'Tim Ferriss', channelId: 'UCznv7Vf9nBdJYvBagFdAHWw', category: 'Lifestyle' },
  { name: 'Slow Mo Guys', channelId: 'UCUK0HBIBWgM2c4vsPhkYY4w', category: 'Education' },
  { name: 'Wendover Productions', channelId: 'UC9RM-iSvTu1uPJb8X5yp3EQ', category: 'Education' },
  { name: 'Johnny Harris', channelId: 'UCmGSJVG3mCRat87YME7sKNw', category: 'Education' },
  { name: 'Medlife Crisis', channelId: 'UCzm6KBZPlbxXuoYuXJKOTMA', category: 'Health' },
  { name: 'James Hoffmann', channelId: 'UCMb0O2CdPBNi-QqPk5T3gsQ', category: 'Lifestyle' },
]

// DAR scoring logic
function computeDAR(extraction) {
  let score = 50 // base for AI extracted
  let source = 'ai_extracted'

  // Boost for high confidence
  if (extraction.confidence >= 0.95) score += 15
  else if (extraction.confidence >= 0.9) score += 10
  else if (extraction.confidence >= 0.85) score += 5

  // Boost for having exact quote
  if (extraction.exact_quote && extraction.exact_quote.length > 20) score += 10

  // Boost for valid promo code
  if (extraction.promo_code && isValidCode(extraction.promo_code)) score += 10

  // Boost for offer text
  if (extraction.offer_text) score += 5

  // Boost for custom URL
  if (extraction.promo_url) score += 5

  // Penalise vague mentions
  if (extraction.sponsorship_type === 'mention') score -= 10

  return { score: Math.min(Math.max(score, 30), 80), source }
}

function isValidCode(code) {
  if (!code) return false
  if (code.length < 2 || code.length > 12) return false
  if (/[./\\]/.test(code)) return false
  if (/^[0-9]+$/.test(code)) return false // pure numbers
  const junk = new Set([
    'FREE', 'CLICK', 'DOWNLOAD', 'WATCH', 'LINK', 'PBS', 'HTTPS',
    'MORE', 'HERE', 'NOW', 'SHOP', 'CODE', 'WAN', 'LTT', 'GET',
    'USE', 'NEW', 'OFF', 'THE', 'AND', 'FOR', 'YOU', 'ALL',
    'SUBSCRIBE', 'REVIEWS', 'PROMO', 'DEAL', 'SAVE',
  ])
  if (junk.has(code.toUpperCase())) return false
  // Reject if looks like a YouTube video ID (11 chars, mixed case alphanumeric)
  if (code.length === 11 && /^[a-zA-Z0-9_-]+$/.test(code)) return false
  return true
}

function extractSponsorUrls(description) {
  const urlPattern = /https?:\/\/(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})\/([a-zA-Z0-9-_]+)/g
  const skip = new Set([
    'youtube.com', 'instagram.com', 'twitter.com', 'x.com',
    'tiktok.com', 'facebook.com', 'linkedin.com', 'spotify.com',
    'apple.com', 'google.com', 'amzn.to', 'bit.ly', 'linktr.ee',
  ])
  const urls = []
  let match
  while ((match = urlPattern.exec(description)) !== null) {
    if (!skip.has(match[1].toLowerCase())) urls.push(match[0])
  }
  return [...new Set(urls)].slice(0, 6)
}

async function extractSponsors(videoTitle, description, publishedAt) {
  if (!description || description.length < 50) return []

  const sponsorUrls = extractSponsorUrls(description)
  const videoAge = Math.floor(
    (Date.now() - new Date(publishedAt).getTime()) / (86400000 * 30)
  )

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert at identifying brand sponsorships in YouTube content.

Extract ONLY genuine paid sponsorships or affiliate partnerships. Return a JSON array.

Each item MUST have:
{
  "brand": "Clean brand name, no punctuation",
  "sponsorship_type": "code" | "url" | "offer" | "mention",
  "promo_code": "SHORT alphanumeric code max 12 chars OR null",
  "promo_url": "custom tracking URL like brand.com/creator OR null",  
  "offer_text": "Exact deal text like '3 months free' or '$1/month' OR null",
  "exact_quote": "The EXACT sentence from description mentioning this sponsor, max 200 chars OR null",
  "confidence": 0.0 to 1.0,
  "is_organic": false
}

CRITICAL rules for promo_code:
- MUST be 2-12 characters
- Letters and numbers only — NO dots, slashes, spaces
- NOT a YouTube video ID (never 11 chars of mixed alphanumeric)
- NOT generic words: FREE, CLICK, WATCH, LINK, CODE, GET, USE, NEW, OFF, SUBSCRIBE, MORE, HERE, NOW, SHOP
- NOT brand names themselves
- If unsure → set to null

sponsorship_type rules:
- "code" = has a genuine short promo code
- "url" = has a custom URL like nordvpn.com/creator
- "offer" = has a deal (free trial, discount) but no code
- "mention" = mentioned as sponsor but no specific deal

confidence rules:
- 0.95+ = explicit "sponsored by" with code or custom URL
- 0.90 = clear sponsorship language with deal details
- 0.85 = probable sponsorship, some ambiguity
- Below 0.85 = do not include

NEVER include: YouTube, Google, social platforms, streaming services, news sites, creator's own products unless clearly sponsored by another brand.

Return [] if no qualifying sponsors found.
Return ONLY valid JSON array, no markdown, no explanation.`
        },
        {
          role: 'user',
          content: `Video title: "${videoTitle}"
Published: ${videoAge} months ago
Sponsor URLs detected in description: ${sponsorUrls.length ? sponsorUrls.join(', ') : 'none'}

Description:
${description.slice(0, 3500)}`
        }
      ],
      temperature: 0.05,
      max_tokens: 800,
    })

    const raw = completion.choices[0].message.content?.trim() || '[]'
    const clean = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    if (!Array.isArray(parsed)) return []

    return parsed
      .filter(s => s.confidence >= 0.85 && s.brand && s.brand.length > 1)
      .map(s => ({
        ...s,
        promo_code: isValidCode(s.promo_code) ? s.promo_code.toUpperCase() : null,
        exact_quote: s.exact_quote?.slice(0, 200) || null,
        offer_text: s.offer_text?.slice(0, 100) || null,
        ...computeDAR(s),
      }))
  } catch (err) {
    console.error('  AI error:', err.message)
    return []
  }
}

async function getVideos(channelId, maxVideos = 50) {
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
    await new Promise(r => setTimeout(r, 300))
  }

  return videos.slice(0, maxVideos)
}

function makeSlug(name) {
  return name.toLowerCase()
    .replace(/[\s&']+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

async function run() {
  console.log(`\n🚀 Clean backfill with DAR scoring`)
  console.log(`📅 ${new Date().toISOString()}\n`)

  let totalSponsors = 0
  let totalVideos = 0
  const darBuckets = { high: 0, medium: 0, low: 0 }

  for (const creator of CREATORS) {
    console.log(`\n━━ ${creator.name} (${creator.category})`)

    // Upsert creator
    const { data: creatorData, error: creatorError } = await supabase
      .from('creators')
      .upsert({
        name: creator.name,
        slug: makeSlug(creator.name),
        channel_id: creator.channelId,
        category: creator.category,
        platform: 'youtube',
      }, { onConflict: 'channel_id' })
      .select()
      .single()

    if (creatorError || !creatorData) {
      console.log(`  ✗ Creator upsert failed: ${creatorError?.message}`)
      continue
    }

    const videos = await getVideos(creator.channelId, 50)
    console.log(`  📹 ${videos.length} videos`)
    totalVideos += videos.length

    let creatorCount = 0
    const brandMentionMap = {}

    for (const video of videos) {
      const title = video.snippet?.title || ''
      const description = video.snippet?.description || ''
      const publishedAt = video.snippet?.publishedAt || new Date().toISOString()

      const sponsors = await extractSponsors(title, description, publishedAt)

      for (const s of sponsors) {
        const brandSlug = makeSlug(s.brand)

        const { data: brandData } = await supabase
          .from('brands')
          .upsert({ name: s.brand, slug: brandSlug }, { onConflict: 'slug' })
          .select()
          .single()

        if (!brandData) continue

        // Track mentions per brand for this creator
        brandMentionMap[brandData.id] = (brandMentionMap[brandData.id] || 0) + 1

        const { error: spError } = await supabase
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
            dar_score: s.score,
            dar_source: s.source,
          }, { onConflict: 'video_id,brand_id' })

        if (spError) {
          console.log(`  ✗ ${s.brand}: ${spError.message}`)
          continue
        }

        totalSponsors++
        creatorCount++

        // DAR bucket tracking
        if (s.score >= 70) darBuckets.high++
        else if (s.score >= 55) darBuckets.medium++
        else darBuckets.low++

        const darLabel = s.score >= 70 ? '🟢' : s.score >= 55 ? '🟡' : '🔴'
        const detail = s.promo_code
          ? `code: ${s.promo_code}`
          : s.offer_text
          ? `offer: "${s.offer_text}"`
          : s.promo_url
          ? `url: ${s.promo_url}`
          : 'mention'

        console.log(`  ${darLabel} DAR:${s.score} | ${s.brand} [${s.sponsorship_type}] ${detail}`)
        if (s.exact_quote) {
          console.log(`     💬 "${s.exact_quote.slice(0, 90)}${s.exact_quote.length > 90 ? '...' : ''}"`)
        }
      }

      await new Promise(r => setTimeout(r, 200))
    }

    // Update creator stats
    await supabase
      .from('creators')
      .update({ total_sponsorships: creatorCount })
      .eq('id', creatorData.id)

    console.log(`  → ${creatorCount} sponsorships found`)
    await new Promise(r => setTimeout(r, 500))
  }

  // Final summary
  console.log(`\n${'═'.repeat(50)}`)
  console.log(`✅ Backfill complete`)
  console.log(`   Videos processed:    ${totalVideos}`)
  console.log(`   Sponsorships found:  ${totalSponsors}`)
  console.log(`   DAR breakdown:`)
  console.log(`     🟢 High (70+):     ${darBuckets.high}`)
  console.log(`     🟡 Medium (55-69): ${darBuckets.medium}`)
  console.log(`     🔴 Low (<55):      ${darBuckets.low}`)
  console.log(`   Finished: ${new Date().toISOString()}`)
}

run().catch(console.error)