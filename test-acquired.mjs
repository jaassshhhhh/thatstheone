import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

await page.goto('https://www.acquired.fm/episodes', { waitUntil: 'networkidle', timeout: 30000 })
const links = await page.evaluate(() => {
  return [...document.querySelectorAll('a[href]')]
    .map(a => a.href)
    .filter(h => h.includes('acquired.fm/episodes/'))
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 3)
})
console.log('Episodes found:', links)

if (links[0]) {
  await page.goto(links[0], { waitUntil: 'networkidle', timeout: 30000 })
  const content = await page.evaluate(() => document.body.innerText)
  const idx = content.search(/sponsor|brought to you|partner|promo|code/i)
  if (idx > -1) {
    console.log('\n✅ Sponsor content:')
    console.log(content.slice(Math.max(0, idx - 50), idx + 600))
  } else {
    console.log('\nPreview:')
    console.log(content.slice(0, 600))
}
}

await browser.close()
