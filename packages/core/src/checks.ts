/**
 * Check predicates.
 *
 * Every predicate is pure, independently testable, and returns a German message on failure —
 * the message is the teaching surface, so it should say what is wrong without handing over the
 * answer.
 */

import { isKnownFunction, unknownFunctionError } from './functions.ts'
import { canonical, formatNode, parseFormula, translateNode, walk, type Node } from './parser.ts'
import { expandRange, formatA1, parseA1, type RangeRef } from './refs.ts'
import type { CellStyle, CfRule, ChartKind, ChartSpec, NumberFormat } from './model.ts'
import { isFormulaInput, type Sheet } from './sheet.ts'
import { isError, toText, type CellValue } from './values.ts'

export interface CheckResult {
  readonly passed: boolean
  readonly message: string
}

export interface TaskContext {
  readonly sheet: Sheet
  /** A1 address of the cell under test. */
  readonly target: string
  /** The task's solution, as a formula. The expected value is derived from it, never stored. */
  readonly solution?: string
  /**
   * The scenario as it was handed out, before the student touched it.
   *
   * Needed by checks that must know what the source data looked like — `sortedBy` compares the
   * student's rows against these to prove the records stayed intact.
   */
  readonly pristine?: Sheet
}

export type Check = (ctx: TaskContext) => CheckResult

const OK: CheckResult = { passed: true, message: '' }

function fail(message: string): CheckResult {
  return { passed: false, message }
}

const EPSILON = 1e-9

export function valuesEqual(a: CellValue, b: CellValue): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    if (a === b) return true
    return Math.abs(a - b) <= EPSILON * Math.max(1, Math.abs(a), Math.abs(b))
  }
  if (isError(a) || isError(b)) {
    return isError(a) && isError(b) && a.code === b.code
  }
  if (typeof a === 'string' || typeof b === 'string') {
    return toText(a).trim().toUpperCase() === toText(b).trim().toUpperCase()
  }
  return a === b
}

function astOf(sheet: Sheet, a1: string): Node | null {
  const ast = sheet.getAst(a1)
  return ast !== null && !(ast instanceof Error) ? ast : null
}

/* -------------------------------------------------------------------------- */
/* Formula-tier checks — the anti-cheat core                                   */
/* -------------------------------------------------------------------------- */

/**
 * The cell must contain a formula. This is the rule every exam states outright:
 * „Alle Berechnungen sind mit Formeln durchzuführen!"
 */
export function isFormula(): Check {
  return ({ sheet, target }) => {
    const input = sheet.getInput(target)
    if (input.trim() === '') {
      return fail(`${target} ist noch leer.`)
    }
    if (!isFormulaInput(input)) {
      return fail(
        `Du hast „${input.trim()}" eingetippt. Das Ergebnis muss mit einer Formel berechnet ` +
          `werden — beginne die Eingabe mit „=".`,
      )
    }
    const ast = sheet.getAst(target)
    if (ast instanceof Error) {
      return fail(`Die Formel in ${target} ist fehlerhaft: ${ast.message}`)
    }
    return OK
  }
}

/** The formula must call at least one of these functions. */
export function usesFunction(...names: string[]): Check {
  const wanted = names.map((name) => name.toUpperCase())
  return ({ sheet, target }) => {
    const ast = astOf(sheet, target)
    if (!ast) return fail(`In ${target} steht keine gültige Formel.`)

    let found = false
    let unknown: string | null = null
    walk(ast, (node) => {
      if (node.type !== 'call') return
      if (wanted.includes(node.name)) found = true
      else if (!isKnownFunction(node.name)) unknown ??= node.name
    })
    if (found) return OK

    // A misremembered name deserves the specific hint — most often the English one.
    if (unknown) return fail(unknownFunctionError(unknown).message)

    const list = wanted.join(' oder ')
    return fail(`Verwende in ${target} die Funktion ${list}.`)
  }
}

/** The formula must use this operator, e.g. `*` for „Produkt rote Felder". */
export function usesOperator(op: string): Check {
  return ({ sheet, target }) => {
    const ast = astOf(sheet, target)
    if (!ast) return fail(`In ${target} steht keine gültige Formel.`)

    let found = false
    walk(ast, (node) => {
      if (node.type === 'binary' && node.op === op) found = true
    })
    return found ? OK : fail(`Verwende in ${target} den Rechenoperator „${op}".`)
  }
}

/**
 * The formula must pin a reference with `$`. When `a1` is given, that specific cell must be
 * fully absolute — this is skill C5, „Absoluter Bezug auf $B$8 ist Pflicht".
 */
