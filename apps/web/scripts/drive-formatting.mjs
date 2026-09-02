/**
 * Drives the formatting ribbon against the 2025 Vermögen scenario.
 *
 *   npm run dev --workspace @quali/web
 *   npm run drive:formatting --workspace @quali/web
 */

import { chromium } from 'playwright'

const OUT = process.env.SHOT_DIR || '/tmp/quali-shots'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.locator('select').first().selectOption('vermoegen')
await page.waitForTimeout(200)

const cell = (a1) => {
  const col = a1.match(/^[A-Z]+/)[0].charCodeAt(0) - 65
  const row = Number(a1.match(/\d+$/)[0])
  return page.locator(`table tbody tr:nth-child(${row}) td`).nth(col)
}
const fails = []
const expect = (l, a, w) => {
  const ok = a === w
  console.log(`  ${ok ? '✓' : '✗'} ${l}: ${a}${ok ? '' : `  (erwartet ${w})`}`)
  if (!ok) fails.push(l)
}
/** Address tasks by their wording, not their position — the task list grows every feature. */
const task = (text) => page.locator('.task').filter({ hasText: text })
/** Assert a task's state and, when it is not what we wanted, show what the student would see. */
async function expectTask(label, text, wanted) {
  const actual = await task(text).getAttribute('class')
  expect(label, actual, wanted)
  if (actual !== wanted) {
    const fb = task(text).locator('.feedback')
    if (await fb.count()) console.log(`     Rückmeldung: ${(await fb.textContent()).trim()}`)
  }
}
const check = async (text) => {
  await task(text).getByRole('button', { name: 'Prüfen' }).click()
  await page.waitForTimeout(120)
}
async function sortWholeTable() {
  await selectRange('B4', 'H8')
  await page.locator('.split .chev[title="Sortieren und Filtern"]').click()
  await page.locator('.sort-form .menu-item', { hasText: 'Aufsteigend' }).click()
  await page.waitForTimeout(150)
}
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png` }); console.log(`  → ${n}.png`) }

/**
 * Hover the endpoints rather than moving to pre-measured coordinates: formatting changes the
 * grid's metrics, so any box read before the drag can be stale by the time we move there.
 */
async function selectRange(from, to) {
  await cell(from).hover()
  await page.mouse.down()
  await cell(to).hover()
  await page.mouse.up()
}

async function dragFillHandle(to) {
  await page.locator('.fill-handle').hover()
  await page.mouse.down()
  await cell(to).hover()
  await page.mouse.up()
}
const tool = (title) => page.locator(`.ribbon [title="${title}"]`)

/** Fill and font colours live behind the split button's chevron, as they do in Excel. */
async function pickFill(name) {
  await tool('Füllfarbe wählen').click()
  await page.locator(`.menu [title="${name}"]`).click()
}

console.log('\n1. Titel: verbinden, zentrieren, hellblau füllen')
await cell('B1').click()
await page.keyboard.type('Familienvermögen')
await page.keyboard.press('Enter')
await selectRange('B1', 'H1')
await tool('Verbinden und zentrieren').click()
await pickFill('Hellblau')
await check('Verbinde und zentriere')
await expectTask('Aufgabe 1 (F1+F2)', 'Verbinde und zentriere', 'task passed')

console.log('\n2. Gesamt je Person, heruntergezogen')
await cell('G4').click()
await page.keyboard.type('=SUMME(C4:F4)')
await page.keyboard.press('Enter')
await cell('G4').click()
await dragFillHandle('G8')
await check('für jedes Familienmitglied sein Vermögen')
await expectTask('Aufgabe 2 (SUMME + Ziehen)', 'für jedes Familienmitglied sein Vermögen', 'task passed')
// Still unsorted, so Hannes is in row 7.
expect('Hannes Gesamt', (await cell('G7').textContent()).trim(), '5.473')

console.log('\n3. Zeile 3 fett')
await selectRange('B3', 'H3')
await tool('Fett').click()
await check('Zeile 3 fett')
await expectTask('Aufgabe 3 (F3)', 'Zeile 3 fett', 'task passed')

console.log('\n4. C3:H8 zentrieren')
await selectRange('C3', 'H8')
await tool('Zentriert').click()
await check('zentriert in der Zelle')
await expectTask('Aufgabe 4 (F6)', 'zentriert in der Zelle', 'task passed')

console.log('\n5. Tabellenblatt umbenennen')
await page.locator('.tab').dblclick()
await page.locator('.tab-input').fill('Vermögen')
await page.keyboard.press('Enter')
await check('Benenne dieses Tabellenblatt')
await expectTask('Aufgabe 5 (S1)', 'Benenne dieses Tabellenblatt', 'task passed')

console.log('\n6. Sortieren nach Namen')
await sortWholeTable()
await check('Sortiere die Werte')
await expectTask('Aufgabe 6 (S2)', 'Sortiere die Werte', 'task passed')
expect('Arthur steht oben', (await cell('B4').textContent()).trim(), 'Arthur')
expect('Formel ist mitgewandert', (await cell('G4').textContent()).trim(), '472')

console.log('\n7. Summen pro Kategorie')
for (const [a1, formula] of [
  ['C10', '=SUMME(C4:C8)'], ['C11', '=SUMME(D4:D8)'],
  ['C12', '=SUMME(E4:E8)'], ['C13', '=SUMME(F4:F8)'],
]) {
  await cell(a1).click()
  await page.keyboard.type(formula)
  await page.keyboard.press('Enter')
}
await check('Summen pro Kategorie')
await expectTask('Aufgabe 7 (4 Punkte)', 'Summen pro Kategorie', 'task passed')
expect('Summe Bankkonto', (await cell('C11').textContent()).trim(), '7.321')

console.log('\n8. Gesamtvermögen')
await cell('C15').click()
await page.keyboard.type('=SUMME(G4:G8)')
await page.keyboard.press('Enter')
await check('gesamte Familienvermögen')
await expectTask('Aufgabe 8', 'gesamte Familienvermögen', 'task passed')
expect('Gesamtvermögen', (await cell('C15').textContent()).trim(), '7.785')

console.log('\n9. Prozentanteil mit Prozentformat')
await cell('H4').click()
await page.keyboard.type('=G4/$C$15')
await page.keyboard.press('Enter')
await cell('H4').click()
await dragFillHandle('H8')

// still unformatted → the number-format check must fail
await check('prozentualen Anteil')
await expectTask('Aufgabe 9 ohne Prozentformat', 'prozentualen Anteil', 'task failed')
const msg = (await task('prozentualen Anteil').locator('.feedback').textContent()).trim()
console.log(`     Rückmeldung: ${msg}`)

await selectRange('H4', 'H8')
await page.locator('.ribbon .numfmt').selectOption('percent:1')
await check('prozentualen Anteil')
await expectTask('Aufgabe 9 mit Prozentformat', 'prozentualen Anteil', 'task passed')
// Sorted, so Hannes sits in row 5 now.
expect('Anteil Hannes', (await cell('H5').textContent()).trim(), '70,3 %')
expect('Punktestand', (await page.locator('.score').textContent()).trim(), '21 / 21 Punkte')
await shot('20-vermoegen-formatted')

console.log(errors.length ? `\nERRORS:\n${errors.join('\n')}` : '\nno console errors')
console.log(fails.length ? `\nFAILED: ${fails.join(', ')}` : '\nall formatting checks passed')
await browser.close()
process.exit(fails.length ? 1 : 0)
