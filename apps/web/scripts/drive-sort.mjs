/**
 * Sorting (skill S2) on the 2025 Vermögen sheet.
 *
 * Covers the task the exam actually sets and the mistake it is designed to catch: sorting only
 * the name column, which leaves every balance with the wrong person.
 */
import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
const errs = []; p.on('pageerror', e => errs.push(String(e)))
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await p.locator('select').first().selectOption('vermoegen')
await p.waitForTimeout(200)

const pos = a1 => ({
  col: a1.match(/^[A-Z]+/)[0].charCodeAt(0) - 65,
  row: Number(a1.match(/\d+$/)[0]),
})
const cell = a1 => {
  const { row, col } = pos(a1)
  return p.locator(`table tbody tr:nth-child(${row}) td`).nth(col)
}
const textOf = async a1 => (await cell(a1).innerText()).trim()
const select = async (from, to) => {
  await cell(from).click()
  await cell(to).click({ modifiers: ['Shift'] })
}
const fails = []
const expect = (l, a, w) => { const ok = String(a) === String(w); console.log(`  ${ok?'✓':'✗'} ${l}: ${a}${ok?'':`  (erwartet ${w})`}`); if(!ok) fails.push(l) }
const taskCard = name => p.locator('.task').filter({ hasText: name })
const checkTask = async name => {
  const card = taskCard(name)
  await card.getByRole('button', { name: 'Prüfen' }).click()
  await p.waitForTimeout(200)
  return (await card.innerText()).trim()
}

// The sheet is handed out reverse alphabetical — that is what makes the task work.
expect('Ausgangsreihenfolge', await textOf('B4'), 'Zola')

// 1. The trap: sort the name column on its own.
await select('B4', 'B8')
await p.locator('.split .chev[title="Sortieren und Filtern"]').click()
await p.locator('.sort-form .menu-item', { hasText: 'Aufsteigend' }).click()
await p.waitForTimeout(200)
expect('nur Namen sortiert → Namen stimmen', await textOf('B4'), 'Arthur')
expect('nur Namen sortiert → Geld bleibt liegen', await textOf('D4'), '0')
const trapped = await checkTask('Sortiere die Werte')
expect('Falle wird erkannt', /ganze Zeile/.test(trapped), 'true')

// 2. Undo the damage and do it properly over the whole table.
await p.getByRole('button', { name: 'Zurücksetzen' }).click()
await p.waitForTimeout(200)
await select('B4', 'H8')
await p.locator('.split .chev[title="Sortieren und Filtern"]').click()
await p.locator('.sort-form .menu-item', { hasText: 'Aufsteigend' }).click()
await p.waitForTimeout(200)
expect('ganze Tabelle sortiert', await textOf('B4'), 'Arthur')
expect('Bankkonto wandert mit', await textOf('D4'), '434')
expect('Zola landet unten', await textOf('B8'), 'Zola')
const passed = await checkTask('Sortiere die Werte')
expect('Aufgabe bestanden', /2 P/.test(passed) || /✓/.test(passed), 'true')

// 3. Sorting by a chosen column, the „nach Infizierten absteigend" shape.
await select('B4', 'H8')
await p.locator('.split .chev[title="Sortieren und Filtern"]').click()
await p.locator('.sort-form select').selectOption({ label: 'Bankkonto (D)' })
await p.locator('.sort-form .menu-item', { hasText: 'Absteigend' }).click()
await p.waitForTimeout(200)
expect('nach Bankkonto absteigend', await textOf('B4'), 'Hannes')
expect('grösster Kontostand oben', await textOf('D4'), '5.232')

// 4. Formulas entered before sorting must travel with their row.
await p.getByRole('button', { name: 'Zurücksetzen' }).click()
await p.waitForTimeout(200)
await cell('G4').click(); await p.keyboard.type('=SUMME(C4:F4)'); await p.keyboard.press('Enter')
expect('Zolas Vermögen vor dem Sortieren', await textOf('G4'), '100')
await select('B4', 'H8')
await p.locator('.split .chev[title="Sortieren und Filtern"]').click()
await p.locator('.sort-form .menu-item', { hasText: 'Aufsteigend' }).click()
await p.waitForTimeout(200)
expect('Formel wandert nach Zeile 8', await textOf('G8'), '100')
await cell('G8').click()
expect('und wurde mitgezogen', (await p.locator('.formula-input').inputValue()).trim(), '=SUMME(C8:F8)')

console.log(errs.length ? `ERRORS: ${errs.join('\n')}` : 'no page errors')
console.log(fails.length || errs.length ? `FAILED: ${fails.join(', ') || 'page errors'}` : 'all sort checks passed')
await b.close(); process.exit(fails.length || errs.length ? 1 : 0)
