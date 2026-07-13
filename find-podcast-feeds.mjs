const SHOWS = [
    { term: 'My First Million', id: 1469759170 },
    { term: 'Diary of a CEO Steven Bartlett', id: 1291423644 },
    { term: 'Contrarian Thinking Codie Sanchez podcast' },
  ]
  
  async function lookupById(id, term) {
    const url = `https://itunes.apple.com/lookup?id=${id}`
    const res = await fetch(url)
    const data = await res.json()
    const pod = data.results?.[0]
    console.log(`\n${term}`)
    console.log(`  name: ${pod?.trackName}`)
    console.log(`  feedUrl: ${pod?.feedUrl}`)
  }
  
  async function lookupByTerm(term) {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=podcast&limit=5`
    const res = await fetch(url)
    const data = await res.json()
    console.log(`\n${term} — top 5 matches:`)
    for (const pod of data.results || []) {
      console.log(`  - ${pod.trackName} | ${pod.feedUrl}`)
    }
  }
  
  for (const s of SHOWS) {
    if (s.id) await lookupById(s.id, s.term)
    else await lookupByTerm(s.term)
    await new Promise(r => setTimeout(r, 3500))
  }