export function hasAbsoluteRef(a1?: string): Check {
  const wanted = a1 ? parseA1(a1) : null
  return ({ sheet, target }) => {
    const ast = astOf(sheet, target)
    if (!ast) return fail(`In ${target} steht keine gültige Formel.`)

    let found = false
    walk(ast, (node) => {
      if (node.type !== 'ref') return
      const { ref } = node
      if (wanted) {
        if (ref.col === wanted.col && ref.row === wanted.row && ref.colAbs && ref.rowAbs) {
          found = true
        }
      } else if (ref.colAbs || ref.rowAbs) {
        found = true
      }
    })
    if (found) return OK

    return fail(
      wanted
        ? `Der Bezug auf ${a1} muss absolut sein: schreibe $${a1!.replace(/(\D+)(\d+)/, '$1$$$2')}.`
        : `In ${target} fehlt ein absoluter Bezug mit „$".`,
    )
  }
}

/** The formula must NOT use any of these functions — for tasks that forbid a shortcut. */
export function avoidsFunction(...names: string[]): Check {
  const banned = names.map((name) => name.toUpperCase())
  return ({ sheet, target }) => {
    const ast = astOf(sheet, target)
    if (!ast) return OK
    let found: string | null = null
    walk(ast, (node) => {
      if (node.type === 'call' && banned.includes(node.name)) found = node.name
    })
    return found ? fail(`Löse ${target} ohne die Funktion ${found}.`) : OK
  }
}

/* -------------------------------------------------------------------------- */
/* Value-tier checks                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The cell's value must equal the solution formula's value, evaluated against the same data.
 * Nothing is hardcoded, so randomised sample data works without maintaining an answer key.
 */
export function matchesSolution(): Check {
  return ({ sheet, target, solution }) => {
    if (!solution) throw new Error('matchesSolution braucht eine solution im TaskContext.')

    const expected = sheet.evaluateFormula(solution)
    const actual = sheet.getValue(target)

    if (isError(actual)) {
      return fail(`${target} liefert einen Fehler: ${actual.code} — ${actual.message}`)
    }
    if (valuesEqual(actual, expected)) return OK

    return fail(`Das Ergebnis in ${target} stimmt noch nicht (${toText(actual)}).`)
  }
}

/** The cell's value must equal a fixed expected value. */
export function valueEquals(expected: CellValue): Check {
  return ({ sheet, target }) => {
    const actual = sheet.getValue(target)
    return valuesEqual(actual, expected)
      ? OK
      : fail(`In ${target} wird „${toText(expected)}" erwartet, dort steht „${toText(actual)}".`)
  }
}

/* -------------------------------------------------------------------------- */
/* Fill-down                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Every cell in the range must carry the correctly translated formula.
 *
 * This is the check that catches a student who solved the first cell properly and then typed
 * the remaining results by hand — the most common way to fake a fill-down task.
 *
 * `anchorSolution` is the solution for the range's top-left cell; it is translated for each
 * subsequent cell, honouring `$` pins.
 */
export function filledDown(range: string, anchorSolution: string): Check {
  return ({ sheet }) => {
    const parsed = parseRangeText(range)
    if (!parsed) throw new Error(`Ungültiger Bereich „${range}".`)

    const anchorAst = parseFormula(anchorSolution)
    const cells = expandRange(parsed)
    const origin = cells[0]!

    for (const ref of cells) {
      const a1 = formatA1(ref)
      const input = sheet.getInput(a1)

      if (!isFormulaInput(input)) {
        return fail(
          input.trim() === ''
            ? `${a1} ist noch leer — ziehe die Formel bis zum Ende des Bereichs herunter.`
            : `In ${a1} steht „${input.trim()}" statt einer Formel. Ziehe die Formel aus ` +
              `${formatA1(origin)} herunter, statt die Ergebnisse einzutippen.`,
        )
      }

      const expected = formatNode(
        translateNode(anchorAst, ref.row - origin.row, ref.col - origin.col),
      )
      if (canonical(input) !== expected) {
        // A wrong formula in the anchor cell is a different mistake from a bad drag:
        // the student has not got the formula right yet, so say that instead.
        return fail(
          ref.row === origin.row && ref.col === origin.col
            ? `Die Formel in ${a1} stimmt noch nicht. Überlege, welche Bezüge beim ` +
              `Herunterziehen mitwandern sollen und welche mit „$" festgehalten werden müssen.`
            : `Die Formel in ${a1} passt nicht zu der in ${formatA1(origin)}. ` +
              `Ziehe die Formel herunter, damit die Bezüge richtig mitwandern.`,
        )
      }
    }

    return OK
  }
}

