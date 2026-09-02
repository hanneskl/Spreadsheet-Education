# Architecture

How the Quali Excel trainer is built and why. The *what* — the skills and tasks to teach — lives
in [README.md](README.md); this document covers the *how*.

---

## 1. The central principle

**The checker is the product. The grid is a view over the model.**

Every paper carries the instruction *„Alle Berechnungen sind mit Formeln durchzuführen!"*, so a
correct number typed by hand is a wrong answer. That means the workbook model must record what
the student *typed*, not only what it evaluated to:

```ts
interface Cell {
  input: string      // "=SUMME(C4;E4)"  ← the load-bearing field
  value: CellValue   // 165
  style: CellStyle
}
```

Value checks read `value`. Formula checks read `input`. Every anti-cheat rule in the README
becomes a one-line predicate over `input`, and the feedback message writes itself:

> „Du hast 844 eingetippt. Nutze eine Formel mit `*`."

This is why we do not embed Univer, Handsontable or a similar component. They are built to *be*
spreadsheets, not to be *inspected*. Owning the model is the whole point.

## 2. We write our own formula evaluator

HyperFormula's German language pack maps exactly onto our whitelist — `SUMME`, `MITTELWERT`,
`MAX`, `MIN`, `ANZAHL`, `WENN`, `ZÄHLENWENN`, `RUNDEN`, `PRODUKT`, all nine. We still write our
own, for two reasons:

1. **Licensing.** HyperFormula is GPLv3; this repo is MIT. Linking it would force the shipped
   bundle to GPLv3.
2. **The whitelist is a feature.** The exam is German-only, so `SUM` must be *rejected*.
   HyperFormula ships 400 functions and we would be fighting to switch 390 off. For us, refusing
   an unknown name is the desired behaviour, not a limitation.

The scope is small and closed: a Pratt parser, nine functions, range resolution, and
relative/absolute reference translation for fill-down.

> HyperFormula stays as a **dev dependency** for differential testing. GPL does not reach
> test-only code that is never distributed.

### German formula syntax

German Excel is not merely translated function names:

| | German | English |
|---|---|---|
| Argument separator | `;` | `,` |
| Decimal separator | `,` | `.` |
| Example | `=RUNDEN(A1;12,5)` | `=ROUND(A1,12.5)` |

There is no ambiguity — `,` is never an argument separator in German mode. The tokenizer must
handle both, and the UI must render numbers in German format.

## 3. The answer key is a formula

Do not store expected values. Store the **solution as a formula** and evaluate it with the same
engine against the seeded data:

```yaml
id: felder-2025-rot
prompt_de: "Produkt rote Felder:"
target: F16
solution: "=C6*E6"          # not: expected: 844
checks:
  - is_formula
  - uses_operator: "*"
  - matches_solution
points: 1
```

Three consequences, all free:

- **Randomised `Beispieldaten` per student** — seed the generator on the student ID. The
  existing `.xlsm` self-learning tool already reserves a column for exactly this.
- **No hand-maintained numbers** to drift out of sync with the data.
- **No float-comparison mismatches**, because both sides ran through the same evaluator.

## 4. Checks are composable predicates

```ts
type Check = (wb: Workbook, ctx: TaskContext) => CheckResult
```

Each predicate is pure, independently testable, and returns a German message on failure. The
three tiers from the README map onto predicate families:

| Tier | Predicates |
|---|---|
| value | `valueEquals`, `matchesSolution` |
| formula | `isFormula`, `usesFunction`, `usesOperator`, `hasAbsoluteRef`, `formulaPatternAcrossRange` |
| style / structure | `styleEquals`, `numberFormatMatches`, `cfRuleMatches`, `isMerged`, `sheetNamed`, `rowOrderIs`, `chartMatches` |

`formulaPatternAcrossRange` is the one that catches a student who filled the first cell correctly
and then typed the rest: it verifies **every** cell in the range carries the correctly translated
formula, not just the first.

## 5. Supabase

Supabase gives us Postgres, Auth, RLS and Edge Functions. Two constraints shape the design.

### Students must not be able to write their own score

The client cannot be trusted with `passed` or `points`. So:

```
Browser ──POST workbook state──▶ Edge Function `check-task`
                                      │ runs @core checker (service role)
                                      ▼
                                 attempts table
```

RLS denies all direct client writes to `attempts`. The client may only *read* its own rows. The
Edge Function, holding the service role key, is the sole writer.

The browser still runs the identical checker locally for instant feedback — that duplication is
free because it is the same package. The server run is authoritative.

### Nickname auth on an email-shaped system

