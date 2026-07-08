import {
    supabase,
    getYouTubeVideos,
    buildVideoContext,
    makeContent,
    extractFromContent,
    saveToDatabase,
    parsePodcastRSS,
    safeISOString,
  } from './pipeline.mjs'
  
  const DEEP_BACKFILL_SLUGS = [
    'tyler-chou-the-creators-attorney',
    'marketing-happy-hour',
    'girl-stand-up-manifestation-motivation',
    'craft-your-own-coffee-podcast',
    'becca-and-the-books',
  ]
  
  async function run() {
    console.log('🎯 Deep backfill — pulling maximum history for outreach-bound creators...\n')
  
    const { data: targets } = await supabase
      .from('creators')
      .select('id, name, slug, platform, channel_id, rss_url')
      .in('slug', DEEP_BACKFILL_SLUGS)
  
    console.log(`📋 ${(targets || []).length} of ${DEEP_BACKFILL_SLUGS.length} target creators found in database\n`)
  
    let total = 0
    for (const creator of (targets || [])) {
      console.log(`🔍 ${creator.name} (${creator.platform})`)
  
      if (creator.platform === 'youtube' && creator.channel_id) {
        const videos = await getYouTubeVideos(creator.channel_id, 100)
        console.log(`  📄 ${videos.length} videos found (deep pull, normal runs use 15-30)`)
        for (const video of videos) {
          const richContext = await buildVideoContext(video, creator.name)
          const content = makeContent(
            'youtube', video.id, creator.name,
            video.snippet?.title || '',
            richContext,
            `https://youtube.com/watch?v=${video.id}`,
            video.snippet?.publishedAt || new Date().toISOString()
          )
          const sponsors = await extractFromContent(content)
          total += await saveToDatabase(content, sponsors, creator.id)
          await new Promise(r => setTimeout(r, 150))
        }
      } else if (creator.platform === 'podcast' && creator.rss_url) {
        const episodes = await parsePodcastRSS({ rss: creator.rss_url }, 500)
        console.log(`  📄 ${episodes.length} episodes found (deep pull, normal runs use 20)`)
        for (const ep of episodes) {
          const content = makeContent(
            'podcast', ep.guid.slice(0, 200), creator.name,
            ep.title, `${ep.title}\n\n${ep.description}`, ep.link,
            safeISOString(ep.pubDate), 'audio'
          )
          const sponsors = await extractFromContent(content)
          total += await saveToDatabase(content, sponsors, creator.id)
          await new Promise(r => setTimeout(r, 200))
        }
      } else {
        console.log(`  ⚠️  No usable channel_id/rss_url for this creator, skipped`)
        continue
      }
  
      await supabase.from('creators').update({ last_scraped_at: new Date().toISOString() }).eq('id', creator.id)
      console.log('')
    }
  
    console.log(`✅ Deep backfill complete: ${total} new sponsorships found across ${(targets || []).length} creators`)
  }
  
  run().catch(console.error)