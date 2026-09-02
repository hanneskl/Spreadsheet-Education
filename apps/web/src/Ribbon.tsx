import type { BorderWeight, CellStyle, CfRule, ChartKind, NumberFormat } from '@quali/core'
import { useEffect, useRef, useState } from 'react'

export type BorderPreset = 'all' | 'outer' | 'thickOuter' | 'none'

interface RibbonProps {
  /** Style of the anchor cell, so the controls can show what is already applied. */
  current: CellStyle
  onStyle: (patch: Partial<CellStyle>) => void
  onNumberFormat: (format: NumberFormat) => void
  onBorders: (preset: BorderPreset) => void
  onMerge: () => void
  isMerged: boolean
  onInsertChart: (kind: ChartKind) => void
  onConditionalFormat: (condition: CfRule['condition'], format: Partial<CellStyle>) => void
  onClearConditionalFormats: () => void
}

const FONTS = ['Calibri', 'Aptos Narrow', 'Arial', 'Arial Black', 'Times New Roman', 'Courier New']
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28]

const FILLS: [string, string][] = [
  ['Kein', 'none'],
  ['Hellblau', '#cfe2f3'],
  ['Gelb', '#fff2cc'],
  ['Rot', '#f4cccc'],
  ['Grün', '#d9ead3'],
  ['Violett', '#d9d2e9'],
  ['Grau', '#d9d9d9'],
  ['Schwarz', '#000000'],
  ['Weiß', '#ffffff'],
]

const FONT_COLOURS: [string, string][] = [
  ['Schwarz', '#000000'],
  ['Weiß', '#ffffff'],
  ['Rot', '#c00000'],
  ['Blau', '#1d4ed8'],
  ['Grün', '#207245'],
  ['Grau', '#6b7280'],
]

const CHARTS: [string, ChartKind][] = [
  ['Säulendiagramm', 'column'],
  ['Balkendiagramm', 'bar'],
  ['Kreisdiagramm', 'pie'],
  ['Liniendiagramm', 'line'],
  ['Flächendiagramm', 'area'],
]

const BORDERS: [string, BorderPreset][] = [
  ['Alle Rahmen', 'all'],
  ['Außenrahmen', 'outer'],
  ['Dicker Außenrahmen', 'thickOuter'],
  ['Kein Rahmen', 'none'],
]