Supabase Auth is email/password. Students get teacher-created nicknames, not email addresses, so
we synthesise a local address (`<nickname>@pupils.invalid`) and never send mail. No self-signup;
the teacher provisions accounts.

- Passwords are hashed by Supabase Auth (bcrypt) — we never store or log them.
- **No real names in the database.** The nickname → pupil mapping stays on paper with the
  teacher. Pseudonymous data is still personal data under GDPR, but keeping identifiers out of
  the system reduces this to something a school can approve easily.

### Schema sketch

```sql
classes  (id, name, teacher_id)
students (id, nickname unique, class_id, seed)          -- seed drives data randomisation
attempts (id, student_id, task_id, input, passed, points, created_at)
```

`attempts` is append-only: every submission is logged, not just the passing one. The raw `input`
is what makes the teacher dashboard worth having.

### Teacher dashboard

A per-class matrix of **student × skill ID** (`S1`, `F10`, `N6` …) showing which skill is
failing, derived by joining `attempts` to the task catalogue. This is the payoff for giving every
skill a stable ID in the README.

## 6. Package layout

```
packages/core/      model, evaluator, checker — zero dependencies, Node + Deno + browser
packages/scenarios/ the nine exam archetypes as data
apps/web/           React grid, ribbon, task sidebar
supabase/           migrations, RLS policies, edge functions
```

`packages/core` having **no dependencies and no platform APIs** is a hard rule — it is what lets
the same checker run in the browser and in a Deno Edge Function.

For the same reason, imports inside `packages/` carry **`.ts` extensions**, not `.js`. Deno
resolves specifiers literally, so `./values.js` would send it looking for a file that does not
exist; TypeScript's `allowImportingTsExtensions` and Vite both handle `.ts` fine.

### Re-seeding is a security boundary, not a convenience

`gradeSubmission` rebuilds the sheet from a fresh `scenario.seed()` and applies only inputs for
cells the seed left empty. Without that, a crafted request could rewrite the source numbers —
and because the answer key is a formula evaluated against the same data, the key would move with
them and any wrong answer would grade as correct.

### Sorting is carried as an operation, not as data

Re-seeding creates a problem for „Sortiere die Werte B4 - H8 nach Namen": the cells that have to
move are exactly the ones the server refuses to take from the client. So a submission carries a
**sort log** — „range B4:H8, key column 1, ascending" — which the server replays onto the freshly
seeded sheet. The rows can then only ever be permuted, never rewritten, and a request claiming an
already-sorted table changes nothing.

The replay happens *before* the student's own inputs are placed, because the addresses a
submission records are already post-sort. The consequence is a constraint on scenarios: **a sort
task must never sort by a column the student computes.** Every sort task in the seven-year corpus
sorts seeded data (names, Infizierte, Umsätze), so this costs us nothing today.

Sorting whole rows is also where the checker earns its keep. The UI lets a student select one
column and sort it alone — the mistake the self-learning tool baits with „Sortiere **NUR** die
Namen alphabetisch" — because forbidding it would remove the thing being taught. `sortedBy`
compares the student's rows against the pristine seed and says which row no longer belongs
together.

## 7. Build order

1. ~~**Model + evaluator + checker, headless.**~~ Done. Tested against the `Lösung` files: it
   accepts every real exam formula and rejects the typed-value variant of each.
2. ~~**Scenarios end-to-end**~~ Done — grid, formula bar, task sidebar, drag-to-fill,
   copy/paste and point mode.
3. ~~**Supabase auth + attempt logging + the `check-task` edge function.**~~ Written. The
   grading path is covered by tests; the deployed function and the SQL have not been run
   against a live project yet.
4. ~~**Formatting ribbon + style checks.**~~ Done.
5. The remaining eight scenarios.
6. ~~**Charts.**~~ Column, bar, pie, line and area, drawn as dependency-free inline SVG in
   Excel's own accent colours so a student recognises what the exam will produce. The palette
   does not pass the usual lightness/chroma bands — Excel's grey slot reads grey and its
   yellow is pale — but CVD separation does pass, and the relief the contrast check demands is
   direct labels, which the 2026 paper asks for anyway.
7. Teacher dashboard.
8. Exam mode — a timer and a results screen over the existing checker.

## 8. Testing

The seven years of exams *are* the test suite. For every task in the corpus:

- the real solution formula must **pass** every check, and
- the same value typed as a literal must **fail** `is_formula`.

Target devices are school PCs with keyboard and mouse, so the grid can assume arrow-key
navigation, `F2` to edit, type-over-selection and drag-to-fill.
