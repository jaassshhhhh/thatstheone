const PODCASTS = [
    { name: 'The Tim Ferriss Show', rss: 'https://rss.art19.com/tim-ferriss-show' },
    { name: 'Huberman Lab', rss: 'https://feeds.megaphone.fm/hubermanlab' },
    { name: 'My First Million', rss: 'https://feeds.megaphone.fm/mfmpod' },
    { name: 'Diary of a CEO', rss: 'https://feeds.acast.com/public/shows/diary-of-a-ceo-with-steven-bartlett' },
    { name: 'Modern Wisdom', rss: 'https://feeds.acast.com/public/shows/modern-wisdom' },
    { name: 'All-In Podcast', rss: 'https://feeds.megaphone.fm/allinpodcast' },
    { name: 'Acquired', rss: 'https://acquired.fm/rss' },
    { name: 'How I Built This', rss: 'https://feeds.simplecast.com/GHHnXNFD' },
    { name: 'Darknet Diaries', rss: 'https://feeds.megaphone.fm/darknetdiaries' },
    { name: 'Crime Junkie', rss: 'https://feeds.simplecast.com/qm_9xx0g' },
    { name: 'The Knowledge Project', rss: 'https://feeds.simplecast.com/qN5oPkwB' },
    { name: 'Lex Fridman Podcast', rss: 'https://lexfridman.com/feed/podcast/' },
    { name: 'Founders Podcast', rss: 'https://feeds.transistor.fm/founders' },
    { name: 'Planet Money', rss: 'https://feeds.npr.org/510289/podcast.xml' },
    { name: 'Freakonomics Radio', rss: 'https://feeds.simplecast.com/Y8lFbOT4' },
    { name: 'SmartLess', rss: 'https://feeds.simplecast.com/yGFBCHId' },
    { name: 'Armchair Expert', rss: 'https://feeds.simplecast.com/e9Mnieb5' },
    { name: 'The Daily', rss: 'https://feeds.simplecast.com/54nAGcIl' },
    { name: 'Contrarian Thinking', rss: 'https://feeds.megaphone.fm/contrarianthinking' },
    { name: 'The Game w/ Alex Hormozi', rss: 'https://feeds.megaphone.fm/IMSA3959656606' },
    { name: 'The GaryVee Audio Experience', rss: 'https://feeds.megaphone.fm/thegaryveeaudioexperience' },
  ]
  
  async function check(podcast) {
    try {
      const res = await fetch(podcast.rss, { headers: { 'User-Agent': 'ThatsTheOne/1.0 (+https://thatsthe.one)' } })
      const status = res.status
      const finalUrl = res.url
      const text = await res.text()
      const itemCount = (text.match(/<item>/g) || []).length
      const snippet = text.slice(0, 150).replace(/\n/g, ' ')
      console.log(`\n${podcast.name}`)
      console.log(`  status: ${status}${finalUrl !== podcast.rss ? ` (redirected → ${finalUrl})` : ''}`)
      console.log(`  <item> tags found: ${itemCount}`)
      console.log(`  body starts: ${snippet}`)
    } catch (err) {
      console.log(`\n${podcast.name}`)
      console.log(`  ✗ threw: ${err.message}`)
    }
  }
  
  for (const p of PODCASTS) {
    await check(p)
  }