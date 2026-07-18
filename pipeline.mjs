import OpenAI from 'openai'
import { YoutubeTranscript } from 'youtube-transcript'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '.env.local') })

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const YT_KEYS = [
  process.env.YOUTUBE_API_KEY,
].filter(Boolean)

const keyQuotas = YT_KEYS.map(() => ({ used: 0, limit: 9000 }))
  
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
// Niche/small creator pipeline — a bounded exception to the floor above,
// applied only to related-channel expansion. See Task 3 of the niche pipeline plan.
const NICHE_MIN_SUBSCRIBERS = 1000
const MAX_NICHE_PER_RUN = 15
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
const SNEAKER_YOUTUBE_CHANNELS = [
  { channelId: 'UCE_--R1P5-kfBzHTca0dsnw', name: 'Complex', category: 'Streetwear' },
  { channelId: 'UCmd52DyhaO4E1Cvy4RrHuew', name: 'HYPEBEAST', category: 'Streetwear' },
  { channelId: 'UCToda8e5o74n5JuhE4qzyOQ', name: 'Sneaker Freaker Magazine', category: 'Streetwear' },
  { channelId: 'UCZ9l_6_f0PWRYXN5Y7Lcl2A', name: 'Jacques Slade', category: 'Streetwear' },
]

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
    if (/^(unknown|unnamed|n\/a|na|none)\b/.test(lower)) return true
    return false
  }
  
  const STOREFRONT_AFFIXES = ['shop', 'store', 'merch', 'official', 'the']
  
  function stripAffixesAndNormalize(str) {
    let s = str.toLowerCase()
    for (const affix of STOREFRONT_AFFIXES) {
      s = s.replace(new RegExp(`^${affix}|${affix}$`, 'g'), '')
    }
    return s.replace(/[^a-z0-9]/g, '')
  }
  
  function isSelfPromotion(creatorName, brandName) {
    if (!creatorName || !brandName) return false
    const creatorCore = stripAffixesAndNormalize(creatorName)
    const brandCore = stripAffixesAndNormalize(brandName)
    if (creatorCore.length < 4 || brandCore.length < 4) return false
    return creatorCore.includes(brandCore) || brandCore.includes(creatorCore)
  }

// ─── Normalised content format ─────────────────────────────
export function makeContent(platform, externalId, creatorName, title, rawText, mediaUrl, publishedAt, contentType = 'video') {
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

export function safeISOString(dateStr) {
  if (!dateStr) return new Date().toISOString()
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

function makeSlug(name) {
  return name.toLowerCase()
    .replace(/[\s&']+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

// Captures a specific PRODUCT page URL (not just the brand's root domain) — only
// when the creator has directly linked one in the text. Never guesses or constructs
// a product URL; if none is present, returns null and the frontend falls back to
// the brand-level link instead.
function extractProductUrl(description, brandName) {
  if (!description || !brandName) return null
  const brandLower = brandName.toLowerCase().replace(/\s+/g, '')
  const urlPattern = /https?:\/\/(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})(\/[a-zA-Z0-9\-_./?=&]*)?/g
  const skip = new Set([
    'youtube.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com',
    'facebook.com', 'linkedin.com', 'spotify.com', 'apple.com', 'google.com',
    'bit.ly', 'linktr.ee', 'amzn.to', 'patreon.com', 'discord.gg', 'twitch.tv',
  ])
  let match
  while ((match = urlPattern.exec(description)) !== null) {
    const domain = match[1].toLowerCase()
    const path = match[2] || ''
    if (skip.has(domain)) continue
    const domainRoot = domain.split('.')[0]
    const isBrandDomain = domainRoot.startsWith(brandLower.slice(0, 5)) && domainRoot.length <= brandLower.length + 4
    // Only counts as a PRODUCT url if it's the brand's own domain AND has a real
    // path beyond just "/" — a bare homepage link isn't a product link
    if (isBrandDomain && path.length > 1) {
      return `https://${domain}${path}`
    }
  }
  return null
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
    const domainRoot = domain.split('.')[0]
    // Require the domain's actual name to START with the brand slug, not just contain it
    // anywhere — prevents random tracking-link substrings (e.g. "adidas.njih") from
    // false-matching. Length cap avoids "adidasoriginalstorefront.com"-style false positives too.
    if (domainRoot.startsWith(brandLower.slice(0, 5)) && domainRoot.length <= brandLower.length + 4) {
      return `https://${domain}`
    }
  }
  return null
}

// ─── Verified brand URL fallback ────────────────────────────
// When no reliable URL was found in the content text, actively check if the
// brand's obvious .com domain is real and reachable, rather than leaving
// website_url blank. Only saves a URL that's been confirmed to resolve.
export async function verifyBrandDomain(brandName) {
  try {
    const slug = brandName.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (slug.length < 3) return null
    const candidateUrl = `https://${slug}.com`
    const res = await fetch(candidateUrl, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
    })
    // Accept normal success and redirect-resolved responses only
    if (res.ok || (res.status >= 300 && res.status < 400)) {
      return res.url || candidateUrl
    }
    return null
  } catch {
    return null
  }
}

async function verifyUrlLive(url) {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok || (res.status >= 300 && res.status < 400)) {
      return res.url || url
    }
    return null
  } catch {
    return null
  }
}

