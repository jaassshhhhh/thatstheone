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
    title: `${name} — brand relationships and conviction score`,
    description: `See every brand ${name} has been connected to — sponsorships, organic mentions, and a real conviction score. ${deals > 0 ? `${deals} tracked.` : ''} Updated daily.`,
    openGraph: {
      title: `${name} — Creator Intelligence`,
      description: `Every brand relationship for ${name}, scored and verified. Tracked across YouTube, podcasts, Twitch and more.`,
      url: `https://thatsthe.one/creators/${slug}`,
      siteName: "That's The One",
      type: 'profile',
    },
    twitter: {
      card: 'summary',
      title: `${name} — That's The One`,
      description: `Every brand relationship ${name} has, tracked and scored for authenticity.`,
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