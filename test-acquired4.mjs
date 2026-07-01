
import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

await page.goto('https://www.acquired.fm/episodes/the-walt-disney-company', { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(3000)
const content = await page.evaluate(() => document.body.innerText)

// Get everything after SEASON PARTNERS
const idx = content.indexOf('SEASON PARTNERS')
if (idx > -1) {
  console.log(content.substring(idx, idx + 1500))
}