function cleanQuote(quote) {
  if (!quote) return null
  const cleaned = quote.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, 200)
  if (!cleaned) return null
  // Reject leftover link labels / list headings, e.g. "Brand Name:" after a URL was stripped —
  // a real quote doesn't end in a bare colon and needs enough content to be an actual sentence.
  if (/:$/.test(cleaned)) return null
  if (cleaned.length < 15) return null
  return cleaned
}

function timeAgo(ms) {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

// ─── Headline generation ───────────────────────────────────
export async function generateHeadline(brand, creatorName, sponsorshipType, offerText, promoCode, exactQuote, platform) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You write short, plain, informative headlines for a creator deal feed. State what's actually happening — don't editorialize, don't tell the reader how to feel about it, don't make claims you can't back up.

Rules:
- Max 12 words
- Plain and factual, not hype, not a dramatic reveal
- Never make claims about how a creator feels ("won't shut up about", "loves it", "trusts it") — only state what's observable: what was said, what code exists, how often it's come up
- Third person — describe what's happening, never say "sign up", "get", "unlock", "grab", "discover"
- Be specific — real numbers, real names, real offers when available
- No exclamation marks, no rhetorical questions, no "you won't believe" framing
- Casual is fine, but relaxed-casual, not forced-casual
- No quotes around the headline

Good examples:
Thomas Frank has mentioned Skillshare across 3 years of videos
Audible is giving away free audiobooks through creator codes right now
Veritasium's audience gets 20% off Brilliant for the next 200 signups
Trading 212 is giving UK creators £100 in free shares

Bad examples (overstated or editorializing):
Thomas Frank won't shut up about Skillshare (3 years and counting)
That's not a coincidence — Brilliant clearly trusts Veritasium's audience

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
export async function extractFromContent(content) {
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
            "offer_text": "the SPECIFIC concrete deal — a percentage off, a free trial, a dollar amount, a giveaway. Never a phrase that's just enthusiasm ('my favorite', 'love this', 'so good') with no actual concrete benefit attached. If there's no real, specific deal stated, use null.",
            "exact_quote": "exact sentence mentioning brand max 200 chars NO URLs OR null",
            "confidence": 0.85-1.0,
            "is_organic": true|false,
            "detected_language": "en"|"hi"|"ja"|"es"|"fr"|"other",
            "brand_category": "Tech"|"Finance"|"Health"|"Lifestyle"|"Education"|"Gaming"|"Beauty"|"Food"|null,
            "brand_description": "one plain sentence explaining what the product actually IS, max 100 chars, OR null",
            "product_mentioned": "the SPECIFIC product/model name if one is mentioned, e.g. 'Ultra Boost' or 'AG1 Travel Packs', max 80 chars, OR null if only the brand is mentioned generically",
            "product_source": "creator_stated"|"comment_confirmed"|null
          }

          brand_category: classify what the BRAND/PRODUCT itself actually is — a supplement company is "Health" even if it's advertised on a finance podcast. A budgeting app is "Finance" even if a gaming streamer reads the ad. Judge the product, never the show or creator it appears on. Use null only if genuinely unclear from the text.

         brand_description: a plain-language answer to "what even is this product" for someone who's never heard of it — e.g. "A daily greens and vitamins supplement drink" or "A phone system for small businesses." Base it only on what the content actually says about the product, never guess or invent details. Use null if the text gives no real clue what the product does.

          product_mentioned: ONLY fill this when a SPECIFIC product, model, or variant is named — not the brand alone. "Adidas Ultra Boost" → product_mentioned: "Ultra Boost". "these Adidas shoes" with no model name → product_mentioned: null. Never guess or infer a model name that isn't explicitly in the text.

          product_mentioned MUST come from the DESCRIPTION, TRANSCRIPT, CHAPTERS, or a CREATOR REPLIES entry. NEVER take a product name from the VIEWER COMMENTS section alone — a viewer guessing "those look like Ultra Boosts" is not confirmation unless a CREATOR REPLIES entry confirms it. If the only source is an unconfirmed viewer comment, leave product_mentioned null.

          product_source: "creator_stated" when the product name appears in the creator's own DESCRIPTION, TRANSCRIPT, or CHAPTERS. "comment_confirmed" when the product name only appears because a CREATOR REPLIES entry confirmed it. null whenever product_mentioned is null.

          is_organic = true when creator expresses genuine personal use WITHOUT payment language — in ANY language. Look for: personal pronouns + product name + positive sentiment + no code/affiliate language.

          is_organic = false when there is a code, affiliate link, "sponsored by" or equivalent in any language.
          
          promo_code: 2-12 chars only. NOT video IDs, generic words, URLs.
         exact_quote: Must be an actual sentence about the brand, not a link label or list heading (e.g. never just "Brand Name:"). Remove URLs. Keep readable. Translate to English if non-English. If nothing in the text is a real sentence, use null.
          
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
${content.rawText.slice(0, 6000)}`
        }
      ],
      temperature: 0.05,
      max_tokens: 1200,
    })
    const raw = completion.choices[0].message.content?.trim() || '[]'
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
    if (!Array.isArray(parsed)) return []
    const VALID_CATEGORIES = new Set(['Tech', 'Finance', 'Health', 'Lifestyle', 'Education', 'Gaming', 'Beauty', 'Food'])
    return parsed
    .filter(s => s.confidence >= 0.85 && s.brand?.length > 1 && !isBlockedBrand(s.brand) && !isSelfPromotion(content.creatorName, s.brand))
      .map(s => ({
        ...s,
        promo_code: isValidCode(s.promo_code) ? s.promo_code.toUpperCase() : null,
        exact_quote: cleanQuote(s.exact_quote),
        offer_text: s.offer_text?.slice(0, 100) || null,
        brand_category: VALID_CATEGORIES.has(s.brand_category) ? s.brand_category : null,
        brand_description: typeof s.brand_description === 'string' ? s.brand_description.trim().slice(0, 120) || null : null,
        product_mentioned: typeof s.product_mentioned === 'string' ? s.product_mentioned.trim().slice(0, 80) || null : null,
        product_source: (() => {
          const mentioned = typeof s.product_mentioned === 'string' ? s.product_mentioned.trim() : ''
          if (!mentioned) return null
          return s.product_source === 'comment_confirmed' ? 'comment_confirmed' : 'creator_stated'
        })(),
        dar_score: computeDAR(s),
        dar_source: 'ai_extracted',
      }))
  } catch (err) {
    console.log(`    ✗ extractFromContent error: ${err.message}`)
    return []
  }
}
// ─── Brand collab detector (Path A — shadow mode, logs only, never surfaced) ──
let collabBrandMap = null // lowercase name -> id
let collabPattern = null

// Short brand names and common English words that happen to also be real brand
// names (Fin, MAC, Box, Crew, Share...) generate near-100% false-positive rates
// in the collab regex — either matching as generic substrings inside unrelated
// words ("MAC" inside "macy") or matching plain English sentences ("finally
// collab with the crew"). Excluded from collab-candidate eligibility entirely.
const COLLAB_MIN_NAME_LENGTH = 5
const COLLAB_GENERIC_WORDS = new Set([
  'crew', 'share', 'change', 'face', 'play', 'game', 'games', 'deal', 'shop',
  'store', 'life', 'live', 'team', 'club', 'plus', 'pro', 'home', 'love',
  'care', 'link', 'code', 'free', 'main', 'post', 'news', 'show', 'talk',
  'chat', 'fund', 'bank', 'card', 'cash', 'wave', 'wire', 'app', 'tech',
  'data', 'cloud', 'box', 'fin', 'mac', 'reddit', 'video', 'music', 'sound',
])

async function loadCollabDetector() {
  if (collabPattern) return
  const { data: brands } = await supabase.from('brands').select('id, name')
  const names = (brands || []).filter(b =>
    b.name &&
    b.name.length >= COLLAB_MIN_NAME_LENGTH &&
    !COLLAB_GENERIC_WORDS.has(b.name.toLowerCase())
  )
  collabBrandMap = new Map(names.map(b => [b.name.toLowerCase(), b.id]))
  const sortedNames = names.map(b => b.name).sort((a, b) => b.length - a.length)
  const escaped = sortedNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  // Word boundaries (\b) on both the brand names AND the "x" separator prevent
  // matches fragmenting inside a longer word — "Xbox" can no longer be read as
  // brand "X" (if it existed) plus separator "x" plus brand "box".
  collabPattern = new RegExp(
    `\\b(${escaped.join('|')})\\b` +
    `\\s*(?:\\bx\\b|×|.{0,20}(?:collab|collaboration|teamed up with|limited edition with).{0,20})\\s*` +
    `\\b(${escaped.join('|')})\\b`,
    'gi'
  )
  console.log(`  🔗 Collab detector loaded: ${names.length} eligible brands (${(brands || []).length - names.length} excluded as too short/generic)`)
}

async function detectAndLogCollabs(content, creatorId) {
  try {
    if (!content.rawText || content.rawText.length < 20) return
    await loadCollabDetector()
    const matches = [...content.rawText.matchAll(collabPattern)]
    for (const m of matches) {
      const nameA = m[1].toLowerCase()
      const nameB = m[2].toLowerCase()
      if (nameA === nameB) continue
      const brandAId = collabBrandMap.get(nameA)
      const brandBId = collabBrandMap.get(nameB)
      if (!brandAId || !brandBId) continue
      await supabase.from('brand_collabs').upsert({
        brand_a_id: brandAId,
        brand_b_id: brandBId,
        detected_from: 'pipeline_regex',
        source_content_url: normalizeUrl(content.mediaUrl),
        source_creator_id: creatorId,
        exact_quote: m[0].slice(0, 200),
        confidence: 0.6,
        last_seen: new Date().toISOString(),
        is_active: false,
      }, { onConflict: 'brand_a_id,brand_b_id,detected_from' })
      console.log(`  🔗 Collab candidate logged: "${m[1]}" x "${m[2]}" (shadow mode)`)
    }
  } catch (err) {
    console.log(`  ✗ Collab detection error: ${err.message}`)
  }
}

// ─── Database write ────────────────────────────────────────
export async function saveToDatabase(content, sponsors, creatorId) {
  let saved = 0
  await detectAndLogCollabs(content, creatorId)
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
  
        // Generate an embedding for a brand new to the table, or one that just got its
        // first real description filled in (better embedding input than name alone).
        if (!brandData.embedding && (s.brand_description || brandData.name)) {
          try {
            const input = `${brandData.name}. ${s.brand_description || brandData.description || ''}`.trim()
            const embeddingRes = await openai.embeddings.create({ model: 'text-embedding-3-small', input })
            await supabase.from('brands')
              .update({ embedding: embeddingRes.data[0].embedding })
              .eq('id', brandData.id)
              .is('embedding', null)
          } catch { /* non-critical — semantic search just won't cover this brand yet */ }
        }
    
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

      // First real description wins — a plain "what is this" for someone who's never
      // heard of the brand. Never overwritten once set, so it doesn't flip-flop.
      if (!brandData.description && s.brand_description) {
        await supabase.from('brands')
          .update({ description: s.brand_description })
          .eq('id', brandData.id)
          .is('description', null)
      }
  
      // ── URL integrity checkpoint ──────────────────────────────────
      // Every URL saved to the DB (brand homepage, product link, promo/tracking link)
      // passes through here. Extraction — regex or AI — only ever produces a
      // CANDIDATE; nothing gets saved as truth until it resolves live via HEAD.
      // If you add a new URL field anywhere in this pipeline, it goes through
      // verifyUrlLive() before it touches the database. No exceptions — an
      // unverified link on a live card is a trust failure, not a cosmetic bug.
      let brandUrl = extractBrandUrl(content.rawText, s.brand)
    if (brandUrl) {
      brandUrl = await verifyUrlLive(brandUrl)
    }
    if (!brandUrl) {
      brandUrl = await verifyBrandDomain(s.brand)
    }
    let productUrl = extractProductUrl(content.rawText, s.brand)
    if (productUrl) {
      productUrl = await verifyUrlLive(productUrl)
    }
    let promoUrl = normalizeUrl(s.promo_url)
    if (promoUrl) {
      promoUrl = await verifyUrlLive(promoUrl)
    }
    // ── end URL integrity checkpoint ────────────────────────────────
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
        promo_url: promoUrl,
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
        product_mentioned: s.product_mentioned || null,
        product_url: productUrl,
        product_source: s.product_source || null,
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
    'sneaker review', 'streetwear haul', 'sneaker unboxing', 'sneaker collab',
    'luxury watch collector', 'designer collab unboxing', 'streetwear fashion',
  ]
  const channels = []
  for (const cat of categories) {
    if (totalQuotaUsed() > totalQuotaLimit() * 0.15) break // stop at 15% quota used
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
    if (totalQuotaUsed() > totalQuotaLimit() * 0.2) break
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
    if (totalQuotaUsed() > totalQuotaLimit() * 0.22) break
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
    if (totalQuotaUsed() > totalQuotaLimit() * 0.25) break
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
    if (totalQuotaUsed() > totalQuotaLimit() * 0.27) break
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
      if (totalQuotaUsed() > totalQuotaLimit() * 0.3) break
    const results = await searchYouTubeChannels(`${cat} youtube creator`, 3)
      channels.push(...results.filter(c => !knownIds.has(c.channelId)))
      await new Promise(r => setTimeout(r, 150))
    }
    if (channels.length) console.log(`     ${channels.length} from gap fill (${underserved.join(', ')})`)
    return channels
  } catch { return [] }
}

export async function getYouTubeVideos(channelId, max = VIDEOS_PER_CREATOR) {
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
  // ─── YouTube comments ──────────────────────────────────────
  async function getVideoComments(videoId, creatorChannelId) {
    try {
      const active = getActiveKey()
      if (!active || !useQuotaForKey(active.index, 1)) return { text: null, creatorReplies: null }
      const url = `https://www.googleapis.com/youtube/v3/commentThreads?key=${active.key}&videoId=${videoId}&part=snippet,replies&maxResults=30&order=relevance`
      const res = await fetch(url)
      const data = await res.json()
      if (data.error || !data.items?.length) return { text: null, creatorReplies: null }

      const commentLines = []
      const creatorReplyLines = []

      for (const item of data.items) {
        const topSnippet = item.snippet?.topLevelComment?.snippet
        const topText = topSnippet?.textDisplay || ''
        if (topText.length > 10 && topText.length < 300) {
          commentLines.push(topText)
        }

        // commentThreads returns up to a handful of replies inline when part=replies is set —
        // check each for one authored by the video's own channel (a genuine creator confirmation,
        // not a viewer guess).
        const replies = item.replies?.comments || []
        for (const reply of replies) {
          const replySnippet = reply.snippet
          const isCreatorReply = creatorChannelId && replySnippet?.authorChannelId?.value === creatorChannelId
          const replyText = replySnippet?.textDisplay || ''
          if (isCreatorReply && replyText.length > 5 && replyText.length < 300) {
            creatorReplyLines.push(`Viewer asked: "${topText.slice(0, 150)}" — Creator replied: "${replyText}"`)
          }
        }
      }

      return {
        text: commentLines.slice(0, 20).join('\n') || null,
        creatorReplies: creatorReplyLines.slice(0, 10).join('\n') || null,
      }
    } catch { return { text: null, creatorReplies: null } }
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
 export async function buildVideoContext(video, creatorName) {
  const videoId = video.id
  const description = video.snippet?.description || ''
  const title = video.snippet?.title || ''
  const channelId = video.snippet?.channelId || null
  const chapters = extractChapters(video)

  // Fetch comments and transcript in parallel
  const [commentData, transcript] = await Promise.all([
    getVideoComments(videoId, channelId),
    getVideoTranscript(videoId),
  ])

  const parts = []
  parts.push(`TITLE: ${title}`)
  parts.push(`\nDESCRIPTION:\n${description.slice(0, 1500)}`)
  if (chapters) parts.push(`\nCHAPTERS:\n${chapters}`)
  if (transcript) parts.push(`\nTRANSCRIPT (partial):\n${transcript}`)
  if (commentData.creatorReplies) parts.push(`\nCREATOR REPLIES TO VIEWER QUESTIONS (these ARE the creator's own words):\n${commentData.creatorReplies}`)
  if (commentData.text) parts.push(`\nVIEWER COMMENTS (NOT the creator's own words — never source product_mentioned from this section alone):\n${commentData.text}`)

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

  const byRelatedTagged = byRelated.map(c => ({ ...c, source: 'related' }))

  const seen = new Set()
  const allCandidates = [...byCategory, ...byPopularity, ...byBrand, ...byRelatedTagged, ...byTrends, ...byGapFill]
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

  // Always process high-value sneaker/streetwear YouTube channels — same
  // unconditional pattern as podcasts, so it isn't starved by quota pressure
  // elsewhere. Seeded directly rather than discovered via category search,
  // since generic keyword search wasn't surfacing this niche reliably.
  console.log('  👟 Processing sneaker/streetwear YouTube channels...')
  for (const channel of SNEAKER_YOUTUBE_CHANNELS) {
    if (totalQuotaUsed() > totalQuotaLimit() * 0.55) break
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
      console.log(`  👟 Added sneaker/streetwear channel: ${channel.name}`)
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
  let nicheAccepted = 0
  for (const candidate of allCandidates) {
    if (creators >= maxCreators) break
    if (!candidate.channelId || knownIds.has(candidate.channelId)) continue
    if (totalQuotaUsed() > totalQuotaLimit() * 0.8) {
      console.log(`  ⚠️  Quota limit approaching — stopping new creator discovery`)
      break
    }

    const isNicheEligible = candidate.source === 'related' && nicheAccepted < MAX_NICHE_PER_RUN
    const floor = isNicheEligible ? NICHE_MIN_SUBSCRIBERS : MIN_SUBSCRIBERS

    const stats = await getYouTubeChannelStats(candidate.channelId)
    if (!stats || stats.subscribers < floor) continue
    if (isNicheEligible && stats.subscribers < MIN_SUBSCRIBERS) nicheAccepted++

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
    .limit(40)

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

async function getRotatingPodcastSeeds(count = 40) {
  const { data: candidates } = await supabase
    .from('podcast_seed_terms')
    .select('id, term')
    .order('used_at', { ascending: true, nullsFirst: true })
    .limit(count)
  
  let terms = (candidates || []).map(t => t.term)
  const usedIds = (candidates || []).map(t => t.id)
  
  const genCount = 5
  {
    const needed = genCount
    const { data: existingTerms } = await supabase.from('podcast_seed_terms').select('term')
  const existingSet = new Set((existingTerms || []).map(t => t.term.toLowerCase()))
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: `Generate ${needed} genuinely niche, specific podcast topic search terms — the kind that surface small, independent shows on Apple Podcasts, not major mainstream ones. Think narrow hobbies, specific professions, or micro-communities (e.g. "vintage synthesizer collecting", "urban beekeeping", "solo restaurant ownership"). Return ONLY a JSON array of strings, no other text.`
      }],
      temperature: 0.9,
      max_tokens: 500,
    })
    const raw = completion.choices[0].message.content?.trim() || '[]'
    const generated = JSON.parse(raw.replace(/```json|```/g, '').trim())
    const newTerms = (Array.isArray(generated) ? generated : [])
      .filter(t => typeof t === 'string' && t.length > 3 && !existingSet.has(t.toLowerCase()))
      .slice(0, needed)
    if (newTerms.length) {
      const { data: inserted } = await supabase
        .from('podcast_seed_terms')
        .insert(newTerms.map(term => ({ term, source: 'ai_generated' })))
        .select('id, term')
      terms = [...terms, ...(inserted || []).map(t => t.term)]
      usedIds.push(...(inserted || []).map(t => t.id))
      console.log(`  🤖 Generated ${newTerms.length} new podcast seed terms via AI`)
    }
  } catch (err) {
    console.log(`  ✗ Seed generation error: ${err.message}`)
  }
}