/* -------------------------------------------------------------------------- */
/* Structure-tier checks                                                       */
/* -------------------------------------------------------------------------- */

export function sheetNamed(expected: string): Check {
  return ({ sheet }) =>
    sheet.name === expected
      ? OK
      : fail(`Das Tabellenblatt heißt „${sheet.name}" statt „${expected}".`)
}

/**
 * The rows of a range must be sorted by one column — and must still be the same rows (skill S2).
 *
 * The second half is the whole lesson. „Sortiere die Werte B4 - H8 nach Namen" is failed just as
 * badly by a student who selects only the name column and sorts that: the names come out
 * alphabetical and every balance now belongs to the wrong person. So we check the ordering *and*
 * that each seeded row survived as a unit.
 *
 * Only columns the scenario seeded are compared — the student's own formula columns are expected
 * to appear where the pristine sheet has nothing.
 */
export function sortedBy(range: string, by: string, direction: 'asc' | 'desc' = 'asc'): Check {
  return ({ sheet, pristine }) => {
    const parsed = parseRangeText(range)
    if (!parsed) throw new Error(`Ungültiger Bereich „${range}".`)
    const keyRef = parseA1(`${by}1`)
    if (!keyRef) throw new Error(`Ungültige Spalte „${by}".`)

    const top = Math.min(parsed.start.row, parsed.end.row)
    const bottom = Math.max(parsed.start.row, parsed.end.row)
    const left = Math.min(parsed.start.col, parsed.end.col)
    const right = Math.max(parsed.start.col, parsed.end.col)
    const at = (row: number, col: number) => ({ row, col, colAbs: false, rowAbs: false })

    // 1. The key column is in order.
    for (let row = top; row < bottom; row++) {
      const here = sheet.getValue(at(row, keyRef.col))
      const next = sheet.getValue(at(row + 1, keyRef.col))
      if (here === null || next === null) continue
      const cmp = compareForSort(here, next)
      const ordered = direction === 'asc' ? cmp <= 0 : cmp >= 0
      if (!ordered) {
        const how = direction === 'asc' ? 'aufsteigend (A-Z)' : 'absteigend (Z-A)'
        return fail(
          `Die Zeilen ${top + 1} bis ${bottom + 1} sind noch nicht nach Spalte ${by} ${how} ` +
            `sortiert: „${toText(next)}" steht unter „${toText(here)}".`,
        )
      }
    }

    // 2. Every seeded row is still intact.
    if (pristine) {
      const seededCols: number[] = []
      for (let col = left; col <= right; col++) {
        for (let row = top; row <= bottom; row++) {
          if (pristine.getInput(at(row, col)) !== '') { seededCols.push(col); break }
        }
      }
      const rowText = (source: Sheet, row: number) =>
        seededCols.map((col) => toText(source.getValue(at(row, col)))).join(' ')

      const wanted = new Set<string>()
      for (let row = top; row <= bottom; row++) wanted.add(rowText(pristine, row))
      for (let row = top; row <= bottom; row++) {
        if (wanted.has(rowText(sheet, row))) continue
        return fail(
          `Zeile ${row + 1} passt nicht mehr zusammen. Beim Sortieren muss die ganze Zeile ` +
            `mitwandern — markiere ${range} und nicht nur eine einzelne Spalte.`,
        )
      }
    }

    return OK
  }
}

/** Same ordering the sheet sorts by, so the check and the operation can never disagree. */
function compareForSort(a: CellValue, b: CellValue): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'number') return -1
  if (typeof b === 'number') return 1
  return toText(a).localeCompare(toText(b), 'de', { sensitivity: 'base', numeric: true })
}

export function isMerged(range: string): Check {
  return ({ sheet }) => {
    const parsed = parseRangeText(range)
    if (!parsed) throw new Error(`Ungültiger Bereich „${range}".`)
    return sheet.isMerged(parsed) ? OK : fail(`Die Zellen ${range} sind noch nicht verbunden.`)
  }
}

/**
 * Run checks against a different cell, with its own answer key.
 *
 * Exam tasks routinely name several cells at once — „Berechne in den Zellen C10 - C13 die Summen
 * pro Kategorie" is one task worth four points whose four cells each need a different formula.
 * This keeps that a single task instead of four, so the point total still matches the paper.
 */
export function alsoAt(a1: string, solution: string, ...checks: readonly Check[]): Check {
  return (ctx) => {
    for (const check of checks) {
      const result = check({ ...ctx, target: a1, solution })
      if (!result.passed) return result
    }
    return OK
  }
}

/* -------------------------------------------------------------------------- */

