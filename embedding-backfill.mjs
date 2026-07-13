import { supabase, openai } from './pipeline.mjs'

async function generateBrandEmbedding(brand) {
  const input = `${brand.name}. ${brand.description || ''}`.trim()
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input,
  })
  return response.data[0].embedding
}

async function run() {
  const { data: brands, count } = await supabase
    .from('brands')
    .select('id, name, description', { count: 'exact' })
    .is('embedding', null)

  console.log(`${(brands || []).length} brands need embeddings\n`)

  let done = 0
  let failed = 0

  for (const brand of (brands || [])) {
    try {
      const embedding = await generateBrandEmbedding(brand)
      const { error } = await supabase
        .from('brands')
        .update({ embedding })
        .eq('id', brand.id)
      if (error) {
        console.log(`  ✗ ${brand.name}: ${error.message}`)
        failed++
      } else {
        done++
        if (done % 50 === 0) console.log(`  ...${done} done so far`)
      }
    } catch (err) {
      console.log(`  ✗ ${brand.name}: ${err.message}`)
      failed++
    }
    await new Promise(r => setTimeout(r, 100)) // gentle pacing, avoid rate limits
  }

  console.log(`\nDone. ${done} embedded, ${failed} failed.`)
}

run().catch(console.error)
