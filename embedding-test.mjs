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
  const { data: brands } = await supabase
    .from('brands')
    .select('id, name, description')
    .not('description', 'is', null)
    .limit(5)

  console.log(`Testing embedding generation on ${(brands || []).length} real brands\n`)

  for (const brand of (brands || [])) {
    const input = `${brand.name}. ${brand.description || ''}`.trim()
    console.log(`Brand: ${brand.name}`)
    console.log(`Input text: "${input}"`)

    const embedding = await generateBrandEmbedding(brand)
    console.log(`Embedding length: ${embedding.length} (should be 1536)`)
    console.log(`First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`)
    console.log('')
  }

  console.log('Done. No data was written — this only generated and printed embeddings for inspection.')
}

run().catch(console.error)
