import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

// Get episode list first
await page.goto('https://tim.blog/podcast/', { waitUntil: 'networkidle', timeout: 30000 })
const links = await page.evaluate(() => {
  return [...document.querySelectorAll('a[href]')]
    .map(a => a.href)
    .filter(h => h.match(/tim\.blog\/\d{4}\/\d{2}\/\d{2}\//))
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 5)
})
console.log('Episode URLs found:')
links.forEach(l => console.log(l))

// Check first episode for sponsors
if (links[0]) {
  await page.goto(links[0], { waitUntil: 'networkidle', timeout: 30000 })
  const content = await page.evaluate(() => document.body.innerText)
  const sponsorIdx = content.search(/This episode is brought to you by|Sponsors of|This episode.*sponsor/i)
  if (sponsorIdx > -1) {
    console.log('\n✅ Sponsor section found:')
  console.log(content.slice(sponsorIdx, sponsorIdx + 1000))
  } else {
    console.log('\nNo explicit sponsor section — showing last 1000 chars:')
    console.log(content.slice(-1000))
  }
}

await browser.close()
