/**
 * Checker tests driven by real exam data.
 *
 * The SMV-Wahl sheet and its solution formulas are taken verbatim from the 2026 Quali
 * (Prüfungsteil B, Blatt 3), including the expected percentages from the Musterlösung.
 */

import { describe, expect, it } from 'vitest'
import {
  filledDown,
  hasAbsoluteRef,
  isFormula,
  matchesSolution,
  runChecks,
  sortedBy,
  usesFunction,
  usesOperator,
  type Check,
  type TaskContext,
} from '../src/checks.ts'
import { Sheet } from '../src/sheet.ts'

/** Blatt 3 „SMV Wahl" — Lukas 45, Mia 58, Ben 32, Sina 65, Noah 20. */
function smvSheet(): Sheet {
  const sheet = new Sheet('SMV Wahl')
  sheet.load({
    A1: 'Lukas', B1: 45,
    A2: 'Mia', B2: 58,
    A3: 'Ben', B3: 32,
    A4: 'Sina', B4: 65,
    A5: 'Noah', B5: 20,
  })
  return sheet
}

function ctx(sheet: Sheet, target: string, solution?: string): TaskContext {
  return { sheet, target, solution }
}

function expectPass(checks: Check[], context: TaskContext): void {
  const outcome = runChecks(checks, context)
  expect(outcome.messages.join(' ')).toBe('')
  expect(outcome.passed).toBe(true)
}

function expectFail(checks: Check[], context: TaskContext): string {
  const outcome = runChecks(checks, context)
  expect(outcome.passed).toBe(false)
  return outcome.messages[0] ?? ''
}

describe('Aufgabe 1 — Gesamtstimmen (=SUMME(B1:B5) → 220)', () => {
  const checks = [isFormula(), usesFunction('SUMME'), matchesSolution()]
  const solution = '=SUMME(B1:B5)'

  it('accepts the real solution', () => {
    const sheet = smvSheet()
    sheet.setInput('B8', '=SUMME(B1:B5)')
    expect(sheet.getValue('B8')).toBe(220)
    expectPass(checks, ctx(sheet, 'B8', solution))
  })

  it('rejects the correct number typed by hand', () => {
    const sheet = smvSheet()
    sheet.setInput('B8', '220')
    const message = expectFail(checks, ctx(sheet, 'B8', solution))
    expect(message).toContain('220')
    expect(message).toContain('=')
  })

  it('rejects addition without the required function', () => {
    const sheet = smvSheet()
    sheet.setInput('B8', '=B1+B2+B3+B4+B5')
    expect(sheet.getValue('B8')).toBe(220)
    expect(expectFail(checks, ctx(sheet, 'B8', solution))).toContain('SUMME')
  })

  it('rejects an empty cell', () => {
    expect(expectFail(checks, ctx(smvSheet(), 'B8', solution))).toContain('leer')
  })
})

describe('Aufgabe 2 — Prozentanteil, „Absoluter Bezug auf $B$8 ist Pflicht"', () => {
  const checks = [isFormula(), hasAbsoluteRef('B8'), matchesSolution()]

  function withTotal(): Sheet {
    const sheet = smvSheet()
    sheet.setInput('B8', '=SUMME(B1:B5)')
    return sheet
  }

  it('accepts the absolute reference and matches the Musterlösung percentages', () => {
    const sheet = withTotal()
    sheet.setInput('C1', '=B1/$B$8')
    expectPass(checks, ctx(sheet, 'C1', '=B1/$B$8'))
    expect(sheet.getValue('C1')).toBeCloseTo(0.2045, 4)
  })

  it('rejects a relative reference even though the first row computes correctly', () => {
    const sheet = withTotal()
    sheet.setInput('C1', '=B1/B8')
    expect(sheet.getValue('C1')).toBeCloseTo(0.2045, 4)
    expect(expectFail(checks, ctx(sheet, 'C1', '=B1/$B$8'))).toContain('absolut')
  })

  it('produces the whole Musterlösung column when filled down', () => {
    const sheet = withTotal()
    for (let row = 1; row <= 5; row++) sheet.setInput(`C${row}`, `=B${row}/$B$8`)
    const percentages = [1, 2, 3, 4, 5].map(
      (row) => Math.round(Number(sheet.getValue(`C${row}`)) * 10000) / 100,
    )
    expect(percentages).toEqual([20.45, 26.36, 14.55, 29.55, 9.09])
  })
})

