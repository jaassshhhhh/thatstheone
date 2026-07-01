import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

try {
  await page.goto('https://www.acquired.fm/episodes', { 
    waitUntil: 'domcontentloaded', 
    timeout: 60000 
  })
  // Wait a bit for JS to render
  await page.waitForTimeout(3000)
  const content = await page.evaluate(() => document.body.innerText)
  console.log('Page length:', content.length)
  console.log('Preview:')
  console.log(content.slice(0, 800))
} catch(e) {
  console.log('Error:', e.message)
}

await browser.close()
