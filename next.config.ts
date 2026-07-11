import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async redirects() {
    return [
      {
        source: '/',
        destination: '/feed',
        permanent: true, // 308 - tells Google this is permanent, consolidates ranking signal into /feed
      },
    ];
  },
};

export default nextConfig;