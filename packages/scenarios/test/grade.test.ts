import { describe, expect, it } from 'vitest'
import { gradeSubmission, rebuildSheet } from '../src/grade.ts'
import { scenarioById } from '../src/index.ts'

const SMV = 'smv-wahl'

describe('gradeSubmission — the authoritative scoring path', () => {
  it('awards the points for a correct formula', () => {
    const grade = gradeSubmission({
      scenarioId: SMV,
      taskId: 'smv-gesamt',
      inputs: { B8: '=SUMME(B2:B6)' },
    })
    expect(grade.passed).toBe(true)
    expect(grade.points).toBe(2)
    expect(grade.skills).toContain('N1')
  })

  it('awards nothing for the right number typed by hand', () => {
    const grade = gradeSubmission({
      scenarioId: SMV,
      taskId: 'smv-gesamt',
      inputs: { B8: '220' },
    })
    expect(grade.passed).toBe(false)
    expect(grade.points).toBe(0)
    expect(grade.message).toContain('Formel')
  })

  it('grades a fill-down task across the whole range', () => {
    const dragged = Object.fromEntries(
      [2, 3, 4, 5, 6].map((row) => [`C${row}`, `=B${row}/$B$8`]),
    )
    const grade = gradeSubmission({
      scenarioId: SMV,
      taskId: 'smv-anteil',
      inputs: { B8: '=SUMME(B2:B6)', ...dragged },
    })
    expect(grade.passed).toBe(true)
    expect(grade.points).toBe(4)
  })

  it('rejects a column whose displayed values are right but typed', () => {
    const grade = gradeSubmission({
      scenarioId: SMV,
      taskId: 'smv-anteil',
      inputs: {
        B8: '=SUMME(B2:B6)',
        C2: '=B2/$B$8',
        C3: '0,2636', C4: '0,1455', C5: '0,2955', C6: '0,0909',
      },
    })
    expect(grade.passed).toBe(false)
    expect(grade.message).toContain('C3')
  })
})

describe('re-seeding blocks tampering with the source data', () => {
  it('ignores an input that would overwrite a seeded cell', () => {
    const sheet = rebuildSheet(scenarioById(SMV), { inputs: { B2: "9999", B8: "=SUMME(B2:B6)" } })
    expect(sheet.getValue('B2')).toBe(45)
    expect(sheet.getValue('B8')).toBe(220)
  })

  it('cannot be made to pass by rewriting the numbers behind the answer', () => {
    // Without re-seeding, moving B2 to 9999 would move both the answer and the key together.
    const grade = gradeSubmission({
      scenarioId: SMV,
      taskId: 'smv-gesamt',
      inputs: { B2: '9999', B8: '9999' },
    })
    expect(grade.passed).toBe(false)
  })
})

describe('sorting is replayed server-side, never trusted as data', () => {
  const range = {
    start: { row: 3, col: 1, colAbs: false, rowAbs: false },
    end: { row: 7, col: 7, colAbs: false, rowAbs: false },
  }

  it('awards the sort points when the operation is replayed onto a fresh seed', () => {
    const grade = gradeSubmission({
      scenarioId: 'vermoegen',
      taskId: 'verm-sortieren',
      inputs: {},
      sorts: [{ range, by: 1, direction: 'asc' }],
    })
    expect(grade.passed).toBe(true)
    expect(grade.points).toBe(2)
  })

  it('ignores rearranged rows sent as plain inputs', () => {
    // A crafted request claiming the table is already sorted. The seeded cells are re-seeded,
    // so the claim never reaches the sheet.
    const grade = gradeSubmission({
      scenarioId: 'vermoegen',
      taskId: 'verm-sortieren',
      inputs: { B4: 'Arthur', B5: 'Hannes', B6: 'Karin', B7: 'Max', B8: 'Zola' },
    })
    expect(grade.passed).toBe(false)
  })

  it('rejects a sort of the name column alone', () => {
    const grade = gradeSubmission({
      scenarioId: 'vermoegen',
      taskId: 'verm-sortieren',
      inputs: {},
      sorts: [
        {
          range: { start: range.start, end: { row: 7, col: 1, colAbs: false, rowAbs: false } },
          by: 1,
          direction: 'asc',
        },
      ],
    })
    expect(grade.passed).toBe(false)
    expect(grade.message).toContain('ganze Zeile')
  })

  it('keeps the student formulas correct after the replay', () => {
    // Formulas were entered before sorting, so their recorded addresses are the post-sort ones.
    const grade = gradeSubmission({
      scenarioId: 'vermoegen',
      taskId: 'verm-gesamt-person',
      inputs: {
        G4: '=SUMME(C4:F4)', G5: '=SUMME(C5:F5)', G6: '=SUMME(C6:F6)',
        G7: '=SUMME(C7:F7)', G8: '=SUMME(C8:F8)',
      },
      sorts: [{ range, by: 1, direction: 'asc' }],
    })
    expect(grade.passed).toBe(true)
  })
})
