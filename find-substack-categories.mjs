// Tests a range of category IDs against Substack's confirmed-real category
// browse endpoint, to build a real ID→category map instead of guessing one.
async function testId(id) {
    try {
      const res = await fetch(`https://substack.com/api/v1/category/public/${id}/all?page=0`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })
      if (!res.ok) return
      const data = await res.json()
      const pubs = data?.publications || []
      if (!pubs.length) return
      const sampleNames = pubs.slice(0, 3).map(p => p.name).join(', ')
      console.log(`ID ${id}: ${pubs.length} publications — e.g. ${sampleNames}`)
    } catch {}
  }
  
  async function run() {
    for (let id = 1; id <= 200; id++) {
      await testId(id)
      await new Promise(r => setTimeout(r, 200))
    }
  }
  
  run()