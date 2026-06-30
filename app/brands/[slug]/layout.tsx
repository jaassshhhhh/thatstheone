import { createClient } from '@supabase/supabase-js'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
  
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  
    const { data: brand } = await supabase
      .from('brands')
      .select('name, category, website_url, total_creator_count')
      .eq('slug', slug)
      .single()
  
    if (!brand) return { title: "Brand — That's The One" }
  
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: brand.name,
      ...(brand.website_url && { url: brand.website_url }),
      ...(brand.category && { knowsAbout: brand.category }),
      sameAs: [`https://thatsthe.one/brands/${slug}`],
    }
  
    return {
      title: `${brand.name} creator deals and promo codes`,
      description: `Every creator promoting ${brand.name}. See promo codes, discount offers and sponsorship history from ${brand.total_creator_count || 'multiple'} creators. Updated daily.`,
      openGraph: {
        title: `${brand.name} — Creator Intelligence`,
        description: `See every creator who promotes ${brand.name}, their promo codes and how long they've worked together.`,
        url: `https://thatsthe.one/brands/${slug}`,
      },
      alternates: {
        canonical: `https://thatsthe.one/brands/${slug}`,
      },
      other: {
        'script:ld+json': JSON.stringify(jsonLd),
      },
    }
  }
  
  export default function BrandLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
  }