describe('Aufgabe 3 — WENN(B>50;"Gewählt";"Nicht gewählt")', () => {
  const solution = '=WENN(B1>50;"Gewählt";"Nicht gewählt")'
  const checks = [isFormula(), usesFunction('WENN'), matchesSolution()]

  it('accepts the solution and yields the expected verdicts', () => {
    const sheet = smvSheet()
    for (let row = 1; row <= 5; row++) {
      sheet.setInput(`D${row}`, `=WENN(B${row}>50;"Gewählt";"Nicht gewählt")`)
    }
    expectPass(checks, ctx(sheet, 'D1', solution))
    expect([1, 2, 3, 4, 5].map((row) => sheet.getValue(`D${row}`))).toEqual([
      'Nicht gewählt', 'Gewählt', 'Nicht gewählt', 'Gewählt', 'Nicht gewählt',
    ])
  })

  it('rejects the verdict typed as text', () => {
    const sheet = smvSheet()
    sheet.setInput('D1', 'Nicht gewählt')
    expect(expectFail(checks, ctx(sheet, 'D1', solution))).toContain('Formel')
  })
})

describe('filledDown — the fake-fill-down guard', () => {
  /** Stromverbrauch 2026: Kosten = Verbrauch × Preis pro kWh, with $G$2 pinned. */
  function stromSheet(): Sheet {
    const sheet = new Sheet('Stromverbrauch')
    sheet.load({ G2: 0.35, B3: 800, B4: 950, B5: 1300, B6: 350 })
    return sheet
  }

  it('accepts a correctly dragged formula', () => {
    const sheet = stromSheet()
    for (let row = 3; row <= 6; row++) sheet.setInput(`C${row}`, `=B${row}*$G$2`)
    expectPass([filledDown('C3:C6', '=B3*$G$2')], ctx(sheet, 'C3'))
  })

  it('catches results typed into the rest of the range', () => {
    const sheet = stromSheet()
    sheet.setInput('C3', '=B3*$G$2')
    sheet.setInput('C4', '332,5') // the right number, typed
    sheet.setInput('C5', '455')
    sheet.setInput('C6', '122,5')

    const message = expectFail([filledDown('C3:C6', '=B3*$G$2')], ctx(sheet, 'C3'))
    expect(message).toContain('C4')
    expect(message).toContain('einzutippen')
  })

  it('catches a pinned reference that should have moved', () => {
    const sheet = stromSheet()
    for (let row = 3; row <= 6; row++) sheet.setInput(`C${row}`, '=$B$3*$G$2')
    const message = expectFail([filledDown('C3:C6', '=B3*$G$2')], ctx(sheet, 'C3'))
    expect(message).toContain('C3')
    expect(message).toContain('$')
  })

  it('catches a relative reference that should have been pinned', () => {
    const sheet = stromSheet()
    for (let row = 3; row <= 6; row++) sheet.setInput(`C${row}`, `=B${row}*G${row - 1}`)
    const message = expectFail([filledDown('C3:C6', '=B3*$G$2')], ctx(sheet, 'C3'))
    expect(message).toContain('C3')
    expect(message).toContain('$')
  })

  it('blames the dragged cell, not the anchor, when only the drag is wrong', () => {
    const sheet = stromSheet()
    sheet.setInput('C3', '=B3*$G$2')
    for (let row = 4; row <= 6; row++) sheet.setInput(`C${row}`, '=B3*$G$2')
    const message = expectFail([filledDown('C3:C6', '=B3*$G$2')], ctx(sheet, 'C3'))
    expect(message).toContain('C4')
    expect(message).toContain('mitwandern')
  })

  it('reports the first empty cell rather than silently passing a short fill', () => {
    const sheet = stromSheet()
    sheet.setInput('C3', '=B3*$G$2')
    sheet.setInput('C4', '=B4*$G$2')
    expect(expectFail([filledDown('C3:C6', '=B3*$G$2')], ctx(sheet, 'C3'))).toContain('C5')
  })

  it('ignores cosmetic differences in typing', () => {
    const sheet = stromSheet()
    sheet.setInput('C3', '= B3 * $G$2')
    sheet.setInput('C4', '=b4*$g$2')
    sheet.setInput('C5', '=B5*$G$2')
    sheet.setInput('C6', '=B6*$G$2')
    expectPass([filledDown('C3:C6', '=B3*$G$2')], ctx(sheet, 'C3'))
  })
})