if (usedIds.length) {
  await supabase.from('podcast_seed_terms').update({ used_at: new Date().toISOString() }).in('id', usedIds)
}

return terms
}

async function discoverPodcasts(maxNew = 50) {
const { data: existing } = await supabase.from('creators').select('name').eq('platform', 'podcast')
const known = new Set((existing || []).map(c => c.name.toLowerCase()))
const discovered = [...BOOTSTRAP_PODCASTS.filter(p => !known.has(p.name.toLowerCase()))]

const seedTerms = await getRotatingPodcastSeeds(40)
console.log(`  🔄 Using ${seedTerms.length} rotating seed terms this run`)

for (const term of seedTerms) {
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
      discovered.push({ name: pod.trackName, rss: pod.feedUrl, category: pod.primaryGenreName || term })
      known.add(pod.trackName?.toLowerCase())
    }
    await new Promise(r => setTimeout(r, 200))
  } catch {}
}

  console.log(`  📋 ${discovered.length} podcasts to process`)
  return discovered
}

export async function parsePodcastRSS(podcast, maxEpisodes = 20) {
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
      if (items.length >= maxEpisodes) break
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
  
      const newPodcasts = await discoverPodcasts(100)
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
          safeISOString(ep.pubDate), 'audio'
        )
        const sponsors = await extractFromContent(content)
        total += await saveToDatabase(content, sponsors, creatorData.id)
        await new Promise(r => setTimeout(r, 200))
      }
      await new Promise(r => setTimeout(r, 300))
    }
  
    // Re-process existing podcasts for new episodes — same pattern as YouTube
    const fourDaysAgoMs = Date.now() - 4 * 86400000
    const { data: podcastCandidates } = await supabase
    .from('creators')
    .select('id, name, slug, rss_url, last_scraped_at')
    .eq('platform', 'podcast')
    .not('rss_url', 'is', null)
    .order('last_scraped_at', { ascending: true, nullsFirst: true })
    .limit(250)

  const existingPodcasts = (podcastCandidates || [])
    .filter(c => !c.last_scraped_at || new Date(c.last_scraped_at).getTime() < fourDaysAgoMs)
    .slice(0, 60)

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
          safeISOString(ep.pubDate), 'audio'
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

