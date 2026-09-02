/**
 * The workbook model.
 *
 * `Cell.input` is the load-bearing field: it holds exactly what the student typed, which is what
 * lets the checker distinguish a computed 844 from a typed 844. Everything else in this file
 * exists so that the style, conditional-formatting and chart checks have something to inspect.
 */

import type { RangeRef } from './refs.ts'

export type HorizontalAlign = 'left' | 'center' | 'right'
export type VerticalAlign = 'top' | 'middle' | 'bottom'
export type BorderWeight = 'none' | 'thin' | 'medium' | 'thick'

/** Number format as a semantic descriptor rather than an Excel format string. */
export type NumberFormat =
  | { readonly kind: 'general' }
  | { readonly kind: 'number'; readonly decimals: number }
  | { readonly kind: 'currency'; readonly decimals: number; readonly symbol: '€'; readonly negativeRed: boolean }
  | { readonly kind: 'percent'; readonly decimals: number }
  | { readonly kind: 'date'; readonly pattern: 'DD.MM.YY' | 'DD.MM.YYYY' }

export interface Borders {
  readonly top: BorderWeight
  readonly right: BorderWeight
  readonly bottom: BorderWeight
  readonly left: BorderWeight
}

export interface CellStyle {
  readonly bold: boolean
  readonly italic: boolean
  readonly underline: boolean
  readonly fontFamily: string
  readonly fontSize: number
  /** Hex, e.g. `#ffffff`. */
  readonly color: string
  /** Hex fill, or null for no fill. */
  readonly fill: string | null
  readonly hAlign: HorizontalAlign | null
  readonly vAlign: VerticalAlign | null
  readonly wrap: boolean
  readonly borders: Borders
  readonly numberFormat: NumberFormat
}

export const NO_BORDERS: Borders = { top: 'none', right: 'none', bottom: 'none', left: 'none' }

export const DEFAULT_STYLE: CellStyle = {
  bold: false,
  italic: false,
  underline: false,
  fontFamily: 'Calibri',
  fontSize: 11,
  color: '#000000',
  fill: null,
  hAlign: null,
  vAlign: null,
  wrap: false,
  borders: NO_BORDERS,
  numberFormat: { kind: 'general' },
}

export interface Cell {
  /** Exactly what the student typed — `"=SUMME(C4;E4)"` or `"165"`. */
  readonly input: string
  readonly style: CellStyle
}

/** Conditional formatting rule (skills F16–F18). */
export interface CfRule {
  readonly range: RangeRef
  readonly condition:
    | { readonly kind: 'greaterThan'; readonly value: number }
    | { readonly kind: 'lessThan'; readonly value: number }
    | { readonly kind: 'between'; readonly min: number; readonly max: number }
    | { readonly kind: 'equalText'; readonly text: string }
  /** Only the properties the rule overrides. */
  readonly format: Partial<Pick<CellStyle, 'bold' | 'color' | 'fill'>>
}

/**
 * A sort the student performed (skill S2).
 *
 * Recorded as an *operation*, not as reordered data. The server re-seeds the scenario and
 * replays these, so a crafted request can only say „sortiere B4:H8 nach Spalte 1 aufsteigend" —
 * it can never hand over a table whose rows were rearranged by hand.
 */
export interface SortSpec {
  readonly range: RangeRef
  /** Absolute column index of the sort key — not an offset into the range. */
  readonly by: number
  readonly direction: 'asc' | 'desc'
}

export type ChartKind = 'column' | 'bar' | 'pie' | 'line' | 'area'

/** Chart specification (skills D1–D11). */
export interface ChartSpec {
  readonly id: string
  readonly kind: ChartKind
  /** Where the chart reads its data from — the thing D6 checks. */
  readonly source: RangeRef
  readonly title: string | null
  readonly axisTitles: { readonly x: string | null; readonly y: string | null }
  readonly dataLabels: 'none' | 'value' | 'percent'
}
