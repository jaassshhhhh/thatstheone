import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto('https://tim.blog/2026/06/25/coca/', { waitUntil: 'networkidle', timeout: 30000 })
const content = await page.evaluate(() => document.body.innerText)
await browser.close()

const idx = content.search(/sponsor|promo|code|discount|offer/i)
if (idx > -1) {
  console.log('✅ Found sponsor content:')
  console.log(content.slice(Math.max(0, idx - 100), idx + 800))
} else {
  console.log('No sponsor signals — preview:')
  console.log(content.slice(0, 500))
}