async function getNewsletterDiscoveryState() {
  const { data } = await supabase.from('newsletter_discovery_state').select('*').eq('id', 1).single()
  return data || { best_listing_page: 0, category_index: 0, category_page: 2 }
}

async function advanceNewsletterDiscoveryState(state) {
  const nextBestPage = (state.best_listing_page + 1) % 20
  const nextCategoryIndex = (state.category_index + 1) % 4
  const nextCategoryPage = nextCategoryIndex === 0 ? state.category_page + 1 : state.category_page
  await supabase.from('newsletter_discovery_state').update({
    best_listing_page: nextBestPage,
    category_index: nextCategoryIndex,
    category_page: nextCategoryPage,
    updated_at: new Date().toISOString(),
  }).eq('id', 1)
}

async function discoverNewsletters() {
  const { data: existing } = await supabase.from('creators').select('name').eq('platform', 'newsletter')
  const known = new Set((existing || []).map(c => c.name.toLowerCase()))
  const discovered = [...NEWSLETTER_BOOTSTRAP.filter(n => !known.has(n.name.toLowerCase()))]

  const state = await getNewsletterDiscoveryState()
  const NICHE_CATEGORIES = [
    { id: 4, label: 'Technology' }, { id: 11, label: 'Culture/Music' },
    { id: 18, label: 'History' }, { id: 34, label: 'Education' },
  ]

  try {
    const res = await fetch(`https://substack.com/api/v1/publication/best?page=${state.best_listing_page}&limit=25`, { headers: { 'User-Agent': 'ThatsTheOne/1.0' } })
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

  const cat = NICHE_CATEGORIES[state.category_index]
  try {
    const res = await fetch(`https://substack.com/api/v1/category/public/${cat.id}/all?page=${state.category_page}`, { headers: { 'User-Agent': 'ThatsTheOne/1.0' } })
    if (res.ok) {
      const data = await res.json()
      const pubs = data?.publications || data || []
      let categoryFound = 0
      for (const pub of pubs) {
        const name = pub.name || pub.title
        const subdomain = pub.subdomain
        if (!name || !subdomain || known.has(name.toLowerCase())) continue
        discovered.push({ name, url: `https://${subdomain}.substack.com/feed`, category: pub.category_name || cat.label })
        known.add(name.toLowerCase())
        categoryFound++
      }
      console.log(`  🎯 ${cat.label} category (page ${state.category_page}): ${categoryFound} new candidates`)
    }
  } catch {}

  await advanceNewsletterDiscoveryState(state)

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
      .limit(40)
  
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
// CONNECTOR 6 — Linktree
// ═══════════════════════════════════════════════════════════

const LINKTREE_SKIP_DOMAINS = new Set([
  'youtube.com', 'youtu.be', 'instagram.com', 'twitter.com', 'x.com',
  'tiktok.com', 'facebook.com', 'linkedin.com', 'spotify.com', 'apple.com',
  'podcasts.apple.com', 'open.spotify.com', 'discord.gg', 'discord.com',
  'twitch.tv', 'patreon.com', 'ko-fi.com', 'buymeacoffee.com',
  'linktr.ee', 'linktree.com', 'beacons.ai', 'bio.link', 'allmylinks.com',
  'google.com', 'gmail.com', 'docs.google.com', 'forms.gle',
  'cameo.com', 'substack.com', 'medium.com', 'wordpress.com',
  'shopify.com', 'etsy.com', 'ebay.com',
  'bit.ly', 'tinyurl.com', 'ow.ly', 'buff.ly', 'lnk.to',
  'amzn.to',
  'snipfeed.co', 'stan.store', 'gumroad.com', 'teachable.com',
  'soundcloud.com', 'bandcamp.com', 'anchor.fm', 'buzzsprout.com',
  'depop.com', 'poshmark.com', 'vinted.com',
  'threads.net', 'pinterest.com', 'tumblr.com',
  'whatsapp.com', 'telegram.org', 't.me',
  'paypal.com', 'venmo.com', 'cashapp.com',
  'streamlabs.com', 'streamelements.com',
  'fonts.googleapis.com', 'fonts.gstatic.com',
  'yahoo.com', 'cbsn.lvstreamhd.com',
  'geni.us', 'ntck.co', 'ban.ggood.vip',
  'eventbrite.com', 'eventbrite.co.uk',
  'publishing.andrewsmcmeel.com',
  'theplug.co', 'kingoftheclicks.com',
  'raidcoins.com', 'posh.mk',
  'whenweallvote.org', 'discoveryplus.com', 'beatstars.com',
  'deezer.com', 'link.deezer.com',
  'music.amazon.com', 'music.heardwell.com',
  'tr.ee', 'target.com', 'walmart.com', 'udemy.com',
])

function getLinktreeDomain(url) {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, '').toLowerCase()
  } catch { return null }
}

