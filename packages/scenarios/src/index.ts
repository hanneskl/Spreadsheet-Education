/**
 * Exam scenarios as data.
 *
 * A scenario seeds a sheet and lists its tasks. Both the browser (instant feedback) and, later,
 * the Supabase Edge Function (authoritative scoring) read the same definitions from here.
 */

import {
  Sheet,
  filledDown,
  hasAbsoluteRef,
  hasChart,
  hasConditionalFormat,
  hasStyle,
  isFormula,
  isMerged,
  matchesSolution,
  numberFormatIs,
  sheetNamed,
  usesFunction,
  usesOperator,
  valueEquals,
  type Check,
} from '@quali/core'

export interface TaskDef {
  readonly id: string
  /** Skill IDs from the README catalogue — what the teacher dashboard groups by. */
  readonly skills: readonly string[]
  readonly promptDe: string
  /** Cell the student must fill. For fill-down tasks, the anchor of the range. */
  readonly target: string
  /** The answer key, as a formula. Never a stored number. */
  readonly solution?: string
  readonly checks: readonly Check[]
  readonly points: number
}

export interface Scenario {
  readonly id: string
  readonly titleDe: string
  readonly subtitleDe: string
  /** Columns and rows the grid should render. */
  readonly columns: number
  readonly rows: number
  readonly seed: () => Sheet
  readonly tasks: readonly TaskDef[]
}

/* -------------------------------------------------------------------------- */
/* SMV Wahl — Quali 2026, Prüfungsteil B, Blatt 3                              */
/* Real data and real solution formulas; the Musterlösung percentages are      */
/* 20,45 / 26,36 / 14,55 / 29,55 / 9,09 %.                                     */
/* -------------------------------------------------------------------------- */

const smvWahl: Scenario = {
  id: 'smv-wahl',
  titleDe: 'SMV-Wahl',
  subtitleDe: 'Quali 2026 · Datenverarbeitung · Blatt 3',
  columns: 5,
  rows: 10,
  seed() {
    const sheet = new Sheet('SMV Wahl')
    sheet.load({
      A1: 'Kandidat', B1: 'Stimmen', C1: 'Anteil', D1: 'Ergebnis',
      A2: 'Lukas', B2: 45,
      A3: 'Mia', B3: 58,
      A4: 'Ben', B4: 32,
      A5: 'Sina', B5: 65,
      A6: 'Noah', B6: 20,
      A8: 'Gesamt',
    })
    for (const a1 of ['A1', 'B1', 'C1', 'D1', 'A8']) sheet.setStyle(a1, { bold: true })
    for (let row = 2; row <= 6; row++) {
      sheet.setStyle(`C${row}`, { numberFormat: { kind: 'percent', decimals: 2 } })
    }
    return sheet
  },
  tasks: [
    {
      id: 'smv-gesamt',
      skills: ['N1'],
      promptDe: 'Trage in Zelle B8 die Gesamtzahl der abgegebenen Stimmen ein. Verwende die Funktion SUMME.',
      target: 'B8',
      solution: '=SUMME(B2:B6)',
      checks: [isFormula(), usesFunction('SUMME'), matchesSolution()],
      points: 2,
    },
    {
      id: 'smv-anteil',
      skills: ['C5', 'C7', 'F13'],
      promptDe:
        'Berechne in C2 den prozentualen Anteil von Lukas an allen Stimmen und ziehe die Formel bis C6 herunter. ' +
        'Der Bezug auf die Gesamtzahl muss absolut sein.',
      target: 'C2',
      solution: '=B2/$B$8',
      checks: [
        isFormula(),
        hasAbsoluteRef('B8'),
        matchesSolution(),
        filledDown('C2:C6', '=B2/$B$8'),
      ],
      points: 4,
    },
    {
      id: 'smv-gewaehlt',
      skills: ['N6'],
      promptDe:
        'Zeige in D2 mit der Funktion WENN an, ob der Kandidat gewählt ist: mehr als 50 Stimmen ergibt ' +
        '„Gewählt", sonst „Nicht gewählt". Ziehe die Formel bis D6 herunter.',
      target: 'D2',
      solution: '=WENN(B2>50;"Gewählt";"Nicht gewählt")',
      checks: [
        isFormula(),
        usesFunction('WENN'),
        matchesSolution(),
        filledDown('D2:D6', '=WENN(B2>50;"Gewählt";"Nicht gewählt")'),
      ],
      points: 3,
    },
    {
      id: 'smv-diagramm',
      skills: ['D3', 'D6', 'D7', 'D9'],
      promptDe:
        'Erstelle ein Kreisdiagramm, das die Stimmenverteilung aus A2:B6 abbildet. ' +
        'Gib ihm den Titel „Stimmenverteilung SMV-Wahl" und zeige die Datenbeschriftungen ' +
        'als Prozentwerte an.',
      target: 'A2',
      checks: [
        hasChart({
          kind: 'pie',
          source: 'A2:B6',
          title: 'Stimmenverteilung SMV-Wahl',
          dataLabels: 'percent',
        }),
      ],
      points: 4,
    },
  ],
}

