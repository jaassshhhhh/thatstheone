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

// Amazon storefront URL variations to try per creator
function getAmazonUrls(creatorName) {
  const variants = []
  const clean = creatorName.toLowerCase().replace(/[^a-z0-9]/g, '')
  const hyphen = creatorName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  const original = creatorName.replace(/\s+/g, '')

  variants.push(`https://www.amazon.com/shop/${original}`)
  variants.push(`https://www.amazon.com/shop/${clean}`)
  variants.push(`https://www.amazon.com/shop/${hyphen}`)
  variants.push(`https://www.amazon.co.uk/shop/${original}`)
  variants.push(`https://www.amazon.co.uk/shop/${clean}`)

  return [...new Set(variants)]
}

// Fetch Amazon storefront page
async function fetchStorefront(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      },
      redirect: 'follow',
    })
    if (!res.ok) return null
    const html = await res.text()
    // Check if it's a real storefront page not a 404 or redirect
    if (html.includes('Page Not Found') || html.includes('page-not-found')) return null
    if (html.includes('Store not found') || html.includes('storefront-not-found')) return null
    if (!html.includes('a-carousel') && !html.includes('product') && !html.includes('asin')) return null
    return html
  } catch { return null }
}

// Extract products from storefront HTML
function extractProducts(html, creatorName) {
  const products = []

  // Extract product titles from various Amazon HTML patterns
  const patterns = [
    // Data in JSON state
    /"title"\s*:\s*"([^"]{10,200})"/g,
    // Product link text
    /class="[^"]*a-text-normal[^"]*"[^>]*>([^<]{10,150})<\/a>/g,
    // Span titles
    /<span[^>]*class="[^"]*a-size-base[^"]*"[^>]*>([A-Z][^<]{15,150})<\/span>/g,
    // Alt text on product images
    /alt="([^"]{15,200})"/g,
  ]

  const seen = new Set()
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(html)) !== null) {
      const title = match[1]
        .replace(/\\u[\dA-F]{4}/gi, ' ')
        .replace(/\\n|\\t|\\r/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      // Filter out noise — only keep product-like titles
      if (title.length < 10 || title.length > 200) continue
      if (seen.has(title.toLowerCase())) continue
      if (/^(home|shop|all|see|view|more|next|prev|back|close|menu|search|sign|log|cart|wish)/i.test(title)) continue
      if (/amazon|prime|shipping|delivery|return|review|star|rating|sold|fulfilled/i.test(title)) continue
      if (/^\d+$/.test(title)) continue

      seen.add(title.toLowerCase())
      products.push(title)
    }
  }

  return products.slice(0, 30) // Max 30 products per storefront
}

// Extract brand names from product titles using simple heuristics
function extractBrandFromProduct(productTitle) {
  // First word is often the brand for Amazon products
  const firstWord = productTitle.split(' ')[0]
  if (firstWord.length >= 3 && /^[A-Z]/.test(firstWord)) {
    return firstWord
  }
  return null
}

// Save organic storefront mentions to database
async function saveStorefrontData(creator, products, storefrontUrl) {
  if (!products.length) return 0
  let saved = 0

  console.log(`  📦 Found ${products.length} products on ${storefrontUrl}`)

  for (const productTitle of products) {
    const brand = extractBrandFromProduct(productTitle)
    if (!brand || brand.length < 3) continue

    // Skip obvious noise
    const noiseBrands = new Set(['The', 'For', 'With', 'New', 'Buy', 'Get', 'Set', 'Kit'])
    if (noiseBrands.has(brand)) continue

    // Upsert brand
    const { data: brandData } = await supabase
      .from('brands')
      .upsert({ name: brand, slug: brand.toLowerCase().replace(/[^a-z0-9]/g, '-') }, { onConflict: 'slug' })
      .select().single()
    if (!brandData) continue

    // Save as organic sponsorship
    const videoId = `amazon_${creator.slug}_${brand.toLowerCase().replace(/[^a-z0-9]/g, '')}`
    const { error } = await supabase
      .from('sponsorships')
      .upsert({
        creator_id: creator.id,
        brand_id: brandData.id,
        sponsorship_type: 'mention',
        is_organic: true,
        platform: 'amazon',
        video_id: videoId,
        video_title: `Amazon Storefront — ${productTitle}`,
        exact_quote: `${creator.name} lists "${productTitle}" on their Amazon storefront`,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        is_active: true,
        dar_score: 65, // Organic storefront = medium-high confidence
        dar_source: 'amazon_storefront',
        promo_url: storefrontUrl,
        headline: `${creator.name} recommends ${brand} products on their Amazon storefront`,
      }, { onConflict: 'video_id,brand_id' })

    if (!error) {
      saved++
      console.log(`    🌱 ${brand} — "${productTitle.slice(0, 60)}${productTitle.length > 60 ? '...' : ''}"`)
    }
  }

  return saved
}

async function run() {
  console.log('\n═══════════════════════════════════════════════════════')
  console.log(`🛒 Amazon Storefront Scraper — ${new Date().toISOString()}`)
  console.log('═══════════════════════════════════════════════════════')

  // Get all YouTube creators ordered by subscriber count
  const { data: creators } = await supabase
    .from('creators')
    .select('id, name, slug, subscriber_count')
    .eq('platform', 'youtube')
    .order('subscriber_count', { ascending: false, nullsFirst: false })
    .limit(100)

  console.log(`📚 Checking ${(creators || []).length} creators for Amazon storefronts\n`)

  let found = 0
  let totalProducts = 0
  let totalSaved = 0

  for (const creator of (creators || [])) {
    const urls = getAmazonUrls(creator.name)
    let storefrontFound = false

    for (const url of urls) {
      const html = await fetchStorefront(url)
      if (!html) {
        await new Promise(r => setTimeout(r, 500))
        continue
      }

      // Found a valid storefront
      storefrontFound = true
      found++
      console.log(`✓ ${creator.name} → ${url}`)

      const products = extractProducts(html, creator.name)
      totalProducts += products.length

      const saved = await saveStorefrontData(creator, products, url)
      totalSaved += saved

      // Save storefront URL to creator record
      await supabase
        .from('creators')
        .update({ amazon_storefront_url: url })
        .eq('id', creator.id)
        .then(() => {})

      break // Found one, move to next creator
    }

    if (!storefrontFound) {
      process.stdout.write(`✗ ${creator.name}\r`)
    }

    // Rate limit — be respectful to Amazon
    await new Promise(r => setTimeout(r, 2000))
  }

  console.log('\n═══════════════════════════════════════════════════════')
  console.log(`✅ Amazon scraper complete`)
  console.log(`   Storefronts found: ${found}`)
  console.log(`   Products extracted: ${totalProducts}`)
  console.log(`   Organic mentions saved: ${totalSaved}`)
  console.log('═══════════════════════════════════════════════════════')
}

run().catch(console.error)