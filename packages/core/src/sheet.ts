/**
 * Sheet and Workbook: storage plus lazy, memoised recalculation.
 *
 * Sheets are small (an exam sheet is tens of cells), so we recompute on demand with a cache
 * rather than maintaining a dependency graph.
 */

import { evaluateNode, type EvalScope } from './evaluate.ts'
import { DEFAULT_STYLE, type Cell, type CellStyle, type CfRule, type ChartSpec } from './model.ts'
import { ParseError, parseFormula, type Node } from './parser.ts'
import { TokenizeError } from './tokenizer.ts'
import { expandRange, formatA1, parseA1, refKey, type CellRef, type RangeRef } from './refs.ts'
import { err, type CellValue } from './values.ts'

export function isFormulaInput(input: string): boolean {
  return input.trimStart().startsWith('=')
}

/** Interpret a non-formula entry the way Excel does on typing. */
export function parseLiteral(input: string): CellValue {
  const trimmed = input.trim()
  if (trimmed === '') return null

  const upper = trimmed.toUpperCase()
  if (upper === 'WAHR') return true
  if (upper === 'FALSCH') return false

  // German numeric literal: `1234,5`. Thousands separators are not accepted, matching Excel.
  if (/^-?[0-9]+(?:[.,][0-9]+)?$/.test(trimmed)) {
    return Number(trimmed.replace(',', '.'))
  }

  return input
}

export class Sheet {
  private readonly cells = new Map<string, Cell>()
  private readonly valueCache = new Map<string, CellValue>()
  private readonly astCache = new Map<string, Node | ParseError | TokenizeError>()
  private readonly computing = new Set<string>()

  readonly conditionalFormats: CfRule[] = []
  readonly charts: ChartSpec[] = []
  readonly merges: RangeRef[] = []
  readonly columnWidths = new Map<number, number>()
  readonly rowHeights = new Map<number, number>()

  constructor(public name: string) {}

  private key(a1: string | CellRef): string {
    if (typeof a1 !== 'string') return refKey(a1)
    const ref = parseA1(a1)
    if (!ref) throw new Error(`Ungültiger Zellbezug „${a1}".`)
    return refKey(ref)
  }

  setInput(a1: string | CellRef, input: string): void {
    const key = this.key(a1)
    const existing = this.cells.get(key)
    this.cells.set(key, { input, style: existing?.style ?? DEFAULT_STYLE })
    this.invalidate()
  }

  setStyle(a1: string | CellRef, patch: Partial<CellStyle>): void {
    const key = this.key(a1)
    const existing = this.cells.get(key)
    this.cells.set(key, {
      input: existing?.input ?? '',
      style: { ...(existing?.style ?? DEFAULT_STYLE), ...patch },
    })
  }

  /** Bulk-load literal data, e.g. when seeding a scenario. */
  load(data: Record<string, string | number>): void {
    for (const [a1, value] of Object.entries(data)) {
      this.setInput(a1, typeof value === 'number' ? String(value).replace('.', ',') : value)
    }
  }

  getCell(a1: string | CellRef): Cell | undefined {
    return this.cells.get(this.key(a1))
  }

  getInput(a1: string | CellRef): string {
    return this.getCell(a1)?.input ?? ''
  }

  getStyle(a1: string | CellRef): CellStyle {
    return this.getCell(a1)?.style ?? DEFAULT_STYLE
  }

  /** Every populated cell, as canonical A1 keys. */
  populatedCells(): string[] {
    return [...this.cells.entries()].filter(([, cell]) => cell.input !== '').map(([key]) => key)
  }

  invalidate(): void {
    this.valueCache.clear()
    this.astCache.clear()
  }

  /**
   * Parse a cell's formula, caching both successes and failures.
   * Returns null for non-formula cells.
   */
  getAst(a1: string | CellRef): Node | ParseError | TokenizeError | null {
    const key = this.key(a1)
    const input = this.cells.get(key)?.input ?? ''
    if (!isFormulaInput(input)) return null

    const cached = this.astCache.get(key)
    if (cached) return cached

    let result: Node | ParseError | TokenizeError
    try {
      result = parseFormula(input)
    } catch (error) {
      if (error instanceof ParseError || error instanceof TokenizeError) result = error
      else throw error
    }
    this.astCache.set(key, result)
    return result
  }

