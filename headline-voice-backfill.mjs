import { supabase, generateHeadline } from './pipeline.mjs'

const BATCH_SIZE = 200

async function run() {
  console.log('🎙  Headline voice backfill starting...')
  console.log('   This regenerates EVERY existing headline, not just missing ones.')
  console.log('   Real OpenAI cost applies — see the script comment for context.\n')

  let totalProcessed = 0
  let totalUpdated = 0
  let offset = 0

  while (true) {
    const { data: rows, error } = await supabase
      .from('sponsorships')
      .select('id, promo_code, promo_url, offer_text, exact_quote, sponsorship_type, platform, brands(name), creators(name)')
      .order('id', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1)

    if (error) {
      console.log(`✗ Fetch error: ${error.message}`)
      break
    }
    if (!rows || rows.length === 0) break

    console.log(`\n📦 Batch at offset ${offset} — ${rows.length} rows`)

    for (const s of rows) {
      const headline = await generateHeadline(
        s.brands?.name || 'Unknown',
        s.creators?.name || 'A creator',
        s.sponsorship_type,
        s.offer_text,
        s.promo_code,
        s.exact_quote,
        s.platform
      )
      totalProcessed++
      if (headline) {
        await supabase.from('sponsorships').update({ headline }).eq('id', s.id)
        totalUpdated++
        if (totalProcessed % 50 === 0) {
          console.log(`   ...${totalProcessed} processed, ${totalUpdated} updated so far`)
        }
      }
      await new Promise(r => setTimeout(r, 120))
    }

    offset += BATCH_SIZE
  }

  console.log(`\n✅ Done — ${totalProcessed} rows processed, ${totalUpdated} headlines regenerated`)
}

run().catch(console.error)