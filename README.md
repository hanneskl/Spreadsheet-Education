# Spreadsheet Education

A web-based Excel clone that guides Mittelschule students through the **Datenverarbeitung**
(Excel) part of the Bavarian *Qualifizierender Abschluss* in Informatik — and verifies they
solved each task themselves, with real formulas rather than typed-in results.

This document is the authoritative inventory of **what has to be taught and what has to be
checked**. It was compiled by mining every Quali and Probequali exam from 2019 to 2026 plus the
existing teaching material. No application code exists yet; this catalogue comes first.

**Conventions**
- Code and documentation: English.
- Everything the student sees — task texts, hints, feedback: German.
- Formula engine: **German function names only**, `;` as argument separator.

---

## 1. The exam

*Besondere Leistungsfeststellung im Fach Informatik*, Mittelschule Glonn / Montessorischule
Niederseeon. Three parts, 30 points each, 90 total, 2.5 hours:

| Part | Content | Points |
|---|---|---|
| A — Theorie | Hardware, CPU/RAM, binary, networks, IP, flowcharts | 30 |
| **B — Datenverarbeitung** | **Excel — the subject of this project** | **30** |
| C — Programmieren | Scratch | 30 |

Grade boundaries (2026): 90–76.5 = **1** · 76–62 = **2** · 61.5–47 = **3** · 46.5–30 = **4** ·
29.5–16 = **5** · 15.5–0 = **6**.

The Excel part has been worth 11–30 points depending on the year (2022: 11, 2023: 23, 2025: 23,
2026: 30). Per-task point weightings are published in every paper and should be carried into the
trainer so it can score like the real exam.

**Out of scope:** Theorie and Programmieren. This project trains Part B only.

---

## 2. Source corpus

Everything below was read from Google Drive → `Teaching`.

| Year | File | Scenario sheets |
|---|---|---|
| 2019 | `Excel/2019 Quali Excel.xlsx` (+ Nachholtermin) | Probequali-Punkte · Wahlen · Felder berechnen |
| 2020 | `Excel/2020 Quali Excel.xlsx` | Corona · Felder berechnen · Wahlen |
| 2021 | `Excel/2021 Quali Excel.xlsx` | Taschengeld/Bilanz · Wetter · Betriebszugehörigkeit |
| 2022 | `Excel/2022 Quali Excel.xlsx` | Klima · Felder berechnen · Spendensammlung/Bonus |
| 2023 | `Excel/2023 Quali Excel.xlsx`, `2023 Probequali Excel.xlsx` | Taschengeld · Felder berechnen · Rechnen mit Funktionen 1 + 2 |
| 2025 | `Excel/2025 Quali Excel.xlsx` + `… Lösung.xlsx` | Vermögen · Wahlen · Felder berechnen |
| 2026 | `Informatik/2026-06-12 Quali 2026 Informatik.pdf`, `2026-03-02 Probequali Excel.xlsx` | Stromverbrauch · Felder berechnen · SMV Wahl · Taschengeld |
| — | `2024-10-08 Informatik Excel` (slides) | Curriculum: functions, conditional formatting, cross-sheet references, charts |
| — | `2025-11-25 Excel Diagramme.xlsx` | Linien-, Flächen-, Balken-, Tortendiagramm |
| — | `2025-10-15 Excel - Self Learning Tool.xlsm` | Existing task list and check model (`FALSE` / `Offen` / `Manuell`) |

`Alle Qualis.pdf` supplied per-task point weightings for 2019, 2020, 2022 and 2023.

---

## 3. Skill catalogue