  getValue(a1: string | CellRef): CellValue {
    const key = this.key(a1)

    const cached = this.valueCache.get(key)
    if (cached !== undefined) return cached

    if (this.computing.has(key)) {
      // Circular reference: Excel reports this rather than looping.
      return err('#BEZUG!', `Zirkelbezug: ${key} verweist auf sich selbst.`)
    }

    const input = this.cells.get(key)?.input ?? ''
    if (!isFormulaInput(input)) {
      const literal = parseLiteral(input)
      this.valueCache.set(key, literal)
      return literal
    }

    this.computing.add(key)
    let value: CellValue
    try {
      const ast = this.getAst(key)
      if (ast === null) {
        value = null
      } else if (ast instanceof ParseError || ast instanceof TokenizeError) {
        value = err('#NAME?', ast.message)
      } else {
        value = evaluateNode(ast, this.scope())
      }
    } finally {
      this.computing.delete(key)
    }

    this.valueCache.set(key, value)
    return value
  }

  private scope(): EvalScope {
    return {
      getValue: (ref) => this.getValue(ref),
      getRange: (start, end) => expandRange({ start, end }).map((ref) => this.getValue(ref)),
    }
  }

  getRangeValues(range: RangeRef): CellValue[] {
    return expandRange(range).map((ref) => this.getValue(ref))
  }

  /**
   * Evaluate an arbitrary formula against this sheet without storing it.
   * This is how the checker computes the expected answer from the task's solution formula
   * instead of a hardcoded number.
   */
  evaluateFormula(formula: string): CellValue {
    try {
      return evaluateNode(parseFormula(formula), this.scope())
    } catch (error) {
      if (error instanceof ParseError || error instanceof TokenizeError) {
        return err('#NAME?', error.message)
      }
      throw error
    }
  }

  /** Merge a range (skill F1). Merging an already-merged range is a no-op. */
  merge(range: RangeRef): void {
    if (!this.isMerged(range)) this.merges.push(range)
  }

  unmerge(range: RangeRef): void {
    const index = this.merges.findIndex(
      (m) => formatA1(m.start) === formatA1(range.start) && formatA1(m.end) === formatA1(range.end),
    )
    if (index >= 0) this.merges.splice(index, 1)
  }

  addChart(spec: ChartSpec): void {
    this.charts.push(spec)
  }

  removeChart(id: string): void {
    const index = this.charts.findIndex((chart) => chart.id === id)
    if (index >= 0) this.charts.splice(index, 1)
  }

  updateChart(id: string, patch: Partial<ChartSpec>): void {
    const index = this.charts.findIndex((chart) => chart.id === id)
    if (index >= 0) this.charts[index] = { ...this.charts[index]!, ...patch }
  }

  addConditionalFormat(rule: CfRule): void {
    this.conditionalFormats.push(rule)
  }

  clearConditionalFormats(): void {
    this.conditionalFormats.length = 0
  }

  /**
   * The style a cell actually renders with: its own formatting, then any conditional rule
   * whose condition its current value satisfies, applied in the order the rules were added.
   *
   * Kept separate from getStyle so the checker can still ask what the student formatted by
   * hand as opposed to what a rule painted for them.
   */
  effectiveStyle(a1: string | CellRef): CellStyle {
    const ref = typeof a1 === 'string' ? parseA1(a1) : a1
    if (!ref) return DEFAULT_STYLE
    let style = this.getStyle(ref)
    const value = this.getValue(ref)

    for (const rule of this.conditionalFormats) {
      if (!rangeContains(rule.range, ref)) continue
      if (conditionHolds(rule.condition, value)) style = { ...style, ...rule.format }
    }
    return style
  }

  isMerged(range: RangeRef): boolean {
    return this.merges.some(
      (merge) =>
        formatA1(merge.start) === formatA1(range.start) &&
        formatA1(merge.end) === formatA1(range.end),
    )
  }
}

function rangeContains(range: RangeRef, ref: CellRef): boolean {
  const top = Math.min(range.start.row, range.end.row)
  const bottom = Math.max(range.start.row, range.end.row)
  const left = Math.min(range.start.col, range.end.col)
  const right = Math.max(range.start.col, range.end.col)
  return ref.row >= top && ref.row <= bottom && ref.col >= left && ref.col <= right
}

function conditionHolds(condition: CfRule['condition'], value: CellValue): boolean {
  if (condition.kind === 'equalText') {
    return typeof value === 'string' && value.trim().toUpperCase() === condition.text.toUpperCase()
  }
  if (typeof value !== 'number') return false
  switch (condition.kind) {
    case 'greaterThan': return value > condition.value
    case 'lessThan': return value < condition.value
    case 'between': return value >= condition.min && value <= condition.max
  }
}

export class Workbook {
  readonly sheets: Sheet[] = []

  sheet(name: string): Sheet {
    const found = this.sheets.find((sheet) => sheet.name === name)
    if (!found) throw new Error(`Es gibt kein Tabellenblatt „${name}".`)
    return found
  }

  addSheet(name: string): Sheet {
    const sheet = new Sheet(name)
    this.sheets.push(sheet)
    return sheet
  }

  get sheetNames(): string[] {
    return this.sheets.map((sheet) => sheet.name)
  }
}
