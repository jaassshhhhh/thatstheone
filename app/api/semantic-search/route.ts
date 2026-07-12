import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json()
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return NextResponse.json({ results: [] })
    }

    const embeddingRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query.trim(),
    })
    const queryEmbedding = embeddingRes.data[0].embedding

    const { data, error } = await supabase.rpc('semantic_brand_search', {
      query_embedding: queryEmbedding,
      match_limit: 20,
    })

    if (error) {
      console.error('semantic_brand_search error:', error.message)
      return NextResponse.json({ results: [] })
    }

    return NextResponse.json({ results: data || [] })
  } catch (err: any) {
    console.error('semantic-search route error:', err.message)
    return NextResponse.json({ results: [] })
  }
}