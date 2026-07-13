import { supabase, getYouTubeVideos, buildVideoContext } from './pipeline.mjs'

async function run() {
  // 1. Pull known brand names
  const { data: brands } = await supabase.from('brands').select('name')
  const brandNames = (brands || []).map(b => b.name).filter(n => n && n.length > 2)
  console.log(`Loaded ${brandNames.length} known brand names`)

  const sortedNames = [...brandNames].sort((a, b) => b.length - a.length)

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  const collabPattern = new RegExp(
    `(${sortedNames.map(escapeRegex).join('|')})` +
    `\\s*(?:x|×|\\.{0,20}(?:collab|collaboration|teamed up with|limited edition with)\\.{0,20})\\s*` +
    `(${sortedNames.map(escapeRegex).join('|')})`,
    'gi'
  )

  // 2. Pull a small sample of YouTube creators — prioritise fashion/lifestyle/beauty categories
  //    where brand x brand collabs actually happen
  const targetCategories = ['Fashion', 'Lifestyle', 'Beauty', 'Streetwear', 'Style']
  let { data: creators } = await supabase
    .from('creators')
    .select('id, name, channel_id, category')
    .eq('platform', 'youtube')
    .not('channel_id', 'is', null)
    .in('category', targetCategories)
    .limit(5)

  // Fallback: if no creators tagged with those categories exist, just take any 5 YouTube creators
  if (!creators?.length) {
    console.log('No creators found in fashion/lifestyle/beauty categories — falling back to any 5 YouTube creators\n')
    const res = await supabase
      .from('creators')
      .select('id, name, channel_id, category')
      .eq('platform', 'youtube')
      .not('channel_id', 'is', null)
      .limit(5)
    creators = res.data
  }

  console.log(`Testing against ${(creators || []).length} YouTube creators:`)
  ;(creators || []).forEach(c => console.log(`  - ${c.name} (${c.category || 'no category'})`))
  console.log('')

  let matchCount = 0

  for (const creator of (creators || [])) {
    const videos = await getYouTubeVideos(creator.channel_id, 5) // small sample, limits quota spend
    for (const video of videos) {
      const richContext = await buildVideoContext(video, creator.name)
      const matches = [...richContext.matchAll(collabPattern)]
      for (const m of matches) {
        if (m[1].toLowerCase() === m[2].toLowerCase()) continue
        matchCount++
        console.log(`MATCH: "${m[1]}" x "${m[2]}"`)
        console.log(`  Creator: ${creator.name}`)
        console.log(`  Video: ${video.snippet?.title || '(no title)'}`)
        console.log(`  Context: ...${richContext.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40)}...`)
        console.log('')
      }
    }
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`\nDone. ${matchCount} candidate matches found — check each one by hand for false positives.`)
}

run().catch(console.error)