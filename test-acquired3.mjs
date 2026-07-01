
import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

await page.goto('https://www.acquired.fm/episodes', { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(3000)

const links = await page.evaluate(() => {
  return [...document.querySelectorAll('a[href]')]
    .map(a => a.href)
    .filter(h => h.includes('acquired.fm/episodes/'))
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 3)
})
console.log('Episodes:', links)

if (links[0]) {
  await page.goto(links[0], { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(3000)
  const content = await page.evaluate(() => document.body.innerText)
  const idx = content.search(/sponsor|brought to you|partner|promo|code/i)
  if (idx > -1) {
    console.log('Sponsor found:')
    console.log(content.substring(Math.max(0, idx - 100), idx + 800))
  } else {
    console.log('No sponsors. Preview:')
    console.log(content.substring(0, 800))
  }
}

await browser.close()
