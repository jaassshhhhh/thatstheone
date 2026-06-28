import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '.env.local') })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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
- Third person — describe what's happening, don't say "sign up" or "get"
- Be specific — mention numbers, names, actual offers
- Create curiosity without being clickbait
- No exclamation marks ever
- No "unlock", "score", "grab", "snag", "don't miss"

Good examples:
"Thomas Frank has been pushing Skillshare for 3 years straight"
"Audible giving away free audiobooks through creator codes right now"
"Brilliant cutting 20% for the next 200 signups via Veritasium"
"AG1 quietly crossed into finance YouTube — 5 creators this week"
"Trading 212 offering £100 in free shares through UK creators"

Return ONLY the headline. No quotes. No punctuation at end.`
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
    return completion.choices[0].message.content?.trim() || null
  } catch { return null }
}

async function run() {
  console.log('📰 Generating headlines for existing sponsorships...\n')

  const { data } = await supabase
    .from('sponsorships')
    .select('id, promo_code, promo_url, offer_text, exact_quote, sponsorship_type, platform, brands(name), creators(name)')
    .is('headline', null)
    .limit(200)

  console.log(`Found ${data?.length || 0} sponsorships without headlines\n`)

  let count = 0
  for (const s of (data || [])) {
    const headline = await generateHeadline(
      s.brands?.name || 'Unknown',
      s.creators?.name || 'A creator',
      s.sponsorship_type,
      s.offer_text,
      s.promo_code,
      s.exact_quote,
      s.platform
    )

    if (headline) {
      await supabase.from('sponsorships').update({ headline }).eq('id', s.id)
      count++
      console.log(`✓ ${s.brands?.name} via ${s.creators?.name}`)
      console.log(`  "${headline}"\n`)
    }

    await new Promise(r => setTimeout(r, 100))
  }

  console.log(`\n✅ Generated ${count} headlines`)
}

run().catch(console.error)