export function parseRangeText(text: string): RangeRef | null {
  const [startText, endText] = text.split(':')
  if (!startText) return null
  const start = parseA1(startText.trim())
  if (!start) return null
  if (!endText) return { start, end: start }
  const end = parseA1(endText.trim())
  return end ? { start, end } : null
}

export interface TaskOutcome {
  readonly passed: boolean
  /** Messages from the checks that failed, in declaration order. */
  readonly messages: string[]
}

/** Run checks in order and stop at the first failure — one clear message beats five. */
export function runChecks(checks: readonly Check[], ctx: TaskContext): TaskOutcome {
  for (const check of checks) {
    const result = check(ctx)
    if (!result.passed) return { passed: false, messages: [result.message] }
  }
  return { passed: true, messages: [] }
}

/* -------------------------------------------------------------------------- */
/* Style-tier checks (skills F1–F18)                                           */
/* -------------------------------------------------------------------------- */

const STYLE_LABELS: Partial<Record<keyof CellStyle, string>> = {
  bold: 'fett',
  italic: 'kursiv',
  underline: 'unterstrichen',
  fontFamily: 'Schriftart',
  fontSize: 'Schriftgröße',
  color: 'Schriftfarbe',
  fill: 'Füllfarbe',
  hAlign: 'horizontale Ausrichtung',
  vAlign: 'vertikale Ausrichtung',
  wrap: 'Textumbruch',
}

