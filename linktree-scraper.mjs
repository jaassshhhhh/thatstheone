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

// Domains that are never brands — platforms, utilities, noise
const SKIP_DOMAINS = new Set([
  'youtube.com', 'youtu.be', 'instagram.com', 'twitter.com', 'x.com',
  'tiktok.com', 'facebook.com', 'linkedin.com', 'spotify.com', 'apple.com',
  'podcasts.apple.com', 'open.spotify.com', 'discord.gg', 'discord.com',
  'twitch.tv', 'patreon.com', 'ko-fi.com', 'buymeacoffee.com',
  'linktr.ee', 'linktree.com', 'beacons.ai', 'bio.link', 'allmylinks.com',
  'google.com', 'gmail.com', 'docs.google.com', 'forms.gle',
  'cameo.com', 'substack.com', 'medium.com', 'wordpress.com',
  'shopify.com', 'etsy.com', 'ebay.com', // marketplace platforms not brands
  'bit.ly', 'tinyurl.com', 'ow.ly', 'buff.ly', 'lnk.to',
  'amzn.to', // affiliate shortlinks — we handle amazon.com/shop separately
  'snipfeed.co', 'stan.store', 'gumroad.com', 'teachable.com',
  'soundcloud.com', 'bandcamp.com', 'anchor.fm', 'buzzsprout.com',
  'depop.com', 'poshmark.com', 'vinted.com',
  'threads.net', 'pinterest.com', 'tumblr.com',
  'whatsapp.com', 'telegram.org', 't.me',
  'paypal.com', 'venmo.com', 'cashapp.com',
  'streamlabs.com', 'streamelements.com',
  'fonts.googleapis.com', 'fonts.gstatic.com',
'yahoo.com',
'cbsn.lvstreamhd.com','fonts.googleapis.com', 'fonts.gstatic.com',
'geni.us', 'ntck.co', 'ban.ggood.vip',
'eventbrite.com', 'eventbrite.co.uk',
'publishing.andrewsmcmeel.com',
'cbsn.lvstreamhd.com',
'theplug.co', 'kingoftheclicks.com',
'raidcoins.com',
])

function getDomainFromUrl(url) {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, '').toLowerCase()
  } catch { return null }
}

function shouldSkipDomain(domain) {
  if (!domain) return true
  if (domain.length < 4) return true
  // Skip any domain in the blocklist
  for (const skip of SKIP_DOMAINS) {
    if (domain === skip || domain.endsWith(`.${skip}`)) return true
  }
  // Skip subdomains of skipped domains
  const parts = domain.split('.')
  if (parts.length > 2) {
    const apex = parts.slice(-2).join('.')
    if (SKIP_DOMAINS.has(apex)) return true
  }
  return false
}

// Convert a domain to a clean brand name dynamically
// e.g. nordvpn.com → NordVPN, ag1.com → AG1, hello-fresh.com → Hello Fresh
function domainToBrandName(domain) {
  // Strip TLD
  const name = domain.split('.')[0]
  if (!name || name.length < 2) return null

  // Handle common patterns
  // all-lowercase with hyphens → Title Case With Spaces
  if (name.includes('-')) {
    return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  // CamelCase detection — if it looks like camelCase keep it
  if (/[a-z][A-Z]/.test(name)) return name

  // ALL CAPS short names stay caps (AG1, VPN, etc)
  if (name.length <= 4 && name === name.toUpperCase()) return name.toUpperCase()

  // Otherwise title case
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
      // Must have Linktree markers
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

  // Primary: extract from Next.js __NEXT_DATA__ JSON
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
          if (url && !seen.has(url)) {
            seen.add(url)
            links.push({ url, title })
          }
        }
      }
    } catch {}
  }

  // Fallback: extract all href links from HTML
  if (links.length === 0) {
    const hrefPattern = /href="(https?:\/\/[^"#\s]{8,}?)"/g
    let match
    while ((match = hrefPattern.exec(html)) !== null) {
      const url = match[1]
      if (!seen.has(url)) {
        seen.add(url)
        links.push({ url, title: '' })
      }
    }
  }

  return links
}

async function saveLinktreeData(creator, links, linktreeUrl) {
  let saved = 0
  const brandLinks = []

  for (const { url, title } of links) {
    const domain = getDomainFromUrl(url)
    if (!domain || shouldSkipDomain(domain)) continue

    // Handle Amazon storefronts specially
    if (url.includes('amazon.com/shop') || url.includes('amazon.co.uk/shop')) {
      await supabase.from('creators')
        .update({ amazon_storefront_url: url })
        .eq('id', creator.id)
      console.log(`    🛒 Amazon storefront saved: ${url}`)
      continue
    }

    // Dynamically derive brand name from domain
    const brandName = domainToBrandName(domain)
    if (!brandName || brandName.length < 2) continue
    // Skip creator's own domain
const creatorSlugClean = creator.slug.replace(/-/g, '')
if (domain.includes(creatorSlugClean) || domain.includes(creator.name.toLowerCase().replace(/\s+/g, ''))) continue

    brandLinks.push({ url, title, brandName, domain })
  }

  if (brandLinks.length === 0) {
    console.log(`  ⚠️  No brand links found`)
    return 0
  }

  console.log(`  🔗 ${brandLinks.length} brand links extracted`)

  for (const { url, title, brandName, domain } of brandLinks) {
    const slug = brandName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    if (!slug) continue

    // Upsert brand dynamically — no hardcoding required
    const { data: brandData } = await supabase
      .from('brands')
      .upsert({
        name: brandName,
        slug,
        website_url: `https://${domain}`,
      }, { onConflict: 'slug' })
      .select().single()
    if (!brandData) continue

    // Only set website_url if not already set
    if (!brandData.website_url) {
      await supabase.from('brands')
        .update({ website_url: `https://${domain}` })
        .eq('id', brandData.id)
    }

    // Save as organic sponsorship
    // Linktree links = creator's curated permanent brand associations
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

async function run() {
  console.log('\n═══════════════════════════════════════════════════════')
  console.log(`🌳 Linktree Scraper — ${new Date().toISOString()}`)
  console.log('   Fully dynamic brand extraction — no hardcoding')
  console.log('═══════════════════════════════════════════════════════')

  // Process all YouTube creators ordered by subscriber count
  const { data: creators } = await supabase
    .from('creators')
    .select('id, name, slug, subscriber_count')
    .eq('platform', 'youtube')
    .order('subscriber_count', { ascending: false, nullsFirst: false })
    .limit(200)

  console.log(`📚 Checking ${(creators || []).length} creators for Linktrees\n`)

  let found = 0
  let totalSaved = 0

  for (const creator of (creators || [])) {
    const result = await fetchLinktree(creator.name)

    if (!result) {
      process.stdout.write(`  ✗ ${creator.name}                    \r`)
      await new Promise(r => setTimeout(r, 800))
      continue
    }

    found++
    console.log(`\n✓ ${creator.name} → ${result.url}`)

    const links = extractLinksFromHtml(result.html)
    const saved = await saveLinktreeData(creator, links, result.url)
    totalSaved += saved

    // Respectful rate limiting
    await new Promise(r => setTimeout(r, 1500))
  }

  console.log('\n\n═══════════════════════════════════════════════════════')
  console.log(`✅ Linktree scraper complete`)
  console.log(`   Linktrees found:   ${found} / ${(creators || []).length}`)
  console.log(`   Brand links saved: ${totalSaved}`)
  console.log('═══════════════════════════════════════════════════════')
}

run().catch(console.error)