function shouldSkipLinktreeDomain(domain) {
  if (!domain) return true
  if (domain.length < 4) return true
  for (const skip of LINKTREE_SKIP_DOMAINS) {
    if (domain === skip || domain.endsWith(`.${skip}`)) return true
  }
  const parts = domain.split('.')
  if (parts.length > 2) {
    const apex = parts.slice(-2).join('.')
    if (LINKTREE_SKIP_DOMAINS.has(apex)) return true
  }
  return false
}

function domainToBrandName(domain) {
  const name = domain.split('.')[0]
  if (!name || name.length < 2) return null
  if (name.includes('-')) {
    return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }
  if (/[a-z][A-Z]/.test(name)) return name
  if (name.length <= 4 && name === name.toUpperCase()) return name.toUpperCase()
  return name.charAt(0).toUpperCase() + name.slice(1)
}

async function fetchLinktree(creatorName) {
  const variants = [
    creatorName.replace(/\s+/g, ''),
    creatorName.toLowerCase().replace(/\s+/g, ''),
    creatorName.toLowerCase().replace(/[^a-z0-9]/g, ''),
    creatorName.toLowerCase().replace(/\s+/g, '_'),
    creatorName.toLowerCase().replace(/\s+/g, '-'),
  ]
  for (const variant of [...new Set(variants)]) {
    const url = `https://linktr.ee/${variant}`
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
      })
      if (!res.ok) continue
      const html = await res.text()
      if (html.includes('"statusCode":404')) continue
      if (html.length < 1000) continue
      if (!html.includes('linktr.ee') && !html.includes('__NEXT_DATA__')) continue
      return { html, url }
    } catch {}
    await new Promise(r => setTimeout(r, 500))
  }
  return null
}

