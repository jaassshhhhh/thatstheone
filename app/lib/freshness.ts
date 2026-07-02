// Deal staleness framework — tiers locked from a real data audit (July 2026):
// Fresh 14.2%, Recent 14.5%, Established 24.6%, Dormant 46.7% of all sponsorships.
// The core reframe: `last_seen` (recency of reconfirmation) is the trust signal,
// not `first_seen` (content publish date). See Deal_Staleness_Relevancy_Framework.md.

export type FreshnessTier = 'fresh' | 'recent' | 'established' | 'dormant'

export function getFreshnessTier(lastSeen: string | null | undefined): FreshnessTier {
  if (!lastSeen) return 'dormant'
  const days = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 86400000)
  if (days <= 30) return 'fresh'
  if (days <= 90) return 'recent'
  if (days <= 365) return 'established'
  return 'dormant'
}

export function getFreshnessColor(tier: FreshnessTier): string {
  if (tier === 'dormant') return 'rgba(255,255,255,.3)'
  if (tier === 'established') return '#818CF8'
  return '#34D399'
}

// The actual reframe: lead with recency-of-confirmation, not age-of-origin.
// first_seen only appears when it adds positive context (a sustained,
// repeatedly-reconfirmed relationship) — never as the headline age claim.
export function getFreshnessLine(params: {
  tier: FreshnessTier
  lastSeen: string | null | undefined
  firstSeen: string | null | undefined
  mentionCount: number
  timeAgo: (date: string) => string
}): string {
  const { tier, lastSeen, firstSeen, mentionCount, timeAgo } = params

  if (tier === 'dormant') {
    return lastSeen ? `Not recently confirmed — last seen ${timeAgo(lastSeen)}` : 'Not recently confirmed'
  }

  const confirmed = lastSeen ? `Confirmed ${timeAgo(lastSeen)}` : 'Active'

  if (mentionCount > 1 && firstSeen) {
    return `${confirmed} — ongoing since ${timeAgo(firstSeen)}`
  }

  return confirmed
}