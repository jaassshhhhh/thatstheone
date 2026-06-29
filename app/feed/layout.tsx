export const metadata = {
    title: "Pulse — Creator Deal Intelligence Feed",
    description: "What creators are promoting, obsessing over and getting paid to talk about. Updated daily across YouTube, podcasts and more.",
    openGraph: {
      title: "Pulse — That's The One",
      description: "The daily creator commerce intelligence feed. Deals, trends and organic mentions from 400+ creators.",
      url: 'https://thatsthe.one/feed',
    },
  }
  
  export default function FeedLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
  }