// This file is intentionally minimal — the '/' → '/feed' redirect
// is handled at the routing layer in next.config.ts (permanent 308),
// not here, so Google gets an unambiguous permanent-redirect signal.
export default function Home() {
  return null
}