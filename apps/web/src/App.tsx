import {
  DEFAULT_STYLE,
  formatValue,
  translateInput,
  type CellStyle,
  type CfRule,
  type ChartKind,
  type NumberFormat,
  type Sheet,
} from '@quali/core'
import {
  SCENARIOS,
  gradeSubmission,
  scenarioById,
  serialiseMerges,
  totalPoints,
  type Submission,
  type TaskDef,
} from '@quali/scenarios'
import { useEffect, useMemo, useRef, useState } from 'react'
import { backend, hasBackend, signOut, submitAttempt } from './backend.ts'
import { Login } from './Login.tsx'
import { Grid } from './Grid.tsx'
import { Ribbon, borderWeights, type BorderPreset } from './Ribbon.tsx'
import { Chart } from './Chart.tsx'
import { handlePointKey, stopPointing, type EditState } from './editing.ts'
import {
  canPoint,
  cellsOf,
  rectLabel,
  rectOf,
  single,
  toA1,
  toPos,
  type Pos,
  type Rect,
  type Selection,
} from './selection.ts'

type Status = 'open' | 'passed' | 'failed'

interface TaskState {
  readonly status: Status
  readonly message: string
  /** True while the server has not yet confirmed the browser's provisional result. */
  readonly pending: boolean
}

interface Clipboard {
  readonly rect: Rect
  readonly inputs: readonly (readonly string[])[]
  readonly styles: readonly (readonly CellStyle[])[]
}

