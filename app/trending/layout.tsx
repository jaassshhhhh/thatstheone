export const metadata = {
  title: "Trending Brands in Creator Content",
  description: "Which brands are rising, falling and crossing into new creator niches this week — real velocity data, updated daily.",
  openGraph: {
    title: "Trending — That's The One",
    description: "Real brand velocity data. See which brands are genuinely gaining traction in creator content.",
    url: 'https://thatsthe.one/trending',
  },
  alternates: {
    canonical: 'https://thatsthe.one/trending',
  },
}

export default function TrendingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}