/* -------------------------------------------------------------------------- */
/* Felder berechnen — the task that appears in six of the seven exam years     */
/*                                                                             */
/* The numbers are the 2025 grid. The original colour groupings are not        */
/* recoverable from the exported text, so the groups below are our own; the    */
/* expected answers come from the solution formulas rather than the paper.     */
/* The yellow pair is chosen to reproduce the Musterlösung's quotient of 28.   */
/* -------------------------------------------------------------------------- */

export const FIELD_COLOURS = {
  green: '#d9ead3',
  violet: '#d9d2e9',
  red: '#f4cccc',
  yellow: '#fff2cc',
} as const

const GREEN = ['B2', 'C2', 'D2', 'E2']
const VIOLET = ['B7', 'C7', 'D7', 'E7']
const RED = ['B4', 'E4']
const YELLOW = ['E6', 'D3']

const felderBerechnen: Scenario = {
  id: 'felder-berechnen',
  titleDe: 'Felder berechnen',
  subtitleDe: 'Kommt in sechs von sieben Quali-Jahrgängen vor',
  columns: 6,
  rows: 12,
  seed() {
    const sheet = new Sheet('Felder berechnen')
    sheet.load({
      A1: 'Berechne gleichfarbige Felder!',
      B2: 48, C2: 995, D2: 88, E2: 45,
      B3: 179, C3: 18, D3: 37, E3: 37,
      B4: 2, C4: 408, D4: 793, E4: 44,
      B5: 96, C5: 722, D5: 65, E5: 459,
      B6: 86, C6: 770, D6: 756, E6: 1036,
      B7: 333, C7: 86, D7: 511, E7: 71,
      A9: 'Summe grüne Felder:',
      A10: 'Summe violette Felder:',
      A11: 'Produkt rote Felder:',
      A12: 'Quotient gelbe Felder:',
    })
    sheet.setStyle('A1', { bold: true })
    for (const a1 of GREEN) sheet.setStyle(a1, { fill: FIELD_COLOURS.green })
    for (const a1 of VIOLET) sheet.setStyle(a1, { fill: FIELD_COLOURS.violet })
    for (const a1 of RED) sheet.setStyle(a1, { fill: FIELD_COLOURS.red })
    for (const a1 of YELLOW) sheet.setStyle(a1, { fill: FIELD_COLOURS.yellow })
    sheet.setStyle('F9', { fill: FIELD_COLOURS.green })
    sheet.setStyle('F10', { fill: FIELD_COLOURS.violet })
    sheet.setStyle('F11', { fill: FIELD_COLOURS.red })
    sheet.setStyle('F12', { fill: FIELD_COLOURS.yellow })
    return sheet
  },
  tasks: [
    {
      id: 'felder-gruen',
      skills: ['N1'],
      promptDe: 'Berechne in F9 die Summe der grünen Felder.',
      target: 'F9',
      solution: '=SUMME(B2:E2)',
      checks: [isFormula(), usesFunction('SUMME'), matchesSolution()],
      points: 2,
    },
    {
      id: 'felder-violett',
      skills: ['N1'],
      promptDe: 'Berechne in F10 die Summe der violetten Felder.',
      target: 'F10',
      solution: '=SUMME(B7:E7)',
      checks: [isFormula(), usesFunction('SUMME'), matchesSolution()],
      points: 2,
    },
    {
      id: 'felder-rot',
      skills: ['N10'],
      promptDe: 'Berechne in F11 das Produkt der roten Felder.',
      target: 'F11',
      solution: '=B4*E4',
      checks: [isFormula(), usesOperator('*'), matchesSolution()],
      points: 1,
    },
    {
      id: 'felder-gelb',
      skills: ['N11'],
      promptDe: 'Berechne in F12 den Quotienten der gelben Felder — größere Zahl zuerst.',
      target: 'F12',
      solution: '=E6/D3',
      checks: [isFormula(), usesOperator('/'), matchesSolution()],
      points: 1,
    },
  ],
}

