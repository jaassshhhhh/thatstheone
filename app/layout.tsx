import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: "That's The One — Creator Commerce Intelligence",
    template: "%s — That's The One",
  },
  description: "The intelligence layer for creator commerce. Track every brand-creator relationship — sponsorships, organic mentions, and conviction scores — across YouTube, podcasts, Twitch and more. Updated daily.",
  manifest: '/manifest.json',
  keywords: ['creator commerce', 'brand-creator relationships', 'sponsorship intelligence', 'organic mentions', 'creator economy data', 'YouTube sponsorships'],
  openGraph: {
    type: 'website',
    siteName: "That's The One",
    title: "That's The One — Creator Commerce Intelligence",
    description: "The intelligence layer for creator commerce — real sponsorships, real organic mentions, real conviction scores.",
    url: 'https://thatsthe.one',
  },
  twitter: {
    card: 'summary_large_image',
    title: "That's The One",
    description: "The intelligence layer for creator commerce.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent' as const,
    title: "That's The One",
  },
  alternates: {
    canonical: 'https://thatsthe.one',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css" />
        <meta name="theme-color" content="#14122e" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="That's The One" />
      </head>
      
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
