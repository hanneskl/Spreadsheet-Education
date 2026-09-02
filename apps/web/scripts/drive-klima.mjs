/**
 * Drives the 2022 Klima sheet: sheet rename, merge, aggregates, two conditional-formatting
 * rules and a pie chart over a row-oriented range.
 *
 *   npm run dev --workspace @quali/web
 *   npm run drive:klima --workspace @quali/web
 */

import { chromium } from 'playwright'

const OUT = process.env.SHOT_DIR || '/tmp/quali-shots'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.locator('select').first().selectOption('klima')
await page.waitForTimeout(250)

const colLetter = (a1) => a1.match(/^[A-Z]+/)[0]
const cell = (a1) => {
  const col = colLetter(a1).charCodeAt(0) - 65
  const row = Number(a1.match(/\d+$/)[0])
  return page.locator(`table tbody tr:nth-child(${row}) td`).nth(col)
}
const fails = []
const expect = (l, a, w) => {
  const ok = a === w
  console.log(`  ${ok ? '✓' : '✗'} ${l}: ${a}${ok ? '' : `  (erwartet ${w})`}`)
  if (!ok) fails.push(l)
}
async function checkTask(index, label, wanted = 'task passed') {
  await page.locator('.task').nth(index).getByRole('button', { name: 'Prüfen' }).click()
  await page.waitForTimeout(150)
  const cls = await page.locator('.task').nth(index).getAttribute('class')
  expect(label, cls, wanted)
  if (cls !== wanted) {
    const fb = page.locator('.task').nth(index).locator('.feedback')
    if (await fb.count()) console.log(`     Rückmeldung: ${(await fb.textContent()).trim()}`)
  }
}
async function typeInto(a1, text) {
  await cell(a1).click(); await page.keyboard.type(text); await page.keyboard.press('Enter')
}
async function selectRange(from, to) {
  await cell(from).hover(); await page.mouse.down(); await cell(to).hover(); await page.mouse.up()
}

console.log('\n1. rename the sheet tab')
await page.locator('.tab').dblclick()
await page.locator('.tab-input').fill('Klima')
await page.keyboard.press('Enter')
await page.waitForTimeout(150)
await checkTask(0, 'Registerblatt umbenannt')

console.log('\n2. merge and title')
await typeInto('A1', 'Klima 2022')
await selectRange('A1', 'M1')
await page.locator('.ribbon [title="Verbinden und zentrieren"]').click()
await checkTask(1, 'Titel verbunden')

console.log('\n3. the four aggregates')
await typeInto('B9', '=SUMME(B3:M3)')
await typeInto('B10', '=MITTELWERT(B4:M4)')
await typeInto('B11', '=MAX(B4:M4)')
await typeInto('B12', '=MIN(B3:M3)')
await checkTask(2, 'Niederschlag gesamt')
await checkTask(3, 'Durchschnittstemperatur')
await checkTask(4, 'Höchste Temperatur')
await checkTask(5, 'Geringster Niederschlag')
expect('Summe Niederschlag', (await cell('B9').textContent()).trim(), '939')
expect('Höchste Temperatur', (await cell('B11').textContent()).trim(), '19')

console.log('\n4. two conditional-formatting rules')
async function addRule(kind, value, colour) {
  await selectRange('B4', 'M4')
  await page.locator('.ribbon [title="Regel wählen"]').click()
  await page.locator('.cf-form select').first().selectOption(kind)
  await page.locator('.cf-form input').first().fill(value)
  await page.locator(`.cf-form .swatch[title="${colour}"]`).click()
  await page.locator('.cf-apply').click()
  await page.waitForTimeout(150)
}
await addRule('lessThan', '5', 'Hellblau')
await checkTask(6, 'Regel unter 5 °C')
await addRule('greaterThan', '15', 'Rot')
await checkTask(7, 'Regel über 15 °C')

// The rules must actually paint: January is 2,6 °C and June is 19 °C.
const bg = (a1) => cell(a1).evaluate((el) => getComputedStyle(el).backgroundColor)
expect('Januar blau', await bg('B4'), 'rgb(207, 226, 243)')
expect('Juni rot', await bg('G4'), 'rgb(244, 204, 204)')
expect('Mai ungefärbt', await bg('F4'), 'rgba(0, 0, 0, 0)')

console.log('\n5. pie chart over a row-oriented range')
await selectRange('B2', 'M3')
await page.locator('.ribbon [title="Diagrammtyp wählen"]').click()
await page.locator('.menu-item', { hasText: 'Kreisdiagramm' }).click()
await page.waitForTimeout(200)
await checkTask(8, 'Kreisdiagramm')
expect('Diagramm liest 12 Monate', String(await page.locator('.chart-legend').count()), '12')

expect('Punktestand', (await page.locator('.score').textContent()).trim(), '10 / 10 Punkte')
await page.screenshot({ path: `${OUT}/50-klima.png` })
console.log(`  → 50-klima.png`)

console.log(errors.length ? `\nERRORS:\n${errors.join('\n')}` : '\nno console errors')
console.log(fails.length ? `\nFAILED: ${fails.join(', ')}` : '\nall Klima checks passed')
await browser.close()
process.exit(fails.length ? 1 : 0)