/* -------------------------------------------------------------------------- */
/* Vermögen — Quali 2025, Prüfungsteil Excel, Blatt 1                          */
/* Real data, real task wording. The Musterlösung's per-person totals are      */
/* 472 / 5.473 / 1.449 / 291 / 100 and the percentages 6,1 / 70,3 / 18,6 /     */
/* 3,7 / 1,3 %.                                                                */
/* -------------------------------------------------------------------------- */

/** The fill colours the ribbon offers; tasks name one of them. */
export const PALETTE = {
  hellblau: '#cfe2f3',
  gelb: '#fff2cc',
  rot: '#f4cccc',
  gruen: '#d9ead3',
  weiss: '#ffffff',
  schwarz: '#000000',
} as const

const vermoegen: Scenario = {
  id: 'vermoegen',
  titleDe: 'Familienvermögen',
  subtitleDe: 'Quali 2025 · Prüfungsteil Excel · Blatt 1',
  columns: 8,
  rows: 15,
  seed() {
    const sheet = new Sheet('Tabelle1')
    sheet.load({
      B3: 'Name', C3: 'Sparschwein', D3: 'Bankkonto', E3: 'Geldbörse',
      F3: 'Sofaritze', G3: 'Gesamt', H3: 'Prozent',
      B4: 'Arthur', C4: 30, D4: 434, E4: 8, F4: 0,
      B5: 'Hannes', C5: 20, D5: 5232, E5: 221, F5: 0,
      B6: 'Karin', C6: 14, D6: 1421, E6: 14, F6: 0,
      B7: 'Max', C7: 27, D7: 234, E7: 30, F7: 0,
      B8: 'Zola', C8: 0, D8: 0, E8: 0, F8: 100,
      B15: 'Gesamtvermögen',
    })
    sheet.setStyle('B15', { bold: true })
    return sheet
  },
  tasks: [
    {
      id: 'verm-titel',
      skills: ['F1', 'F2'],
      promptDe:
        'Verbinde und zentriere die Zellen B1 - H1 und beschrifte sie mit „Familienvermögen". ' +
        'Wähle als Füllfarbe ein helles Blau.',
      target: 'B1',
      checks: [
        valueEquals('Familienvermögen'),
        isMerged('B1:H1'),
        hasStyle({ hAlign: 'center' }, 'B1'),
        hasStyle({ fill: PALETTE.hellblau }, 'B1'),
      ],
      points: 3,
    },
    {
      id: 'verm-gesamt-person',
      skills: ['N1'],
      promptDe:
        'Berechne für jedes Familienmitglied sein Vermögen in den Zellen G4 - G8. ' +
        'Ziehe die Formel herunter.',
      target: 'G4',
      solution: '=SUMME(C4:F4)',
      checks: [
        isFormula(),
        usesFunction('SUMME'),
        matchesSolution(),
        filledDown('G4:G8', '=SUMME(C4:F4)'),
      ],
      points: 2,
    },
    {
      id: 'verm-zeile-fett',
      skills: ['F3'],
      promptDe: 'Formatiere die Zeile 3 fett.',
      target: 'B3',
      checks: [hasStyle({ bold: true }, 'B3:H3')],
      points: 1,
    },
    {
      id: 'verm-zentriert',
      skills: ['F6'],
      promptDe:
        'Formatiere die Zahlen der Zellen C3 - H8 so, dass sie zentriert in der Zelle stehen.',
      target: 'C3',
      checks: [hasStyle({ hAlign: 'center' }, 'C3:H8')],
      points: 2,
    },
    {
      id: 'verm-gesamt',
      skills: ['N1'],
      promptDe: 'Berechne in Zelle C15 das gesamte Familienvermögen.',
      target: 'C15',
      solution: '=SUMME(G4:G8)',
      checks: [isFormula(), usesFunction('SUMME'), matchesSolution()],
      points: 2,
    },
    {
      id: 'verm-prozent',
      skills: ['C5', 'C7', 'F13'],
      promptDe:
        'Formatiere die Zellen H4 - H8 in Prozent mit einer Nachkommastelle und berechne für ' +
        'jedes Familienmitglied den prozentualen Anteil am Familienvermögen. ' +
        'Der Bezug auf das Gesamtvermögen muss absolut sein.',
      target: 'H4',
      solution: '=G4/$C$15',
      checks: [
        isFormula(),
        hasAbsoluteRef('C15'),
        matchesSolution(),
        filledDown('H4:H8', '=G4/$C$15'),
        numberFormatIs({ kind: 'percent', decimals: 1 }, 'H4:H8'),
      ],
      points: 3,
    },
  ],
}

