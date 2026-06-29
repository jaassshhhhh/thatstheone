import { createClient } from '@supabase/supabase-js'

export default async function sitemap() {
  const baseUrl = 'https://thatsthe.one'

  const static_pages = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 1 },
    { url: `${baseUrl}/feed`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${baseUrl}/search`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.8 },
    { url: `${baseUrl}/trending`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.8 },
    { url: `${baseUrl}/creators`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.8 },
    { url: `${baseUrl}/brands`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.8 },
  ]

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const [{ data: creators }, { data: brands }] = await Promise.all([
      supabase.from('creators').select('slug').not('slug', 'is', null).limit(1000),
      supabase.from('brands').select('slug').not('slug', 'is', null).limit(1000),
    ])

    const creatorPages = (creators || []).map(c => ({
      url: `${baseUrl}/creators/${c.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

    const brandPages = (brands || []).map(b => ({
      url: `${baseUrl}/brands/${b.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

    return [...static_pages, ...creatorPages, ...brandPages]
  } catch (e) {
    return static_pages
  }
}