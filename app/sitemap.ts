import { supabase } from './lib/supabase'

export default async function sitemap() {
  const baseUrl = 'https://thatsthe.one'

  // Static pages
  const static_pages = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/feed`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/search`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/trending`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/creators`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
  ]

  // Creator pages — one URL per creator
  const { data: creators } = await supabase
    .from('creators')
    .select('slug, updated_at')
    .not('slug', 'is', null)
    .limit(500)

  const creatorPages = (creators || []).map(c => ({
    url: `${baseUrl}/creators/${c.slug}`,
    lastModified: new Date(c.updated_at || new Date()),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  return [...static_pages, ...creatorPages]
}