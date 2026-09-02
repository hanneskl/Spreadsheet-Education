import { chromium } from 'playwright'

const OUT = process.env.SHOT_DIR || '/tmp/quali-shots'

const browser = await chromium.launch({
  // Set CHROMIUM_PATH when the sandbox ships a browser build Playwright did not download.
  executablePath: process.env.CHROMIUM_PATH || undefined,
})
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } })

const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })

/** Click a cell by its A1 address and type into it. */
async function type(a1, text) {
  const col = a1.match(/^[A-Z]+/)[0]
  const row = Number(a1.match(/\d+$/)[0])
  const colIndex = col.charCodeAt(0) - 65
  const cell = page.locator(`table tbody tr:nth-child(${row}) td`).nth(colIndex)
  // Click to select, then type — Excel semantics: typing replaces the cell's contents.
  await cell.click()
  await page.keyboard.type(text)
  await page.keyboard.press('Enter')
}

async function checkTask(index) {
  await page.locator('.task').nth(index).getByRole('button', { name: 'Prüfen' }).click()
}

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log(`  → ${name}.png`)
}

console.log('1. initial load')
await shot('01-initial')

console.log('2. type the right number by hand into B8, then check')
await type('B8', '220')
await checkTask(0)
await page.waitForTimeout(150)
await shot('02-typed-number-rejected')
console.log('   feedback:', (await page.locator('.task.failed .feedback').first().textContent())?.trim())

console.log('3. try the English function name')
await type('B8', '=SUM(B2:B6)')
await checkTask(0)
await page.waitForTimeout(150)
console.log('   feedback:', (await page.locator('.task.failed .feedback').first().textContent())?.trim())
await shot('03-english-name-hint')

console.log('4. correct formula')
await type('B8', '=SUMME(B2:B6)')
await checkTask(0)
await page.waitForTimeout(150)

console.log('5. relative reference where $ is required')
await type('C2', '=B2/B8')
await checkTask(1)
await page.waitForTimeout(150)
console.log('   feedback:', (await page.locator('.task.failed .feedback').first().textContent())?.trim())
await shot('04-relative-ref-rejected')

console.log('6. absolute ref in C2, but the rest of the column typed by hand')
await type('C2', '=B2/$B$8')
await type('C3', '0,2636')
await type('C4', '0,1455')
await type('C5', '0,2955')
await type('C6', '0,0909')
await checkTask(1)
await page.waitForTimeout(150)
console.log('   feedback:', (await page.locator('.task.failed .feedback').first().textContent())?.trim())
await shot('05-fake-filldown-caught')

console.log('7. proper fill-down and the WENN column')
for (let row = 2; row <= 6; row++) await type(`C${row}`, `=B${row}/$B$8`)
for (let row = 2; row <= 6; row++) {
  await type(`D${row}`, `=WENN(B${row}>50;"Gewählt";"Nicht gewählt")`)
}
await page.getByRole('button', { name: 'Alles prüfen' }).click()
await page.waitForTimeout(200)
await shot('06-all-passed')
console.log('   score:', (await page.locator('.score').textContent())?.trim())

console.log('8. second scenario — Felder berechnen')
await page.locator('select').first().selectOption('felder-berechnen')
await page.waitForTimeout(200)
await shot('07-felder-berechnen')

await type('F9', '=SUMME(B2:E2)')
await type('F10', '=SUMME(B7:E7)')
await type('F11', '=B4*E4')
await type('F12', '=E6/D3')
await page.getByRole('button', { name: 'Alles prüfen' }).click()
await page.waitForTimeout(200)
await shot('08-felder-passed')
console.log('   score:', (await page.locator('.score').textContent())?.trim())
console.log('   Quotient gelbe Felder =', (await page.locator('table tbody tr:nth-child(12) td').nth(4).textContent())?.trim())

console.log(errors.length ? `\nCONSOLE ERRORS:\n${errors.join('\n')}` : '\nno console errors')
await browser.close()
