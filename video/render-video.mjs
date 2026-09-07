import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, acceptDownloads: true })
const url = new URL('business-logic-video.html', import.meta.url).href
await page.goto(url)
const downloadPromise = page.waitForEvent('download', { timeout: 180000 })
await page.getByRole('button', { name: 'Start audio-guided recording' }).click()
const download = await downloadPromise
mkdirSync(resolve(root), { recursive: true })
await download.saveAs(resolve(root, 'trading-terminal-business-logic.webm'))
await browser.close()
console.log(resolve(root, 'trading-terminal-business-logic.webm'))