Each entry: **ID · skill · verbatim German task sample · years observed · check tier**
(tiers defined in [§5](#5-checking-model)).

### S — Sheet and data mechanics

| ID | Skill | German task sample | Years | Check |
|---|---|---|---|---|
| S1 | Rename worksheet tab | „Benenne das Registerblatt um in »Klima«" | 19, 20, 21, 22, 23, 25 | structure |
| S2 | Sort a range | „Sortiere die Tabelle nach Namen von A-Z" · „nach Infizierten absteigend" | 19, 20, 22, 23, 25 | structure |
| S3 | Column width / row height / fit font to cell | „Passe die Schriftgröße in Zeile 3 an die Zellengröße an" | 19 | structure |
| S4 | Copy sheet, paste ranges with paste options | „Kopiere das Arbeitsblatt ohne das Diagramm und Arbeitsanweisung" | 23, slides | structure |
| S5 | Save / persist | „Speichere auf dem USB-Stick" | all | structure |
| S6 | Label a cell with given text | „Beschrifte Zelle H6 mit: »Gesamt«" | 21, 23 | value |

> **Trap (S2).** The self-learning tool asks „Sortiere **NUR** die Namen alphabetisch" — sorting a
> single column detaches names from their data. The trainer should teach why this destroys the
> table and check for it explicitly.

### F — Formatting

| ID | Skill | German task sample | Years | Check |
|---|---|---|---|---|
| F1 | Merge and center + label | „Verbinde und zentriere die Zellen B1 - H1 und beschrifte sie mit »Familienvermögen«" | 19, 20, 21, 22, 25 | style |
| F2 | Cell fill colour | „Wähle als Füllfarbe der Zelle ein helles Blau" · Parteifarben | 19, 20, 23, 25 | style |
| F3 | Bold | „Formatiere die Zeile 3 fett" | 19, 20, 21, 22, 23, 25 | style |
| F4 | Font family and size | „Arial, Schriftgröße 10" · „Arial Black, 14 pt" | 20, tool | style |
| F5 | Font colour | „CSU: Schwarz (Schriftfarbe in weiß ändern!)" | 19, 25 | style |
| F6 | Horizontal alignment (centered / right) | „…dass sie zentriert in der Zelle stehen" | 19, 20, 21, 25 | style |
| F7 | Vertical + horizontal centering | „Richte die Zelle vertikal und horizontal zentriert aus." | tool | style |
| F8 | Text wrap | „Formatiere die Zelle so, dass der Inhalt in zwei Zeilen steht" | 21, 22, tool | style |
| F9 | Borders | „Ziehe um die Zelle einen Rahmen (dicke Außenlinie)." | tool | style |
| F10 | Currency € with 2 decimals | „Formatiere die Zahlen in Währung Euro mit zwei Dezimalstellen" | 21, 22, 23, 26 | style |
| F11 | Negative numbers red | „…negative Zahlen erscheinen dann rot" | 23 | style |
| F12 | € without decimals | „Formatiere die Zelle mit dem €-Zeichen ohne Kommastellen" | tool | style |
| F13 | Percent with 2 decimals | „Formatiere die Zellen … in Prozent mit 2 Nachkommastellen" | 19, 20, 25, 26 | style |
| F14 | Set decimal places | „Richte die Zahl zentriert aus und setze eine Kommastelle." | tool | style |
| F15 | Date format `DD.MM.YY` | „Stelle das Datum im Format DD.MM.YY dar." | tool | style |
| F16 | Conditional formatting → font colour | „Färbe die Schrift … in rot falls eine Partei weniger als 5% der Stimmen erreicht hat. Nutze eine bedingte Formatierung." | 25, tool | style (rule) |
| F17 | Conditional formatting → fill | „Wenn die Temperatur unter 5°C soll die Zelle einen blauen Hintergrund bekommen" · „über 55 Jahre alt → hellrot" | 21, 22, tool | style (rule) |
| F18 | Conditional formatting with value display | Bonus: grün + „100,--€" / rot + „0,--€" | 23 | style (rule) |

### C — Formulas and references

| ID | Skill | German task sample | Years | Check |
|---|---|---|---|---|
| C1 | Formula entry (`=`) | „Alle Berechnungen sind mit Formeln durchzuführen!" | all | formula |
| C2 | Arithmetic and operator precedence | „Tipp: Beachte Punkt vor Strich!" | 20, tool | formula |
| C3 | Cell references and ranges | `C2:C5`, multi-range arguments | slides | formula |
| C4 | Relative reference + fill down | „=B3*$G$2 → nach unten ziehen bis C14" | 26 | formula |
| C5 | Absolute reference `$G$2` + fill down | „Absoluter Bezug auf $B$8 ist Pflicht." | 26 | formula |
| C6 | Cross-sheet references | „Tabellenblattübergreifende Bezüge" | slides, 23 | formula |
| C7 | Percent of total | „Berechne den prozentualen Anteil am Familienvermögen" | 19, 25, 26 | formula + value |
| C8 | Percentage increase / discount | „Erhöhe 80 € um 15 %" · „200 € mit 20 % Rabatt" | tool | value |
| C9 | Ratio from two columns | „Sterberate = Tote / Infizierte, Genesenrate analog" | 20 | formula + value |
| C10 | Difference of two aggregates | „Berechne Guthaben/Schulden" · SALDO | 21, 23, 26 | formula + value |
| C11 | Formula error diagnosis | „=DIFFERENZ(A3;B6) — untersuche seine Eingabe und korrigiere den Fehler. Gib einen weiteren Lösungsweg an." | 22, 23 | value |

> **C5 is the conceptual centrepiece.** It appears as a practical task *and* as a recurring theory
> question: „Warum sind in der Formel Dollarzeichen ($) eingefügt und was bewirken sie?"

### N — Functions

German names only, `;` separator. Complete whitelist:

| ID | Function | German task sample | Years |
|---|---|---|---|
| N1 | `SUMME` | „Berechne die Gesamteinnahmen mit Hilfe der Summefunktion" | all |
| N2 | `MITTELWERT` | „Berechne den Durchschnitt" | 21, 22, 23, 26 |
| N3 | `MAX` | „Berechne den größten Wert in Zelle C13." | 19, 20, 21, 22, 23, 25, 26 |
| N4 | `MIN` | „Berechne den kleinsten Wert in Zelle C12." | 19, 20, 21, 22, 23, 25, 26 |
| N5 | `ANZAHL` | „Berechne die Anzahl aller Umsätze (ohne die Summe) in B17" | 22, 23 |
| N6 | `WENN` (two branches) | „Wenn die angegebenen Parteien zusammen mehr als die Hälfte der Stimmen erreichen soll in der Zelle »Ja« stehen, sonst »Nein«" | 19, 20, 21, 25, 26 |
| N7 | `WENN` (nested) | „Wenn ein Schüler mehr als 100 Euro eingenommen hat bekommt er noch 10 Euro. Hat er mehr als 200 € eingenommen, so bekommt er 30 €" | 22 |
| N8 | `ZÄHLENWENN` | Statistische Funktion, Übung `9_TK_1_3` | slides |
| N9 | `RUNDEN` | „Runde 12.678,5678 auf zwei Nachkommastellen. **(Nicht formatieren!)**" | tool |
| N10 | `PRODUKT` / `*` | „Produkt rote Felder" | all |
| N11 | Integer vs exact division | „Quotient gelbe Felder (Ganzzahldivision)" *and* „(exakt)" | 22 |

### D — Charts

| ID | Skill | German task sample | Years | Check |
|---|---|---|---|---|
| D1 | Säulendiagramm | „Einfügen → Säulendiagramm (gruppierte Säulen)" | 26, slides | structure |
| D2 | Balkendiagramm | „Erstelle ein Balkendiagramm, in dem die Quartalsumsätze … ersichtlich sind." | 23 | structure |
| D3 | Kreis-/Tortendiagramm | „Erstelle ein beliebiges Kreisdiagramm, das die prozentuale Stimmenverteilung abbildet." | 19, 20, 22, 25, 26 | structure |
| D4 | Liniendiagramm | „Erstelle ein Liniendiagramm, das pro Schüler die erreichte Prozentzahl anzeigt" | 19, 21 | structure |
| D5 | Flächendiagramm | Diagramme-Arbeitsmappe | — | structure |
| D6 | Select the correct source range | „Bereich A2:B14 markieren" | all chart tasks | structure |
| D7 | Chart title | „Diagrammtitel z. B. »Stromverbrauch pro Monat (kWh)«" | 26 | structure |
| D8 | Axis labels | „X = Monat, Y = Verbrauch (kWh)" | 26 | structure |
| D9 | Data labels in percent | „Datenbeschriftungen (Prozentwerte)" | 26 | structure |
| D10 | Rebuild a given chart | „Baue das Kreisdiagramm in Blatt »Diagramm« nach." | tool | structure |
| D11 | Multi-series chart | „Liniendiagramm, das die Verteilung von Temperatur und Niederschlag darstellt" | 21 | structure |

---

## 4. Exam archetypes

Nine scenarios recur across the papers. Each should become a guided level.

1. **Felder berechnen** — 2019, 2020, 2022, 2023, 2025, 2026. A colour-coded grid of numbers:
   sum the green fields, sum the violet, multiply the red, divide the yellow („größere Zahl
   zuerst"). Present in six of seven years — the single most repeated task in the corpus.
2. **Taschengeld / Bilanz** — 2021, 2023, 2026. Einnahmen/Ausgaben, totals, average, Saldo.
3. **Wahlen / SMV-Wahl** — 2019, 2020, 2025, 2026. Votes, `SUMME`/`MIN`/`MAX`, percent share,
   party colours, 5 % hurdle via conditional formatting, coalition `WENN`, pie chart.
4. **Klima / Wetter** — 2021, 2022. Temperature and precipitation, aggregates, threshold fills,
   chart.
5. **Umsätze und Bonus** — 2022, 2023. Sales per employee, `ANZAHL`/`SUMME`/`MAX`/`MIN`/
   `MITTELWERT`, bonus `WENN`, conditional formatting.
6. **Stromverbrauch** — 2026. Absolute references (`$G$2` price per kWh, `$G$3` CO₂ factor),
   aggregate block, currency format, column chart.
7. **Vermögen** — 2025. Per-person and per-category totals, percent share, sort, merge.
8. **Corona** — 2020. Derived rates, aggregates, percent format, pie chart.
9. **Probequali-Punkte** — 2019. Exam scores, totals, percent, line chart.

---

## 5. Checking model

Three tiers, mirroring the labels the existing `.xlsm` already uses (`FALSE` / `Offen` /
`Manuell`):

| Tier | What is inspected |
|---|---|
| **value** | Computed cell value vs expected, with tolerance for floats. |
| **formula** | The cell must *contain a formula*, must use the *required function*, and must carry an *absolute reference* where the task demands one. |
| **style / structure** | Fill, font, alignment, number-format code, merged range, wrap, border, sheet name, row order, column width, conditional-format rule, chart type / source range / title. |

### Anti-cheat rules

A value check alone is not enough — every paper carries the standing instruction *„Alle
Berechnungen sind mit Formeln durchzuführen!"*, so a correct number typed by hand is a wrong
answer. The checker must:

1. **Reject hardcoded literals** wherever a formula is required.
2. **Reject formatting where rounding was asked.** 2026 spells this out: „Runde … auf zwei
   Nachkommastellen. (Nicht formatieren!)" — `RUNDEN` and a number format are different answers.
3. **Check the whole filled range, not just the first cell.** A fill-down task is only solved if
   every cell in the range carries the correctly adapted formula.
4. **Reject a fixed reference where it must move**, and a moving one where `$` is required.
5. **Randomise the sample data per student.** The `.xlsm` already reserves a `Beispieldaten`
   column for exactly this.

---

## 6. Status

Catalogue complete. No application code written yet.

---

## Running it

```bash
npm install
npm run dev --workspace @quali/web     # → http://localhost:5173
```

Other tasks:

```bash
npm test                               # 43 core tests
npm run typecheck                      # all packages
npm run drive --workspace @quali/web           # walk the tasks in Chromium, writes screenshots
npm run drive:gestures --workspace @quali/web  # drag-to-fill, copy/paste, click-to-reference
npm run drive:switching --workspace @quali/web # work survives switching scenarios
npm run drive:formatting --workspace @quali/web# the ribbon against the 2025 Vermögen sheet
npm run drive:charts --workspace @quali/web     # inserting charts, against the 2026 pie task
npm run drive:klima --workspace @quali/web      # rename, conditional formatting, row-wise chart
```

`npm run drive` expects the dev server to already be running. Set `SHOT_DIR` to choose where
screenshots land, and `CHROMIUM_PATH` if your sandbox ships a browser build Playwright did not
download itself.

## Backend (optional)

The trainer runs standalone with no backend — that is the default and needs no setup. Connecting
Supabase adds sign-in, attempt logging and server-side scoring.

```bash
supabase link --project-ref <ref>
supabase db push                       # applies supabase/migrations
supabase functions deploy check-task   # scoring runs here, not in the browser
```

Then point the app at the project:

```bash
# apps/web/.env.local
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

Students sign in with a nickname and a password you create; there are no self-signups and no
email is ever sent. Create one from the Supabase dashboard (Auth → Add user) using
`<nickname>@pupils.invalid` as the address, then insert the matching `students` row.

**Keep real names out of the database.** The nickname → pupil mapping belongs on paper with you.
