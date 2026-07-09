import { chromium } from 'playwright'
import readline from 'readline'

const run = async () => {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--app=http://localhost:8081/'] // opens without browser chrome
  })
  
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'dark', // dark mode
  })

  const page = await context.newPage()
  await page.goto('http://localhost:8081/')

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  await new Promise(resolve => rl.question('Press Enter to close the browser...', (ans) => {
    rl.close()
    resolve(ans)
  }))

  await browser.close()
}

run()