import { supabase, verifyBrandDomain } from './pipeline.mjs'

async function run() {
  console.log('🔧 Backfilling brand website URLs...\n')

  const { data: brands } = await supabase
    .from('brands')
    .select('id, name, slug, website_url')
    .is('website_url', null)

  console.log(`📋 ${(brands || []).length} brands with no website_url\n`)

  let filled = 0
  let skipped = 0
  for (const brand of (brands || [])) {
    const url = await verifyBrandDomain(brand.name)
    if (url) {
      const { error } = await supabase
        .from('brands')
        .update({ website_url: url })
        .eq('id', brand.id)
        .is('website_url', null)
      if (!error) {
        filled++
        console.log(`  ✅ ${brand.name} → ${url}`)
      }
    } else {
      skipped++
      console.log(`  ⚪ ${brand.name} — no verified domain found, left null`)
    }
    await new Promise(r => setTimeout(r, 200))
  }

  console.log(`\n✅ Done. Filled ${filled}, skipped ${skipped} (no clean match — fine, better null than wrong).`)
}

run()