function extractLinksFromHtml(html) {
  const links = []
  const seen = new Set()
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1])
      const possibleLinkArrays = [
        nextData?.props?.pageProps?.account?.links,
        nextData?.props?.pageProps?.links,
        nextData?.props?.pageProps?.data?.account?.links,
        nextData?.props?.pageProps?.data?.links,
      ]
      for (const arr of possibleLinkArrays) {
        if (!Array.isArray(arr)) continue
        for (const link of arr) {
          const url = link?.url || link?.href || link?.destination
          const title = link?.title || link?.label || link?.name || ''
          if (url && !seen.has(url)) { seen.add(url); links.push({ url, title }) }
        }
      }
    } catch {}
  }
  if (links.length === 0) {
    const hrefPattern = /href="(https?:\/\/[^"#\s]{8,}?)"/g
    let match
    while ((match = hrefPattern.exec(html)) !== null) {
      const url = match[1]
      if (!seen.has(url)) { seen.add(url); links.push({ url, title: '' }) }
    }
  }
  return links
}

async function saveLinktreeData(creator, links) {
  let saved = 0
  const brandLinks = []

  for (const { url, title } of links) {
    const domain = getLinktreeDomain(url)
    if (!domain || shouldSkipLinktreeDomain(domain)) continue
    if (url.includes('amazon.com/shop') || url.includes('amazon.co.uk/shop')) {
      await supabase.from('creators').update({ amazon_storefront_url: url }).eq('id', creator.id)
      console.log(`    🛒 Amazon storefront saved: ${url}`)
      continue
    }
    const brandName = domainToBrandName(domain)
    if (!brandName || brandName.length < 2) continue
    const creatorSlugClean = creator.slug.replace(/-/g, '')
    if (domain.includes(creatorSlugClean) || domain.includes(creator.name.toLowerCase().replace(/\s+/g, ''))) continue
    brandLinks.push({ url, title, brandName, domain })
  }

  if (brandLinks.length === 0) return 0
  console.log(`  🔗 ${brandLinks.length} brand links extracted`)

  for (const { url, title, brandName, domain } of brandLinks) {
    const slug = makeSlug(brandName)
    if (!slug) continue

    const { data: brandData } = await supabase
      .from('brands')
      .upsert({ name: brandName, slug, website_url: `https://${domain}` }, { onConflict: 'slug' })
      .select().single()
    if (!brandData) continue

    if (!brandData.website_url) {
      await supabase.from('brands').update({ website_url: `https://${domain}` }).eq('id', brandData.id)
    }

    // Same embedding-generation pattern used for brands discovered elsewhere,
    // so Linktree-sourced brands are also covered by semantic search.
    if (!brandData.embedding) {
      try {
        const input = `${brandData.name}. ${brandData.description || ''}`.trim()
        const embeddingRes = await openai.embeddings.create({ model: 'text-embedding-3-small', input })
        await supabase.from('brands')
          .update({ embedding: embeddingRes.data[0].embedding })
          .eq('id', brandData.id)
          .is('embedding', null)
      } catch {}
    }

    const videoId = `linktree_${creator.slug}_${slug}`.slice(0, 200)
    const quote = title?.length > 3
      ? `${creator.name} features "${title}" on their Linktree`
      : `${creator.name} links to ${brandName} on their Linktree`
    const headline = title?.length > 3
      ? `${creator.name} permanently features ${brandName} — "${title.slice(0, 40)}"`
      : `${creator.name} links to ${brandName} from their Linktree`

    const { error } = await supabase
      .from('sponsorships')
      .upsert({
        creator_id: creator.id,
        brand_id: brandData.id,
        sponsorship_type: 'url',
        is_organic: true,
        platform: 'linktree',
        video_id: videoId,
        video_title: `Linktree — ${title || brandName}`,
        exact_quote: quote,
        promo_url: url,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        is_active: true,
        dar_score: 62,
        dar_source: 'linktree',
        headline,
      }, { onConflict: 'video_id,brand_id' })

    if (!error) {
      saved++
      console.log(`    🌱 ${brandName} (${domain}) → ${title || url.slice(0, 50)}`)
    }
  }
  return saved
}

