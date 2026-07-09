export const metadata = {
  title: "Search Creator Brand Relationships",
  description: "Search thousands of real creator-brand relationships across YouTube, podcasts and Twitch — sponsorships, organic mentions and conviction scores, all verified.",
  openGraph: {
    title: "Search — That's The One",
    description: "Search every verified creator-brand relationship indexed across YouTube, podcasts and more.",
    url: 'https://thatsthe.one/search',
  },
  alternates: {
    canonical: 'https://thatsthe.one/search',
  },
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}