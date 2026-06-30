import { supabase } from '../../lib/supabase'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { data: creator } = await supabase
    .from('creators')
    .select('name, category, platform, avatar_url, total_sponsorships')
    .eq('slug', slug)
    .single()

  if (!creator) {
    return {
      title: "Creator not found — That's The One",
      description: "Find creator sponsorships and deals on That's The One",
    }
  }

  const name = creator.name
  const deals = creator.total_sponsorships || 0

  return {
    title: `${name} sponsorships and deals — That's The One`,
    description: `See every brand ${name} has promoted, their promo codes, discount offers and sponsorship history. ${deals > 0 ? `${deals} deals tracked.` : ''} Updated daily.`,
    openGraph: {
      title: `${name} — Creator Intelligence`,
      description: `Every sponsorship, deal and brand association for ${name}. Tracked across YouTube, podcasts and more.`,
      url: `https://thatsthe.one/creators/${slug}`,
      siteName: "That's The One",
      type: 'profile',
    },
    twitter: {
      card: 'summary',
      title: `${name} sponsorships — That's The One`,
      description: `Every brand deal ${name} has ever promoted, tracked and scored.`,
    },
    alternates: {
      canonical: `https://thatsthe.one/creators/${slug}`,
    },
  }
}

async function getCreator(slug: string) {
  const { data } = await supabase
    .from('creators')
    .select('name, category, avatar_url')
    .eq('slug', slug)
    .single()
  return data
}

export default async function CreatorLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const creator = await getCreator(slug)

  const jsonLd = creator ? JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: creator.name,
    ...(creator.avatar_url && { image: creator.avatar_url }),
    ...(creator.category && { knowsAbout: creator.category }),
    sameAs: [`https://thatsthe.one/creators/${slug}`],
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