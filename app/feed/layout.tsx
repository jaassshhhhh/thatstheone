export const metadata = {
  title: "That's The One — Creator Commerce Intelligence Feed",
  description: "What creators are genuinely recommending and what they're being paid to promote — sponsorships and organic mentions, tracked daily across YouTube, podcasts and more.",
  openGraph: {
    title: "That's The One",
    description: "The daily creator commerce intelligence feed. Real sponsorships, organic mentions, and conviction scores.",
    url: 'https://thatsthe.one/feed',
  },
  alternates: {
    canonical: 'https://thatsthe.one/feed',
  },
}

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}