/**
 * The formula bar as an input, not just as a readout.
 *
 * Every other driver types into cells and only *reads* `.formula-input`, which is why a crash
 * on Backspace in the bar went unnoticed. This one edits there directly.
 */
import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const p = await b.newPage({ viewport: { width: 1280, height: 820 } })
const errs = []; p.on('pageerror', e => errs.push(String(e)))
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' })

const cell = a1 => {
  const c = a1.match(/^[A-Z]+/)[0].charCodeAt(0) - 65
  const r = Number(a1.match(/\d+$/)[0])
  return p.locator(`table tbody tr:nth-child(${r}) td`).nth(c)
}
const bar = p.locator('.formula-input')
const inputOf = async a1 => { await cell(a1).click(); return (await bar.inputValue()).trim() }
const fails = []
const expect = (l, a, w) => { const ok = a === w; console.log(`  ${ok?'✓':'✗'} ${l}: ${a}${ok?'':`  (erwartet ${w})`}`); if(!ok) fails.push(l) }
const alive = async l => expect(l, String(await p.locator('.ribbon').count()), '1')

// Backspace on an empty bar — the reported crash.
await cell('B8').click(); await bar.click(); await p.keyboard.press('Backspace')
await p.waitForTimeout(80)
await alive('Backspace im leeren Feld stürzt nicht ab')

// Type, then backspace the tail away, then finish the formula.
await bar.click(); await p.keyboard.type('=SUMMEX')
await p.keyboard.press('Backspace')
await p.waitForTimeout(80)
await alive('Backspace nach Tippen stürzt nicht ab')
await p.keyboard.type('(B2:B6)'); await p.keyboard.press('Enter')
await p.waitForTimeout(120)
expect('Bearbeitung in der Leiste kommt an', await inputOf('B8'), '=SUMME(B2:B6)')

// Backspace a filled cell down to empty from the bar.
await cell('B8').click(); await bar.click()
for (let i = 0; i < 20; i++) await p.keyboard.press('Backspace')
await p.keyboard.press('Enter'); await p.waitForTimeout(120)
await alive('Leerlöschen stürzt nicht ab')
expect('Leerlöschen leert die Zelle', await inputOf('B8'), '')

// Delete and arrow keys must not be swallowed by point mode either.
await bar.click(); await p.keyboard.type('=1+2')
await p.keyboard.press('ArrowLeft'); await p.keyboard.press('Delete')
await p.keyboard.press('Enter'); await p.waitForTimeout(120)
await alive('Pfeil + Delete stürzen nicht ab')

console.log(errs.length ? `ERRORS: ${errs.join('\n')}` : 'no page errors')
console.log(fails.length || errs.length ? `FAILED: ${fails.join(', ') || 'page errors'}` : 'all formula-bar checks passed')
await b.close(); process.exit(fails.length || errs.length ? 1 : 0)