async function runLinktree() {
  console.log('\n🌳 Linktree connector starting...')
  const { data: creators } = await supabase
    .from('creators')
    .select('id, name, slug, subscriber_count')
    .eq('platform', 'youtube')
    .order('subscriber_count', { ascending: false, nullsFirst: false })
    .limit(60)

  let found = 0
  let totalSaved = 0

  for (const creator of (creators || [])) {
    const result = await fetchLinktree(creator.name)
    if (!result) {
      await new Promise(r => setTimeout(r, 500))
      continue
    }
    found++
    const links = extractLinksFromHtml(result.html)
    totalSaved += await saveLinktreeData(creator, links)
    await new Promise(r => setTimeout(r, 1000))
  }

  console.log(`  ✓ Linktree: ${found} profiles found, ${totalSaved} sponsorships`)
  return totalSaved
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
    const gamesRes = await fetch('https://api.twitch.tv/helix/games/top?first=25', { headers })
    const gamesData = await gamesRes.json()
    const games = gamesData.data || []

    for (const game of games) {
      const streamsRes = await fetch(`https://api.twitch.tv/helix/streams?game_id=${game.id}&first=100`, { headers })
      const streamsData = await streamsRes.json()
      const pool = (streamsData.data || []).filter(s => (s.viewer_count || 0) >= 500)
      if (pool.length) console.log(`  🎮 ${game.name}: ${pool.length} streams above 500 viewers`)
      const streams = pool.sort(() => Math.random() - 0.5).slice(0, 12)

      for (const stream of streams) {
        const userRes = await fetch(`https://api.twitch.tv/helix/users?id=${stream.user_id}`, { headers })
        const userData = await userRes.json()
        const user = userData.data?.[0]
        if (!user) continue

        const channelRes = await fetch(`https://api.twitch.tv/helix/channels?broadcaster_id=${stream.user_id}`, { headers })
        const channelData = await channelRes.json()
        const channel = channelData.data?.[0]

        const followersRes = await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${stream.user_id}`, { headers })
        const followersData = await followersRes.json()
        const followerCount = followersData.total ?? null

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
            subscriber_count: followerCount,
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
    linktree: await runLinktree(),
  }

  // Update brand velocity scores
  await supabase.rpc('compute_brand_velocity').then(() => {
    console.log('\n📊 Brand velocity scores updated')
  }).catch(() => {})

  console.log('\n📰 Backfilling missing headlines...')
  const { data: missingHeadlines } = await supabase
    .from('sponsorships')
    .select('id, promo_code, promo_url, offer_text, exact_quote, sponsorship_type, platform, brands(name), creators(name)')
    .is('headline', null)
    .limit(200)
  let headlinesFilled = 0
  for (const s of (missingHeadlines || [])) {
    const headline = await generateHeadline(
      s.brands?.name || 'Unknown', s.creators?.name || 'A creator',
      s.sponsorship_type, s.offer_text, s.promo_code, s.exact_quote, s.platform
    )
    if (headline) {
      await supabase.from('sponsorships').update({ headline }).eq('id', s.id)
      headlinesFilled++
    }
    await new Promise(r => setTimeout(r, 100))
  }
  console.log(`  ✓ ${headlinesFilled} headlines generated (${(missingHeadlines || []).length} were missing)`)

  console.log('\n🔍 Checking for data contamination...')
  const { data: contamResult } = await supabase.rpc('detect_contamination', { run_started_at: new Date(start).toISOString() })
  const flaggedCount = contamResult?.[0]?.flagged_count || 0
  if (flaggedCount > 0) {
    console.log(`  ⚠️  ${flaggedCount} sponsorship(s) flagged for review — check the flagged_sponsorships table`)
  } else {
    console.log(`  ✓ No contamination detected this run`)
  }

  const total = Object.values(results).reduce((a, b) => a + b, 0)

  console.log(`\n${'═'.repeat(55)}`)
  console.log(`✅ Pipeline complete in ${timeAgo(Date.now() - start)}`)
  console.log(`   YouTube:     ${results.youtube} sponsorships`)
  console.log(`   Podcasts:    ${results.podcasts} sponsorships`)
  console.log(`   Reddit:      ${results.reddit} sponsorships`)
  console.log(`   Newsletters: ${results.newsletters} sponsorships`)
  console.log(`   Twitch:      ${results.twitch} sponsorships`)
  console.log(`   Linktree:    ${results.linktree} sponsorships`)
  console.log(`   Total:       ${total} sponsorships`)
  console.log(`   YT Quota:    ~${totalQuotaUsed()} / ${totalQuotaLimit()} units used (single project)`)
  console.log(`   Trend seeds: ${trendSeeds.length} active this run`)
  console.log(`${'═'.repeat(55)}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch(console.error)
}