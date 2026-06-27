import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!

const CREATORS = [
  { name: 'Ali Abdaal', channelId: 'UCoOae5nYA7VqaXzerajD0lg', slug: 'ali-abdaal', category: 'Productivity' },
  { name: 'MKBHD', channelId: 'UCBJycsmduvYEL83R_U4JriQ', slug: 'mkbhd', category: 'Tech' },
  { name: 'Linus Tech Tips', channelId: 'UCXuqSBlHAE6Xw-yeJA0Tunw', slug: 'linus-tech-tips', category: 'Tech' },
  { name: 'Andrew Huberman', channelId: 'UC2D2CMWXMOVWx7giW1n3LIg', slug: 'andrew-huberman', category: 'Health' },
  { name: 'Thomas Frank', channelId: 'UCG-KntY7aVnIGXYEBQvmBAQ', slug: 'thomas-frank', category: 'Productivity' },
  { name: 'Graham Stephan', channelId: 'UCV6KDgJskWaEckne5aPA0aQ', slug: 'graham-stephan', category: 'Finance' },
  { name: 'Lex Fridman', channelId: 'UCSHZKyawb77ixDdsGog4iWA', slug: 'lex-fridman', category: 'Tech' },
  { name: 'Veritasium', channelId: 'UCHnyfMqiRRG1u-2MsSQLbXA', slug: 'veritasium', category: 'Education' },
  { name: 'CGP Grey', channelId: 'UC7_gcs09iThXybpVgjHZ_7g', slug: 'cgp-grey', category: 'Education' },
  { name: 'Matt D\'Avella', channelId: 'UCJ24N4O0bP7LGLBDvye7oCA', slug: 'matt-davella', category: 'Lifestyle' },
  { name: 'Peter Attia', channelId: 'UCNHItQ7UJE7Jnl9HiDKrXBw', slug: 'peter-attia', category: 'Health' },
  { name: 'Andrei Jikh', channelId: 'UCF9IOB2TExg3QIBupFtBDxg', slug: 'andrei-jikh', category: 'Finance' },
  { name: 'Mark Rober', channelId: 'UCY1kMZp36IQSyNx_9h4mpCg', slug: 'mark-rober', category: 'Education' },
  { name: 'Kurzgesagt', channelId: 'UCsXVk37bltHxD1rDPwtNM8Q', slug: 'kurzgesagt', category: 'Education' },
  { name: 'Dave2D', channelId: 'UCVhQ2NnY5Rskt6UjCUkJ_DA', slug: 'dave2d', category: 'Tech' },
]

async function extractSponsorsWithAI(text: string, videoTitle: string): Promise<{ brand: string; code: string | null; confidence: number }[]> {
  if (!text || text.length < 50) return []

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert at identifying brand sponsorships in YouTube video descriptions and titles.
Extract ONLY genuine paid sponsorships or affiliate partnerships.
Return a JSON array of sponsorships found.
Each item must have:
- brand: the company/product name (string)
- code: promo/discount code if mentioned, null if none (string or null)
- confidence: how confident you are this is a real sponsorship, 0-1 (number)

Rules:
- Only include actual sponsors, not random brand mentions
- Ignore YouTube, Google, social media platforms
- Ignore books/movies being discussed (not sponsored)
- A promo code strongly indicates a sponsorship
- Phrases like "sponsored by", "use code", "thanks to X for sponsoring", "check out X" indicate sponsorships
- Return empty array [] if no sponsorships found
- Return ONLY valid JSON, no explanation`
        },
        {
          role: 'user',
          content: `Video title: "${videoTitle}"\n\nDescription:\n${text.slice(0, 2000)}`
        }
      ],
      temperature: 0.1,
      max_tokens: 500,
    })

    const content = completion.choices[0].message.content?.trim() || '[]'
    const clean = content.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.error('AI extraction error:', err)
    return []
  }
}

async function getChannelVideos(channelId: string, maxResults = 15) {
  const url = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${channelId}&part=snippet&order=date&maxResults=${maxResults}&type=video`
  const res = await fetch(url)
  const data = await res.json()
  return data.items || []
}

async function getVideoDetails(videoIds: string[]) {
  const url = `https://www.googleapis.com/youtube/v3/videos?key=${YOUTUBE_API_KEY}&id=${videoIds.join(',')}&part=snippet`
  const res = await fetch(url)
  const data = await res.json()
  return data.items || []
}

export async function GET() {
  const results = []
  const errors = []

  for (const creator of CREATORS) {
    try {
      console.log(`Processing ${creator.name}...`)

      const { data: creatorData } = await supabase
        .from('creators')
        .upsert({
          name: creator.name,
          slug: creator.slug,
          channel_id: creator.channelId,
          category: creator.category,
          platform: 'youtube'
        }, { onConflict: 'slug' })
        .select()
        .single()

      if (!creatorData) {
        errors.push(`Failed to upsert creator: ${creator.name}`)
        continue
      }

      const videos = await getChannelVideos(creator.channelId, 15)
      const videoIds = videos.map((v: any) => v.id?.videoId).filter(Boolean)
      if (!videoIds.length) continue

      const details = await getVideoDetails(videoIds)

      for (const video of details) {
        const text = `${video.snippet.title}\n\n${video.snippet.description}`
        const sponsors = await extractSponsorsWithAI(text, video.snippet.title)

        for (const { brand, code, confidence } of sponsors) {
          if (confidence < 0.7) continue

          const { data: brandData } = await supabase
            .from('brands')
            .upsert({
              name: brand,
              slug: brand.toLowerCase().replace(/[\s&]+/g, '-').replace(/[^a-z0-9-]/g, '')
            }, { onConflict: 'slug' })
            .select()
            .single()

          if (!brandData) continue

          await supabase
            .from('sponsorships')
            .upsert({
              creator_id: creatorData.id,
              brand_id: brandData.id,
              promo_code: code,
              platform: 'youtube',
              video_id: video.id,
              video_title: video.snippet.title,
              first_seen: video.snippet.publishedAt,
              last_seen: video.snippet.publishedAt,
              is_active: true,
            }, { onConflict: 'video_id,brand_id' })

          results.push({
            creator: creator.name,
            brand,
            code,
            confidence,
            video: video.snippet.title
          })

          console.log(`✓ ${creator.name} → ${brand} (code: ${code || 'none'}, confidence: ${confidence})`)
        }

        await new Promise(r => setTimeout(r, 200))
      }

      await new Promise(r => setTimeout(r, 500))

    } catch (err: any) {
      console.error(`Error processing ${creator.name}:`, err)
      errors.push(`${creator.name}: ${err.message}`)
    }
  }

  return NextResponse.json({
    success: true,
    found: results.length,
    errors,
    data: results
  })
}