describe('Felder berechnen — „Produkt rote Felder"', () => {
  const checks = [isFormula(), usesOperator('*'), matchesSolution()]

  function felder(): Sheet {
    const sheet = new Sheet('Felder berechnen')
    sheet.load({ C6: 10.8, E6: 78, C4: 120, E4: 45 })
    return sheet
  }

  it('accepts a product formula', () => {
    const sheet = felder()
    sheet.setInput('F16', '=C6*E6')
    expectPass(checks, ctx(sheet, 'F16', '=C6*E6'))
  })

  it('rejects the product typed as a literal', () => {
    const sheet = felder()
    sheet.setInput('F16', '842,4')
    expect(expectFail(checks, ctx(sheet, 'F16', '=C6*E6'))).toContain('842,4')
  })
})

describe('matchesSolution works against randomised data', () => {
  it('derives the expected value from the solution, not a stored number', () => {
    for (const seed of [1, 7, 42, 99]) {
      const sheet = new Sheet('Zufall')
      sheet.load({ A1: seed * 3, A2: seed * 5, A3: seed * 7 })
      sheet.setInput('A4', '=SUMME(A1:A3)')
      expectPass([isFormula(), usesFunction('SUMME'), matchesSolution()],
        ctx(sheet, 'A4', '=SUMME(A1:A3)'))
      expect(sheet.getValue('A4')).toBe(seed * 15)
    }
  })
})

describe('English function names surface the German hint, not a generic message', () => {
  it('names SUMME when the student wrote SUM', () => {
    const sheet = smvSheet()
    sheet.setInput('B8', '=SUM(B1:B5)')
    const message = expectFail(
      [isFormula(), usesFunction('SUMME'), matchesSolution()],
      ctx(sheet, 'B8', '=SUMME(B1:B5)'),
    )
    expect(message).toContain('englische')
    expect(message).toContain('SUMME')
  })

  it('still gives the plain prompt when the function is simply missing', () => {
    const sheet = smvSheet()
    sheet.setInput('B8', '=B1+B2+B3+B4+B5')
    const message = expectFail(
      [isFormula(), usesFunction('SUMME'), matchesSolution()],
      ctx(sheet, 'B8', '=SUMME(B1:B5)'),
    )
    expect(message).toContain('Verwende')
    expect(message).not.toContain('englische')
  })
})

/**
 * Sorting — Quali 2025, Blatt 1: „Sortiere die Werte B4 - H8 nach Namen".
 * The family is handed out reverse alphabetical, which is what makes it work.
 */
function vermoegenSheet(): Sheet {
  const sheet = new Sheet('Tabelle1')
  sheet.load({
    B3: 'Name', C3: 'Sparschwein', D3: 'Bankkonto', E3: 'Geldbörse', F3: 'Sofaritze',
    B4: 'Zola', C4: 0, D4: 0, E4: 0, F4: 100,
    B5: 'Max', C5: 27, D5: 234, E5: 30, F5: 0,
    B6: 'Karin', C6: 14, D6: 1421, E6: 14, F6: 0,
    B7: 'Hannes', C7: 20, D7: 5232, E7: 221, F7: 0,
    B8: 'Arthur', C8: 30, D8: 434, E8: 8, F8: 0,
  })
  return sheet
}

