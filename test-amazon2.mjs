
import { chromium } from 'playwright'

const browser = await chromium.launch({ 
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--window-size=1920,1080',
  ]
})

const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  viewport: { width: 1920, height: 1080 },
  locale: 'en-US',
  timezoneId: 'America/New_York',
})

const page = await context.newPage()

// Hide webdriver property
await page.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
})

await page.goto('https://www.amazon.com/shop/hubermanlab', { 
  waitUntil: 'domcontentloaded', 
  timeout: 60000 
})
await page.waitForTimeout(5000)
const content = await page.evaluate(() => document.body.innerText)
console.log('Page length:', content.length)
console.log(content.substring(0, 1500))

await browser.close()
