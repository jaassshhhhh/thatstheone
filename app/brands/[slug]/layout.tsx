import { supabase } from '../../lib/supabase'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { data: brand } = await supabase
    .from('brands')
    .select('name, category, website_url, total_creator_count')
    .eq('slug', slug)
    .single()

  if (!brand) return { title: "Brand — That's The One" }

  return {
    title: `${brand.name} — creator relationships and conviction`,
    description: `Every creator connected to ${brand.name} — sponsorships and organic mentions, scored for authenticity, from ${brand.total_creator_count || 'multiple'} creators. Updated daily.`,
    openGraph: {
      title: `${brand.name} — Creator Intelligence`,
      description: `See every creator connected to ${brand.name} and how genuine that relationship really is.`,
      url: `https://thatsthe.one/brands/${slug}`,
    },
    alternates: {
      canonical: `https://thatsthe.one/brands/${slug}`,
    },
  }
}

async function getBrand(slug: string) {
  const { data } = await supabase
    .from('brands')
    .select('name, category, website_url')
    .eq('slug', slug)
    .single()
  return data
}

export default async function BrandLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const brand = await getBrand(slug)

  const jsonLd = brand ? JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: brand.name,
    ...(brand.website_url && { url: brand.website_url }),
    ...(brand.category && { knowsAbout: brand.category }),
    sameAs: [`https://thatsthe.one/brands/${slug}`],
  }) : null

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd }}
        />
      )}
      {children}
    </>
  )
}