/** Dismiss-on-outside-click wrapper for the split-button menus. */
function Menu({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function away(event: MouseEvent): void {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="menu" ref={ref}>
      {children}
    </div>
  )
}

export function Ribbon({
  current,
  onStyle,
  onNumberFormat,
  onBorders,
  onMerge,
  isMerged,
  onInsertChart,
  onConditionalFormat,
  onClearConditionalFormats,
}: RibbonProps) {
  const [menu, setMenu] = useState<string | null>(null)
  const toggle = (name: string) => setMenu((open) => (open === name ? null : name))
  const close = () => setMenu(null)

  const format = current.numberFormat
  const fill = current.fill ?? '#ffff00'
  const colour = current.color

  function stepSize(direction: 1 | -1): void {
    const index = SIZES.indexOf(current.fontSize)
    const next = index === -1 ? 11 : SIZES[Math.min(Math.max(index + direction, 0), SIZES.length - 1)]!
    onStyle({ fontSize: next })
  }

  return (
    <div className="ribbon">
      {/* ---------------------------------------------------------- row 1 */}
      <div className="ribbon-row">
        <div className="rgroup">
          <select
            className="font-name"
            value={current.fontFamily}
            onChange={(event) => onStyle({ fontFamily: event.target.value })}
            title="Schriftart"
          >
            {FONTS.map((font) => (
              <option key={font} value={font}>{font}</option>
            ))}
          </select>
          <select
            className="font-size"
            value={current.fontSize}
            onChange={(event) => onStyle({ fontSize: Number(event.target.value) })}
            title="Schriftgröße"
          >
            {SIZES.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <button className="tool" title="Schrift vergrößern" onClick={() => stepSize(1)}>
            <span className="glyph-a big">A</span><span className="caretup">⌃</span>
          </button>
          <button className="tool" title="Schrift verkleinern" onClick={() => stepSize(-1)}>
            <span className="glyph-a small">A</span><span className="caretdown">⌄</span>
          </button>
        </div>

        <div className="rgroup">
          {(['top', 'middle', 'bottom'] as const).map((where) => (
            <button
              key={where}
              className={current.vAlign === where ? 'tool on' : 'tool'}
              title={{ top: 'Oben ausrichten', middle: 'Mittig ausrichten', bottom: 'Unten ausrichten' }[where]}
              onClick={() => onStyle({ vAlign: where })}
            >
              <VAlignIcon where={where} />
            </button>
          ))}
        </div>

        <div className="rgroup">
          <div className="split">
            <button
              className={current.wrap ? 'tool wide on' : 'tool wide'}
              title="Textumbruch"
              onClick={() => onStyle({ wrap: !current.wrap })}
            >
              <WrapIcon />
            </button>
            <button className="chev" title="Textumbruch wählen" onClick={() => toggle('wrap')}>⌄</button>
            <Menu open={menu === 'wrap'} onClose={close}>
              <button className="menu-item" onClick={() => { onStyle({ wrap: true }); close() }}>
                Text umbrechen
              </button>
              <button className="menu-item" onClick={() => { onStyle({ wrap: false }); close() }}>
                Umbruch aufheben
              </button>
            </Menu>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------- row 2 */}
      <div className="ribbon-row">
        <div className="rgroup">
          <button
            className={current.bold ? 'tool on' : 'tool'}
            title="Fett"
            onClick={() => onStyle({ bold: !current.bold })}
          >
            <b>F</b>
          </button>
          <button
            className={current.italic ? 'tool on' : 'tool'}
            title="Kursiv"
            onClick={() => onStyle({ italic: !current.italic })}
          >
            <i>K</i>
          </button>
          <button
            className={current.underline ? 'tool on' : 'tool'}
            title="Unterstrichen"
            onClick={() => onStyle({ underline: !current.underline })}
          >
            <u>U</u>
          </button>

          <div className="split">
            <button className="tool" title="Rahmen" onClick={() => onBorders('all')}>
              <BorderIcon />
            </button>
            <button className="chev" title="Rahmen wählen" onClick={() => toggle('border')}>⌄</button>
            <Menu open={menu === 'border'} onClose={close}>
              {BORDERS.map(([label, preset]) => (
                <button
                  key={preset}
                  className="menu-item"
                  onClick={() => { onBorders(preset); close() }}
                >
                  {label}
                </button>
              ))}
            </Menu>
          </div>
        </div>

        <div className="rgroup">
          <div className="split">
            <button
              className="tool"
              title="Füllfarbe"
              onClick={() => onStyle({ fill: fill === 'none' ? null : fill })}
            >
              <BucketIcon colour={current.fill ?? '#ffff00'} />
            </button>
            <button className="chev" title="Füllfarbe wählen" onClick={() => toggle('fill')}>⌄</button>
            <Menu open={menu === 'fill'} onClose={close}>
              <div className="swatches">
                {FILLS.map(([label, value]) => (
                  <button
                    key={value}
                    className={current.fill === value ? 'swatch on' : 'swatch'}
                    style={
                      value === 'none'
                        ? { background: '#fff', backgroundImage: 'linear-gradient(45deg,transparent 45%,#c00 45%,#c00 55%,transparent 55%)' }
                        : { background: value }
                    }
                    title={label}
                    onClick={() => { onStyle({ fill: value === 'none' ? null : value }); close() }}
                  />
                ))}
              </div>
            </Menu>
          </div>

          <div className="split">
            <button className="tool" title="Schriftfarbe" onClick={() => onStyle({ color: colour })}>
              <FontColourIcon colour={colour} />
            </button>
            <button className="chev" title="Schriftfarbe wählen" onClick={() => toggle('color')}>⌄</button>
            <Menu open={menu === 'color'} onClose={close}>
              <div className="swatches">
                {FONT_COLOURS.map(([label, value]) => (
                  <button
                    key={value}
                    className={current.color === value ? 'swatch on' : 'swatch'}
                    style={{ background: value }}
                    title={label}
                    onClick={() => { onStyle({ color: value }); close() }}
                  />
                ))}
              </div>
            </Menu>
          </div>
        </div>

        <div className="rgroup">
          {(['left', 'center', 'right'] as const).map((align) => (
            <button
              key={align}
              className={current.hAlign === align ? 'tool on' : 'tool'}
              title={{ left: 'Linksbündig', center: 'Zentriert', right: 'Rechtsbündig' }[align]}
              onClick={() => onStyle({ hAlign: align })}
            >
              <HAlignIcon align={align} />
            </button>
          ))}
        </div>

        <div className="rgroup">
          <div className="split">
            <button
              className={isMerged ? 'tool wide on' : 'tool wide'}
              title="Verbinden und zentrieren"
              onClick={onMerge}
            >
              <MergeIcon />
            </button>
            <button className="chev" title="Verbinden" onClick={() => toggle('merge')}>⌄</button>
            <Menu open={menu === 'merge'} onClose={close}>
              <button className="menu-item" onClick={() => { onMerge(); close() }}>
                {isMerged ? 'Zellverbund aufheben' : 'Verbinden und zentrieren'}
              </button>
            </Menu>
          </div>
        </div>

        <div className="rgroup">
          <div className="split">
            <button
              className="tool wide"
              title="Bedingte Formatierung"
              onClick={() => toggle('cf')}
            >
              <CfIcon />
            </button>
            <button className="chev" title="Regel wählen" onClick={() => toggle('cf')}>⌄</button>
            <Menu open={menu === 'cf'} onClose={close}>
              <CfForm
                onApply={(condition, format) => { onConditionalFormat(condition, format); close() }}
                onClear={() => { onClearConditionalFormats(); close() }}
              />
            </Menu>
          </div>
        </div>

        <div className="rgroup">
          <div className="split">
            <button className="tool wide" title="Diagramm einfügen" onClick={() => onInsertChart('column')}>
              <ChartIcon />
            </button>
            <button className="chev" title="Diagrammtyp wählen" onClick={() => toggle('chart')}>⌄</button>
            <Menu open={menu === 'chart'} onClose={close}>
              {CHARTS.map(([label, kind]) => (
                <button key={kind} className="menu-item" onClick={() => { onInsertChart(kind); close() }}>
                  {label}
                </button>
              ))}
            </Menu>
          </div>
        </div>

        <div className="rgroup">
          <select
            className="numfmt"
            value={formatKey(format)}
            onChange={(event) => onNumberFormat(formatFromKey(event.target.value))}
            title="Zahlenformat"
          >
            <option value="general">Standard</option>
            <option value="number:0">Zahl, 0 Stellen</option>
            <option value="number:2">Zahl, 2 Stellen</option>
            <option value="currency:2">Währung €, 2 Stellen</option>
            <option value="currency:0">Währung €, 0 Stellen</option>
            <option value="percent:1">Prozent, 1 Stelle</option>
            <option value="percent:2">Prozent, 2 Stellen</option>
            <option value="date">Datum TT.MM.JJ</option>
          </select>
          {format.kind === 'currency' && (
            <button
              className={format.negativeRed ? 'tool on' : 'tool'}
              title="Negative Zahlen rot"
              onClick={() => onNumberFormat({ ...format, negativeRed: !format.negativeRed })}
            >
              <span className="neg">−12</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- icons */

function VAlignIcon({ where }: { where: 'top' | 'middle' | 'bottom' }) {
  const y = { top: 3.5, middle: 8, bottom: 12.5 }[where]
  return (
    <svg viewBox="0 0 16 16" className="ico" aria-hidden>
      <line x1="2" y1={y} x2="14" y2={y} className="accent" strokeWidth="1.6" />
      <line x1="4" y1={y + 3} x2="12" y2={y + 3} className="faint" />
      <line x1="4" y1={y + 5.5} x2="12" y2={y + 5.5} className="faint" />
    </svg>
  )
}

function HAlignIcon({ align }: { align: 'left' | 'center' | 'right' }) {
  const short = { left: [2, 10], center: [4, 12], right: [6, 14] }[align]
  return (
    <svg viewBox="0 0 16 16" className="ico" aria-hidden>
      {[3, 6, 9, 12].map((y, i) => {
        const [x1, x2] = i % 2 === 1 ? short : [2, 14]
        return <line key={y} x1={x1} y1={y} x2={x2} y2={y} />
      })}
    </svg>
  )
}

function WrapIcon() {
  return (
    <svg viewBox="0 0 22 16" className="ico wideico" aria-hidden>
      <text x="0" y="7" className="tiny">ab</text>
      <path d="M11 4 h7 a3 3 0 0 1 0 6 h-5" fill="none" />
      <path d="M8 10 l3 -2.5 v5 z" className="solid" />
      <line x1="0" y1="13.5" x2="10" y2="13.5" />
    </svg>
  )
}

function BorderIcon() {
  return (
    <svg viewBox="0 0 16 16" className="ico" aria-hidden>
      <rect x="2" y="2" width="12" height="12" fill="none" strokeDasharray="2 1.6" />
      <line x1="8" y1="2" x2="8" y2="14" strokeDasharray="2 1.6" />
      <line x1="2" y1="8" x2="14" y2="8" strokeDasharray="2 1.6" />
    </svg>
  )
}

function BucketIcon({ colour }: { colour: string }) {
  return (
    <svg viewBox="0 0 16 18" className="ico tallico" aria-hidden>
      <path d="M4 7.5 L8.5 3 L13 7.5 L8.5 12 Z" fill="none" />
      <path d="M6 5.5 L3 8.5 a2.2 2.2 0 0 0 3 3.2" fill="none" />
      <rect x="1" y="14" width="14" height="3.2" fill={colour} stroke="#9ca3af" strokeWidth="0.6" />
    </svg>
  )
}

function FontColourIcon({ colour }: { colour: string }) {
  return (
    <svg viewBox="0 0 16 18" className="ico tallico" aria-hidden>
      <text x="8" y="11" textAnchor="middle" className="bigA">A</text>
      <rect x="1" y="14" width="14" height="3.2" fill={colour} stroke="#9ca3af" strokeWidth="0.6" />
    </svg>
  )
}

/**
 * The rule builder. Students set a threshold and a colour, which is the whole of what the
 * exam asks for („Wenn die Temperatur unter 5°C soll die Zelle einen blauen Hintergrund
 * bekommen"), and far less than Excel's own dialog.
 */
function CfForm({
  onApply,
  onClear,
}: {
  onApply: (condition: CfRule['condition'], format: Partial<CellStyle>) => void
  onClear: () => void
}) {
  const [kind, setKind] = useState<CfRule['condition']['kind']>('greaterThan')
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [paint, setPaint] = useState<'fill' | 'color'>('fill')
  const [colour, setColour] = useState('#cfe2f3')

  const number = (text: string) => Number(text.replace(',', '.'))

  function apply(): void {
    const condition: CfRule['condition'] =
      kind === 'between'
        ? { kind: 'between', min: number(first), max: number(second) }
        : kind === 'equalText'
          ? { kind: 'equalText', text: first }
          : kind === 'lessThan'
            ? { kind: 'lessThan', value: number(first) }
            : { kind: 'greaterThan', value: number(first) }
    onApply(condition, paint === 'fill' ? { fill: colour } : { color: colour })
  }

  return (
    <div className="cf-form">
      <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
        <option value="greaterThan">Größer als</option>
        <option value="lessThan">Kleiner als</option>
        <option value="between">Zwischen</option>
        <option value="equalText">Text gleich</option>
      </select>
      <div className="cf-values">
        <input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Wert" />
        {kind === 'between' && (
          <input value={second} onChange={(e) => setSecond(e.target.value)} placeholder="bis" />
        )}
      </div>
      <select value={paint} onChange={(event) => setPaint(event.target.value as 'fill' | 'color')}>
        <option value="fill">Hintergrund färben</option>
        <option value="color">Schrift färben</option>
      </select>
      <div className="swatches">
        {(paint === 'fill' ? FILLS.filter(([, v]) => v !== 'none') : FONT_COLOURS).map(
          ([label, value]) => (
            <button
              key={value}
              className={colour === value ? 'swatch on' : 'swatch'}
              style={{ background: value }}
              title={label}
              onClick={() => setColour(value)}
            />
          ),
        )}
      </div>
      <button className="menu-item cf-apply" onClick={apply}>Regel übernehmen</button>
      <button className="menu-item" onClick={onClear}>Regeln löschen</button>
    </div>
  )
}

function CfIcon() {
  return (
    <svg viewBox="0 0 18 16" className="ico" aria-hidden>
      <rect x="1.5" y="2.5" width="7" height="11" fill="#cfe2f3" stroke="#3d4450" />
      <rect x="9.5" y="2.5" width="7" height="11" fill="#f4cccc" stroke="#3d4450" />
      <line x1="9" y1="2.5" x2="9" y2="13.5" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 18 16" className="ico" aria-hidden>
      <line x1="1.5" y1="14" x2="16.5" y2="14" />
      <rect x="3" y="8" width="3" height="6" className="fill1" />
      <rect x="7.5" y="4.5" width="3" height="9.5" className="fill2" />
      <rect x="12" y="6.5" width="3" height="7.5" className="fill3" />
    </svg>
  )
}

function MergeIcon() {
  return (
    <svg viewBox="0 0 22 16" className="ico wideico" aria-hidden>
      <rect x="1.5" y="3.5" width="19" height="9" fill="none" />
      <path d="M7 8 h-4 M4.5 6.2 L2.6 8 L4.5 9.8" fill="none" />
      <path d="M15 8 h4 M17.5 6.2 L19.4 8 L17.5 9.8" fill="none" />
    </svg>
  )
}

/* ------------------------------------------------------- number formats */

function formatKey(format: NumberFormat): string {
  switch (format.kind) {
    case 'number': return `number:${format.decimals}`
    case 'currency': return `currency:${format.decimals}`
    case 'percent': return `percent:${format.decimals}`
    case 'date': return 'date'
    default: return 'general'
  }
}

function formatFromKey(key: string): NumberFormat {
  const [kind, decimals] = key.split(':')
  const places = Number(decimals ?? 0)
  switch (kind) {
    case 'number': return { kind: 'number', decimals: places }
    case 'currency': return { kind: 'currency', decimals: places, symbol: '€', negativeRed: false }
    case 'percent': return { kind: 'percent', decimals: places }
    case 'date': return { kind: 'date', pattern: 'DD.MM.YY' }
    default: return { kind: 'general' }
  }
}

/** Border presets as per-cell edge weights, applied by the caller across the selection. */
export function borderWeights(preset: BorderPreset): BorderWeight {
  switch (preset) {
    case 'thickOuter': return 'thick'
    case 'none': return 'none'
    default: return 'thin'
  }
}
