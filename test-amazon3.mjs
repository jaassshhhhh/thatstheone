
import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

chromium.use(StealthPlugin())

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

await page.goto('https://www.amazon.com/shop/hubermanlab', { 
  waitUntil: 'domcontentloaded', 
  timeout: 60000 
})
await page.waitForTimeout(5000)
const content = await page.evaluate(() => document.body.innerText)
console.log('Page length:', content.length)
console.log(content.substring(0, 1500))

await browser.close()