function sameColour(a: unknown, b: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return a === b
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/**
 * Every cell in the range must carry these style properties.
 *
 * Only the properties named in `patch` are compared, so a task can require bold without
 * caring what colour the student also chose.
 */
export function hasStyle(patch: Partial<CellStyle>, range?: string): Check {
  return ({ sheet, target }) => {
    const parsed = parseRangeText(range ?? target)
    if (!parsed) throw new Error(`Ungültiger Bereich „${range ?? target}".`)

    for (const ref of expandRange(parsed)) {
      const style = sheet.getStyle(ref)
      for (const [key, wanted] of Object.entries(patch) as [keyof CellStyle, unknown][]) {
        const actual = style[key]
        const equal =
          key === 'fill' || key === 'color' ? sameColour(actual, wanted) : actual === wanted
        if (!equal) {
          const label = STYLE_LABELS[key] ?? String(key)
          return fail(`In ${formatA1(ref)} fehlt noch die Formatierung: ${label}.`)
        }
      }
    }
    return OK
  }
}

/** The cells must use this number format (skills F10–F15). */
export function numberFormatIs(wanted: NumberFormat, range?: string): Check {
  const describe = describeFormat(wanted)
  return ({ sheet, target }) => {
    const parsed = parseRangeText(range ?? target)
    if (!parsed) throw new Error(`Ungültiger Bereich „${range ?? target}".`)

    for (const ref of expandRange(parsed)) {
      const actual = sheet.getStyle(ref).numberFormat
      if (!formatsEqual(actual, wanted)) {
        return fail(`Formatiere ${formatA1(ref)} als ${describe}.`)
      }
    }
    return OK
  }
}

function formatsEqual(a: NumberFormat, b: NumberFormat): boolean {
  if (a.kind !== b.kind) return false
  switch (b.kind) {
    case 'number':
      return a.kind === 'number' && a.decimals === b.decimals
    case 'percent':
      return a.kind === 'percent' && a.decimals === b.decimals
    case 'currency':
      return a.kind === 'currency' && a.decimals === b.decimals && a.negativeRed === b.negativeRed
    case 'date':
      return a.kind === 'date' && a.pattern === b.pattern
    default:
      return true
  }
}

function describeFormat(format: NumberFormat): string {
  switch (format.kind) {
    case 'currency':
      return `Währung € mit ${format.decimals} Nachkommastellen`
    case 'percent':
      return `Prozent mit ${format.decimals} Nachkommastellen`
    case 'number':
      return `Zahl mit ${format.decimals} Nachkommastellen`
    case 'date':
      return `Datum im Format ${format.pattern}`
    default:
      return 'Standard'
  }
}

/**
 * A conditional-formatting rule must exist over this range with this condition (F16–F18).
 *
 * Checking the *rule* rather than the resulting colours is the point: painting the cells by
 * hand would make the sheet look right while teaching nothing, and it would stop being right
 * the moment a number changed.
 */
export function hasConditionalFormat(
  range: string,
  condition: CfRule['condition'],
  format?: Partial<CellStyle>,
): Check {
  return ({ sheet }) => {
    const wanted = parseRangeText(range)
    if (!wanted) throw new Error(`Ungültiger Bereich „${range}".`)

    const covering = sheet.conditionalFormats.filter(
      (rule) =>
        formatA1(rule.range.start) === formatA1(wanted.start) &&
        formatA1(rule.range.end) === formatA1(wanted.end),
    )
    if (covering.length === 0) {
      return fail(`Für ${range} fehlt noch eine bedingte Formatierung.`)
    }

    const matching = covering.filter((rule) => conditionsEqual(rule.condition, condition))
    if (matching.length === 0) {
      return fail(`Die Bedingung der bedingten Formatierung für ${range} stimmt noch nicht.`)
    }
    if (!format) return OK

    const satisfied = matching.some((rule) =>
      (Object.entries(format) as [keyof CellStyle, unknown][]).every(([key, value]) => {
        const actual = (rule.format as Record<string, unknown>)[key]
        return key === 'fill' || key === 'color' ? sameColour(actual, value) : actual === value
      }),
    )
    return satisfied
      ? OK
      : fail(`Die bedingte Formatierung für ${range} färbt noch nicht wie verlangt.`)
  }
}

function conditionsEqual(a: CfRule['condition'], b: CfRule['condition']): boolean {
  if (a.kind !== b.kind) return false
  switch (b.kind) {
    case 'greaterThan':
      return a.kind === 'greaterThan' && a.value === b.value
    case 'lessThan':
      return a.kind === 'lessThan' && a.value === b.value
    case 'between':
      return a.kind === 'between' && a.min === b.min && a.max === b.max
    case 'equalText':
      return a.kind === 'equalText' && a.text.toUpperCase() === b.text.toUpperCase()
  }
}

/* -------------------------------------------------------------------------- */
/* Chart checks (skills D1–D11)                                                */
/* -------------------------------------------------------------------------- */

const CHART_NAMES: Record<ChartKind, string> = {
  column: 'Säulendiagramm',
  bar: 'Balkendiagramm',
  pie: 'Kreisdiagramm',
  line: 'Liniendiagramm',
  area: 'Flächendiagramm',
}

export interface ChartRequirement {
  readonly kind: ChartKind
  /** The range the chart must read from — skill D6, and the part students get wrong. */
  readonly source: string
  readonly title?: string
  readonly dataLabels?: ChartSpec['dataLabels']
  readonly axisTitles?: { readonly x?: string; readonly y?: string }
}

/**
 * A chart of this kind must exist over this range.
 *
 * Reported one requirement at a time: a student who picked the wrong range should hear about
 * the range, not be told the whole task is wrong.
 */
export function hasChart(requirement: ChartRequirement): Check {
  const name = CHART_NAMES[requirement.kind]
  return ({ sheet }) => {
    const wanted = parseRangeText(requirement.source)
    if (!wanted) throw new Error(`Ungültiger Bereich „${requirement.source}".`)

    const ofKind = sheet.charts.filter((chart) => chart.kind === requirement.kind)
    if (ofKind.length === 0) {
      return fail(
        sheet.charts.length === 0
          ? `Es fehlt noch ein ${name}.`
          : `Das Diagramm ist kein ${name}.`,
      )
    }

    const onRange = ofKind.filter(
      (chart) =>
        formatA1(chart.source.start) === formatA1(wanted.start) &&
        formatA1(chart.source.end) === formatA1(wanted.end),
    )
    if (onRange.length === 0) {
      return fail(`Das ${name} muss die Daten aus ${requirement.source} verwenden.`)
    }

    if (requirement.title !== undefined) {
      const titled = onRange.filter(
        (chart) => (chart.title ?? '').trim().toUpperCase() === requirement.title!.toUpperCase(),
      )
      if (titled.length === 0) {
        return fail(`Gib dem ${name} den Titel „${requirement.title}".`)
      }
    }

    if (requirement.dataLabels !== undefined) {
      const labelled = onRange.some((chart) => chart.dataLabels === requirement.dataLabels)
      if (!labelled) {
        const wantedLabel =
          requirement.dataLabels === 'percent' ? 'Prozentwerte' :
          requirement.dataLabels === 'value' ? 'Werte' : 'keine'
        return fail(`Stelle die Datenbeschriftungen des ${name}s auf ${wantedLabel}.`)
      }
    }

    if (requirement.axisTitles) {
      const ok = onRange.some(
        (chart) =>
          (requirement.axisTitles!.x === undefined ||
            chart.axisTitles.x === requirement.axisTitles!.x) &&
          (requirement.axisTitles!.y === undefined ||
            chart.axisTitles.y === requirement.axisTitles!.y),
      )
      if (!ok) return fail(`Beschrifte die Achsen des ${name}s.`)
    }

    return OK
  }
}