export function App() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0]!.id)
  const scenario = useMemo(() => scenarioById(scenarioId), [scenarioId])

  // One sheet per scenario, kept alive across switches so a student can move between
  // scenarios without losing work. Only Zurücksetzen re-seeds.
  const sheetsRef = useRef(new Map<string, Sheet>())
  function sheetFor(id: string): Sheet {
    const existing = sheetsRef.current.get(id)
    if (existing) return existing
    const created = scenarioById(id).seed()
    sheetsRef.current.set(id, created)
    return created
  }
  const sheet = sheetFor(scenarioId)

  const [revision, setRevision] = useState(0)
  const [selection, setSelection] = useState<Selection>(single({ row: 0, col: 0 }))
  const [edit, setEdit] = useState<EditState | null>(null)
  const [clipboard, setClipboard] = useState<Clipboard | null>(null)
  const [states, setStates] = useState<Record<string, TaskState>>({})
  const [renamingTab, setRenamingTab] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [authReady, setAuthReady] = useState(!hasBackend)

  useEffect(() => {
    if (!backend) return
    backend.auth.getSession().then(({ data }) => {
      setSignedIn(data.session !== null)
      setAuthReady(true)
    })
    const { data } = backend.auth.onAuthStateChange((_event, session) => {
      setSignedIn(session !== null)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const rect = rectOf(selection)
  const activeA1 = toA1(selection.anchor)

  function touch(): void {
    setRevision((value) => value + 1)
  }

  /** Switch scenarios, keeping whatever the student has already done in each. */
  function switchScenario(id: string): void {
    setScenarioId(id)
    sheetFor(id)
    setSelection(single({ row: 0, col: 0 }))
    setEdit(null)
    setClipboard(null)
    touch()
  }

  /** Start the current scenario over: fresh sheet, and forget only its own task results. */
  function resetScenario(): void {
    sheetsRef.current.set(scenarioId, scenarioById(scenarioId).seed())
    setStates((previous) => {
      const next = { ...previous }
      for (const task of scenario.tasks) delete next[task.id]
      return next
    })
    setSelection(single({ row: 0, col: 0 }))
    setEdit(null)
    setClipboard(null)
    touch()
  }

  function commit(a1: string, input: string): void {
    sheet.setInput(a1, input)
    touch()
  }

  function clear(target: Rect): void {
    for (const pos of cellsOf(target)) sheet.setInput(toA1(pos), '')
    touch()
  }

  /** Drag-to-fill: repeat the source pattern across the extension, translating references. */
  function fill(source: Rect, extension: Rect): void {
    const height = source.bottom - source.top + 1
    const width = source.right - source.left + 1

    for (const pos of cellsOf(extension)) {
      // Walk backwards from the source so a multi-cell pattern repeats instead of stretching.
      const offsetRow = ((pos.row - source.top) % height + height) % height
      const offsetCol = ((pos.col - source.left) % width + width) % width
      const from = { row: source.top + offsetRow, col: source.left + offsetCol }
      const fromA1 = toA1(from)
      sheet.setInput(
        toA1(pos),
        translateInput(sheet.getInput(fromA1), pos.row - from.row, pos.col - from.col),
      )
      sheet.setStyle(toA1(pos), sheet.getStyle(fromA1))
    }
    setSelection({
      anchor: { row: Math.min(source.top, extension.top), col: Math.min(source.left, extension.left) },
      focus: { row: Math.max(source.bottom, extension.bottom), col: Math.max(source.right, extension.right) },
    })
    touch()
  }

  /** Copy: remember the formulas internally, and hand the displayed values to the OS. */
  function copy(target: Rect): string {
    const inputs: string[][] = []
    const styles: CellStyle[][] = []
    const lines: string[] = []

    for (let row = target.top; row <= target.bottom; row++) {
      const inputRow: string[] = []
      const styleRow: CellStyle[] = []
      const cells: string[] = []
      for (let col = target.left; col <= target.right; col++) {
        const a1 = toA1({ row, col })
        inputRow.push(sheet.getInput(a1))
        styleRow.push(sheet.getStyle(a1))
        cells.push(formatValue(sheet.getValue(a1), sheet.getStyle(a1).numberFormat).text)
      }
      inputs.push(inputRow)
      styles.push(styleRow)
      lines.push(cells.join('\t'))
    }

    setClipboard({ rect: target, inputs, styles })
    return lines.join('\n')
  }

  function paste(target: Pos, external: string | null): void {
    if (clipboard) {
      const dRow = target.row - clipboard.rect.top
      const dCol = target.col - clipboard.rect.left
      // A single copied cell fills the whole selection, as in Excel.
      const spread =
        clipboard.inputs.length === 1 && clipboard.inputs[0]!.length === 1
          ? rect
          : {
              top: target.row,
              left: target.col,
              bottom: target.row + clipboard.inputs.length - 1,
              right: target.col + clipboard.inputs[0]!.length - 1,
            }

      for (const pos of cellsOf(spread)) {
        const sourceRow = clipboard.inputs.length === 1 ? 0 : pos.row - target.row
        const sourceCol = clipboard.inputs[0]!.length === 1 ? 0 : pos.col - target.col
        const input = clipboard.inputs[sourceRow]?.[sourceCol] ?? ''
        const style = clipboard.styles[sourceRow]?.[sourceCol]
        const rowShift = clipboard.inputs.length === 1 ? pos.row - clipboard.rect.top : dRow
        const colShift = clipboard.inputs[0]!.length === 1 ? pos.col - clipboard.rect.left : dCol
        sheet.setInput(toA1(pos), translateInput(input, rowShift, colShift))
        if (style) sheet.setStyle(toA1(pos), style)
      }
      touch()
      return
    }

    if (!external) return
    // Nothing of ours on the clipboard — treat outside text as literal rows and columns.
    external.split(/\r?\n/).forEach((line, rowOffset) => {
      line.split('\t').forEach((value, colOffset) => {
        sheet.setInput(toA1({ row: target.row + rowOffset, col: target.col + colOffset }), value)
      })
    })
    touch()
  }

  function applyStyle(patch: Partial<CellStyle>): void {
    for (const pos of cellsOf(rect)) sheet.setStyle(toA1(pos), patch)
    touch()
  }

  function applyNumberFormat(numberFormat: NumberFormat): void {
    applyStyle({ numberFormat })
  }

  /**
   * Borders are range-aware: „Außenrahmen" outlines the selection's perimeter rather than
   * boxing every cell, which is what „dicke Außenlinie" in the 2025 paper asks for.
   */
  function applyBorders(preset: BorderPreset): void {
    const weight = borderWeights(preset)
    const everySide = preset === 'all' || preset === 'none'

    for (const pos of cellsOf(rect)) {
      sheet.setStyle(toA1(pos), {
        borders: {
          top: everySide || pos.row === rect.top ? weight : 'none',
          bottom: everySide || pos.row === rect.bottom ? weight : 'none',
          left: everySide || pos.col === rect.left ? weight : 'none',
          right: everySide || pos.col === rect.right ? weight : 'none',
        },
      })
    }
    touch()
  }

  /** „Verbinden und zentrieren" is one gesture in Excel, so it is one button here. */
  function toggleMerge(): void {
    const range = { start: { row: rect.top, col: rect.left, colAbs: false, rowAbs: false },
                    end: { row: rect.bottom, col: rect.right, colAbs: false, rowAbs: false } }
    if (sheet.isMerged(range)) {
      sheet.unmerge(range)
    } else {
      sheet.merge(range)
      sheet.setStyle(toA1({ row: rect.top, col: rect.left }), { hAlign: 'center' })
    }
    touch()
  }

  const mergedNow = sheet.isMerged({
    start: { row: rect.top, col: rect.left, colAbs: false, rowAbs: false },
    end: { row: rect.bottom, col: rect.right, colAbs: false, rowAbs: false },
  })

  /** Apply a conditional-formatting rule over the current selection (skills F16–F18). */
  function addConditionalFormat(
    condition: CfRule['condition'],
    format: Partial<CellStyle>,
  ): void {
    sheet.addConditionalFormat({
      range: {
        start: { row: rect.top, col: rect.left, colAbs: false, rowAbs: false },
        end: { row: rect.bottom, col: rect.right, colAbs: false, rowAbs: false },
      },
      condition,
      format,
    })
    touch()
  }

  /** Insert a chart reading the current selection — Excel's "Einfügen → Diagramm". */
  function insertChart(kind: ChartKind): void {
    sheet.addChart({
      id: `chart-${Date.now()}`,
      kind,
      source: {
        start: { row: rect.top, col: rect.left, colAbs: false, rowAbs: false },
        end: { row: rect.bottom, col: rect.right, colAbs: false, rowAbs: false },
      },
      title: null,
      axisTitles: { x: null, y: null },
      dataLabels: kind === 'pie' ? 'percent' : 'none',
    })
    touch()
  }

  /**
   * Everything the student has done, which is what gets re-graded.
   * Formatting has to travel with the inputs — without it no style check can pass, and the
   * cells a formatting task targets are often ones the scenario seeded.
   */
  function currentWork(): Omit<Submission, 'scenarioId' | 'taskId'> {
    const inputs: Record<string, string> = {}
    for (const a1 of sheet.populatedCells()) inputs[a1] = sheet.getInput(a1)

    const styles: Record<string, Partial<CellStyle>> = {}
    for (let row = 0; row < scenario.rows; row++) {
      for (let col = 0; col < scenario.columns; col++) {
        const a1 = toA1({ row, col })
        const style = sheet.getStyle(a1)
        if (style !== DEFAULT_STYLE) styles[a1] = style
      }
    }
    return {
      inputs,
      styles,
      merges: serialiseMerges(sheet),
      charts: [...sheet.charts],
      conditionalFormats: [...sheet.conditionalFormats],
      sheetName: sheet.name,
    }
  }

  /**
   * Grade locally for instant feedback, then let the server's verdict overwrite it.
   * Both sides run the same gradeSubmission, so they should agree — but the server's answer
   * is the one that is recorded, and the one we display once it lands.
   */
  async function check(task: TaskDef): Promise<void> {
    const work = currentWork()
    const local = gradeSubmission({ scenarioId, taskId: task.id, ...work })
    setStates((previous) => ({
      ...previous,
      [task.id]: {
        status: local.passed ? 'passed' : 'failed',
        message: local.message,
        pending: hasBackend,
      },
    }))
    if (!hasBackend) return

    const { grade, error } = await submitAttempt(scenarioId, task.id, work)
    setStates((previous) => ({
      ...previous,
      [task.id]: grade
        ? { status: grade.passed ? 'passed' : 'failed', message: grade.message, pending: false }
        : {
            status: previous[task.id]?.status ?? 'failed',
            message: error ?? previous[task.id]?.message ?? '',
            pending: false,
          },
    }))
  }

  const earned = scenario.tasks
    .filter((task) => states[task.id]?.status === 'passed')
    .reduce((sum, task) => sum + task.points, 0)

  const barValue = edit ? edit.draft : sheet.getInput(activeA1)

  if (!authReady) return <div className="login"><p>Wird geladen …</p></div>
  if (hasBackend && !signedIn) return <Login onSignedIn={() => setSignedIn(true)} />

  return (
    <div className="app">
      <header>
        <div>
          <h1>Quali Excel Trainer</h1>
          <p className="subtitle">{scenario.subtitleDe}</p>
        </div>
        <div className="header-right">
          <select value={scenarioId} onChange={(event) => switchScenario(event.target.value)}>
            {SCENARIOS.map((item) => (
              <option key={item.id} value={item.id}>{item.titleDe}</option>
            ))}
          </select>
          <span className="score">{earned} / {totalPoints(scenario)} Punkte</span>
          <button className="ghost" onClick={resetScenario}>Zurücksetzen</button>
          {hasBackend && (
            <button className="ghost" onClick={() => void signOut()}>Abmelden</button>
          )}
        </div>
      </header>

      <main>
        <section className="sheet-pane">
          <Ribbon
            current={sheet.getStyle(activeA1)}
            onStyle={applyStyle}
            onNumberFormat={applyNumberFormat}
            onBorders={applyBorders}
            onMerge={toggleMerge}
            isMerged={mergedNow}
            onInsertChart={insertChart}
            onConditionalFormat={addConditionalFormat}
            onClearConditionalFormats={() => { sheet.clearConditionalFormats(); touch() }}
          />
          <div className="formula-bar">
            <span className="address">{rectLabel(rect)}</span>
            <input
              className="formula-input"
              value={barValue}
              placeholder="Formel eingeben, z. B. =SUMME(B2:B6)"
              onChange={(event) => {
                // React clears `currentTarget` once the handler returns, and a functional
                // updater runs later — so every DOM read has to happen here, not inside it.
                const draft = event.target.value
                const caret = event.target.selectionStart ?? draft.length
                setEdit((previous) =>
                  stopPointing({
                    a1: previous?.a1 ?? activeA1,
                    draft,
                    caret,
                    from: 'bar',
                    point: previous?.point ?? null,
                  }),
                )
              }}
              onSelect={(event) => {
                const caret = event.currentTarget.selectionStart
                setEdit((previous) =>
                  previous ? { ...previous, caret: caret ?? previous.caret } : previous,
                )
              }}
              onKeyDown={(event) => {
                if (edit) {
                  const pointed = handlePointKey(
                    edit,
                    event.key,
                    event.shiftKey,
                    toPos(edit.a1),
                    { rows: scenario.rows, columns: scenario.columns },
                  )
                  if (pointed) {
                    event.preventDefault()
                    setEdit(pointed)
                    return
                  }
                }
                if (event.key === 'Enter' && edit) {
                  commit(edit.a1, edit.draft)
                  setEdit(null)
                }
                if (event.key === 'Escape') setEdit(null)
              }}
              onBlur={() => {
                // Blurring to point at a cell must not commit; the grid handles that case.
                if (edit && edit.from === 'bar' && !canPoint(edit.draft, edit.caret)) {
                  commit(edit.a1, edit.draft)
                  setEdit(null)
                }
              }}
            />
          </div>
          {renamingTab ? (
            <input
              className="tab-input"
              autoFocus
              defaultValue={sheet.name}
              onBlur={(event) => { sheet.name = event.target.value.trim() || sheet.name; setRenamingTab(false); touch() }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
                if (event.key === 'Escape') setRenamingTab(false)
              }}
            />
          ) : (
            <div
              className="tab"
              title="Doppelklick zum Umbenennen"
              onDoubleClick={() => setRenamingTab(true)}
            >
              {sheet.name}
            </div>
          )}
          <Grid
            sheet={sheet}
            columns={scenario.columns}
            rows={scenario.rows}
            selection={selection}
            onSelectionChange={setSelection}
            edit={edit}
            onEditChange={setEdit}
            onCommit={commit}
            onClear={clear}
            onFill={fill}
            onCopy={copy}
            onPaste={paste}
            copiedRect={clipboard?.rect ?? null}
            revision={revision}
          />
          {sheet.charts.length > 0 && (
            <div className="charts">
              {sheet.charts.map((spec) => (
                <div className="chart-card" key={spec.id}>
                  <Chart sheet={sheet} spec={spec} />
                  <div className="chart-controls">
                    <input
                      value={spec.title ?? ''}
                      placeholder="Diagrammtitel"
                      onChange={(event) => {
                        sheet.updateChart(spec.id, { title: event.target.value || null })
                        touch()
                      }}
                    />
                    <select
                      value={spec.dataLabels}
                      title="Datenbeschriftungen"
                      onChange={(event) => {
                        sheet.updateChart(spec.id, {
                          dataLabels: event.target.value as typeof spec.dataLabels,
                        })
                        touch()
                      }}
                    >
                      <option value="none">Keine Beschriftung</option>
                      <option value="value">Werte</option>
                      <option value="percent">Prozentwerte</option>
                    </select>
                    <button
                      className="ghost small drop"
                      title="Diagramm löschen"
                      onClick={() => { sheet.removeChart(spec.id); touch() }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="hint">
            Ziehen am kleinen Quadrat unten rechts füllt die Formel weiter · Strg+C / Strg+V
            kopiert und fügt ein · beim Schreiben einer Formel fügt ein Klick auf eine Zelle
            deren Bezug ein
          </p>
        </section>

        <aside className="tasks">
          <div className="tasks-head">
            <h2>Arbeitsaufträge</h2>
            <button onClick={() => scenario.tasks.forEach((task) => void check(task))}>Alles prüfen</button>
          </div>
          <p className="rule">Alle Berechnungen sind mit Formeln durchzuführen!</p>

          <ol>
            {scenario.tasks.map((task, index) => {
              const state: TaskState = states[task.id] ?? { status: 'open', message: '', pending: false }
              return (
                <li key={task.id} className={`task ${state.status}`}>
                  <div className="task-head">
                    <span className="mark">
                      {state.status === 'passed' ? '✓' : state.status === 'failed' ? '✗' : index + 1}
                    </span>
                    <span className="points">{task.points} P</span>
                  </div>
                  <p className="prompt">{task.promptDe}</p>
                  {state.status === 'failed' && <p className="feedback">{state.message}</p>}
                  {state.pending && <p className="pending">wird gespeichert …</p>}
                  <button className="ghost small" onClick={() => void check(task)}>Prüfen</button>
                </li>
              )
            })}
          </ol>
        </aside>
      </main>
    </div>
  )
}