/* -------------------------------------------------------------------------- */
/* Klima — Quali 2022, Prüfungsteil Datenverarbeitung, Blatt 1                 */
/* Real data and real task wording. Niederschlag totals 939 l/m², the mean     */
/* temperature is 9,7 °C, the highest 19 °C and the lowest rainfall 58 l/m².   */
/* -------------------------------------------------------------------------- */

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]
const RAIN = [66, 58, 62, 70, 90, 112, 101, 101, 72, 61, 70, 76]
const TEMP = [2.6, 4.4, 5.1, 7.8, 10.7, 19, 18.3, 16.4, 15.2, 9.6, 4.7, 2.6]

const klima: Scenario = {
  id: 'klima',
  titleDe: 'Klima',
  subtitleDe: 'Quali 2022 · Datenverarbeitung · Blatt 1',
  columns: 13,
  rows: 13,
  seed() {
    const sheet = new Sheet('Tabelle1')
    const data: Record<string, string | number> = {
      A3: 'Niederschlag in l/m²',
      A4: 'Temperatur in °C',
      A9: 'Niederschlag gesamt',
      A10: 'Durchschnittstemperatur',
      A11: 'Höchste Temperatur',
      A12: 'Geringster Niederschlag',
    }
    MONTHS.forEach((month, index) => {
      const col = String.fromCharCode(66 + index)
      data[`${col}2`] = month
      data[`${col}3`] = RAIN[index]!
      data[`${col}4`] = TEMP[index]!
    })
    sheet.load(data)
    for (const a1 of ['A3', 'A4', 'A9', 'A10', 'A11', 'A12']) sheet.setStyle(a1, { bold: true })
    for (let index = 0; index < MONTHS.length; index++) {
      sheet.setStyle(`${String.fromCharCode(66 + index)}2`, { bold: true, hAlign: 'center' })
    }
    return sheet
  },
  tasks: [
    {
      id: 'klima-blattname',
      skills: ['S1'],
      promptDe: 'Benenne das Registerblatt um in „Klima". (Doppelklick auf den Reiter)',
      target: 'A1',
      checks: [sheetNamed('Klima')],
      points: 1,
    },
    {
      id: 'klima-titel',
      skills: ['F1'],
      promptDe:
        'Verbinde und zentriere die Zellen A1 - M1 und füge dort die Überschrift „Klima 2022" ein.',
      target: 'A1',
      checks: [
        valueEquals('Klima 2022'),
        isMerged('A1:M1'),
        hasStyle({ hAlign: 'center' }, 'A1'),
      ],
      points: 1,
    },
    {
      id: 'klima-niederschlag-gesamt',
      skills: ['N1'],
      promptDe: 'Berechne in B9 den gesamten Niederschlag des Jahres.',
      target: 'B9',
      solution: '=SUMME(B3:M3)',
      checks: [isFormula(), usesFunction('SUMME'), matchesSolution()],
      points: 1,
    },
    {
      id: 'klima-durchschnitt',
      skills: ['N2'],
      promptDe: 'Berechne in B10 die Durchschnittstemperatur.',
      target: 'B10',
      solution: '=MITTELWERT(B4:M4)',
      checks: [isFormula(), usesFunction('MITTELWERT'), matchesSolution()],
      points: 1,
    },
    {
      id: 'klima-max',
      skills: ['N3'],
      promptDe: 'Berechne in B11 die höchste Temperatur.',
      target: 'B11',
      solution: '=MAX(B4:M4)',
      checks: [isFormula(), usesFunction('MAX'), matchesSolution()],
      points: 1,
    },
    {
      id: 'klima-min',
      skills: ['N4'],
      promptDe: 'Berechne in B12 den geringsten Niederschlag.',
      target: 'B12',
      solution: '=MIN(B3:M3)',
      checks: [isFormula(), usesFunction('MIN'), matchesSolution()],
      points: 1,
    },
    {
      id: 'klima-kalt',
      skills: ['F17'],
      promptDe:
        'Formatiere die Temperaturen B4 - M4 mit einer bedingten Formatierung: Wenn die ' +
        'Temperatur unter 5 °C liegt, soll die Zelle einen blauen Hintergrund bekommen.',
      target: 'B4',
      checks: [
        hasConditionalFormat('B4:M4', { kind: 'lessThan', value: 5 }, { fill: PALETTE.hellblau }),
      ],
      points: 1,
    },
    {
      id: 'klima-warm',
      skills: ['F17'],
      promptDe:
        'Ergänze eine zweite Regel für B4 - M4: Wenn die Temperatur über 15 °C liegt, soll ' +
        'die Zelle einen roten Hintergrund bekommen.',
      target: 'B4',
      checks: [
        hasConditionalFormat('B4:M4', { kind: 'greaterThan', value: 15 }, { fill: PALETTE.rot }),
      ],
      points: 1,
    },
    {
      id: 'klima-diagramm',
      skills: ['D3', 'D6'],
      promptDe:
        'Erstelle ein Kreisdiagramm, in dem der Niederschlag pro Monat angegeben ist ' +
        '(Bereich B2:M3).',
      target: 'B2',
      checks: [hasChart({ kind: 'pie', source: 'B2:M3' })],
      points: 2,
    },
  ],
}

export const SCENARIOS: readonly Scenario[] = [smvWahl, felderBerechnen, vermoegen, klima]

export function scenarioById(id: string): Scenario {
  const found = SCENARIOS.find((scenario) => scenario.id === id)
  if (!found) throw new Error(`Unbekanntes Szenario „${id}".`)
  return found
}

export function totalPoints(scenario: Scenario): number {
  return scenario.tasks.reduce((sum, task) => sum + task.points, 0)
}

export * from './grade.ts'