const wholeTable = { start: cellRef(3, 1), end: cellRef(7, 7) }

function cellRef(row: number, col: number) {
  return { row, col, colAbs: false, rowAbs: false }
}

describe('sorting moves whole rows', () => {
  it('carries every column along and puts the names in order', () => {
    const sheet = vermoegenSheet()
    sheet.sortRows({ range: wholeTable, by: 1, direction: 'asc' })

    expect([4, 5, 6, 7, 8].map((row) => sheet.getValue(`B${row}`)))
      .toEqual(['Arthur', 'Hannes', 'Karin', 'Max', 'Zola'])
    // Arthur's 434 has to travel with Arthur.
    expect(sheet.getValue('D4')).toBe(434)
    expect(sheet.getValue('D8')).toBe(0)
  })

  it('sorts descending too, for „nach Infizierten absteigend"', () => {
    const sheet = vermoegenSheet()
    sheet.sortRows({ range: wholeTable, by: 3, direction: 'desc' })
    expect([4, 5, 6, 7, 8].map((row) => sheet.getValue(`D${row}`)))
      .toEqual([5232, 1421, 434, 234, 0])
  })

  it('translates formulas by the distance their row moved', () => {
    const sheet = vermoegenSheet()
    for (const row of [4, 5, 6, 7, 8]) sheet.setInput(`G${row}`, `=SUMME(C${row}:F${row})`)
    sheet.sortRows({ range: wholeTable, by: 1, direction: 'asc' })

    // Zola's row went from 4 to 8, so her formula must have followed.
    expect(sheet.getInput('G8')).toBe('=SUMME(C8:F8)')
    expect(sheet.getValue('G8')).toBe(100)
    expect(sheet.getValue('G4')).toBe(472)
  })

  it('leaves blank rows at the bottom in both directions', () => {
    const sheet = vermoegenSheet()
    const withBlank = { start: cellRef(3, 1), end: cellRef(8, 7) }
    sheet.sortRows({ range: withBlank, by: 1, direction: 'desc' })
    expect(sheet.getValue('B9')).toBeNull()
    expect(sheet.getValue('B4')).toBe('Zola')
  })
})

describe('sortedBy catches the classic mistake', () => {
  const sorted = sortedBy('B4:H8', 'B', 'asc')

  it('passes once the whole table is sorted', () => {
    const sheet = vermoegenSheet()
    sheet.sortRows({ range: wholeTable, by: 1, direction: 'asc' })
    expect(sorted({ sheet, target: 'B4', pristine: vermoegenSheet() }).passed).toBe(true)
  })

  it('fails while the table is untouched', () => {
    const sheet = vermoegenSheet()
    const result = sorted({ sheet, target: 'B4', pristine: vermoegenSheet() })
    expect(result.passed).toBe(false)
    expect(result.message).toContain('sortiert')
  })

  it('rejects sorting only the name column, which scrambles every record', () => {
    const sheet = vermoegenSheet()
    // „Sortiere NUR die Namen" — the names come out right and the money is wrong.
    sheet.sortRows({ range: { start: cellRef(3, 1), end: cellRef(7, 1) }, by: 1, direction: 'asc' })
    const result = sorted({ sheet, target: 'B4', pristine: vermoegenSheet() })
    expect(result.passed).toBe(false)
    expect(result.message).toContain('ganze Zeile')
  })

  it('does not mind the columns the student computed themselves', () => {
    const sheet = vermoegenSheet()
    for (const row of [4, 5, 6, 7, 8]) sheet.setInput(`G${row}`, `=SUMME(C${row}:F${row})`)
    sheet.sortRows({ range: wholeTable, by: 1, direction: 'asc' })
    expect(sorted({ sheet, target: 'B4', pristine: vermoegenSheet() }).passed).toBe(true)
  })
})
