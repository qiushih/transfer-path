# UW Internal Transfer Planner

Checks whether a University of Waterloo student meets the requirements to transfer between
programs, shows how completed courses would carry over to the target degree, and plans the
courses still outstanding.

Unofficial. Always confirm results with an academic advisor.

## Quick start

```bash
npm install
```

```bash
npm run dev
```

The app runs with a seven-course placeholder catalog. To use real UW course data, register for a
key at <https://openapi.data.uwaterloo.ca> and sync:

**A key is mandatory.** Every v3 endpoint sits behind the global `apiKey` security scheme — an
anonymous request returns `401` with "There does not appear to be an X-API-KEY header", and an
invalid key returns `401` too. There is no anonymous or rate-limited public tier.

```bash
UW_API_KEY=your-key npm run sync
```

## How the data is split

The UW Open Data API v3 provides the course catalog, class schedules, subjects, and terms. It does
**not** publish degree requirements, transfer rules, GPA cutoffs, or academic standing. So the
project has two data layers:

| Layer | Source | Lives in |
| --- | --- | --- |
| Course catalog, prerequisite text, term availability | Synced from the API | `src/data/catalog.json` |
| Course equivalences | Derived from synced antirequisites | `src/domain/equivalence.ts` |
| Transfer eligibility rules | Hand-curated from faculty pages | `src/data/rules/` |
| Degree requirements | Hand-curated from the undergraduate calendar | `src/data/programs/` |
| Which rules pair with which programs | Hand-curated | `src/data/targets.ts` |

Transfer targets currently covered: **Faculty of Mathematics**, **Faculty of Science**, and
**Computing and Financial Management**. Adding one means writing a rule file and registering it in
`targets.ts`; a target with no transcribed degree requirements still offers eligibility checking.

Every curated file records the URL it was transcribed from and the date it was retrieved, so a
stale rule can be re-checked. Degree programs additionally carry `verified: boolean`; the UI shows
a warning banner until a human has confirmed the requirements against the calendar.

Two caveats worth knowing about the API:

- It has no course **units** field, so entries default to 0.5 units and can be overridden per
  attempt.
- It has no "offered in term" field, so seasonal availability is *derived* by sampling which terms
  a course actually appeared in.

`catalog.json` is imported by a client component, so **every field in it ships to the browser**.
The sync therefore drops course descriptions, which nothing renders and which accounted for 3.6MB
of a 4.9MB file; the catalog is 1.3MB raw and about 165KB gzipped. If descriptions are ever needed
in the UI, serve them from a separate lazily-fetched file rather than widening this one.

## Privacy

There are no accounts and no server-side storage. A transcript is a student record, so the profile
is held in `localStorage` and never leaves the browser. "Clear my data" removes it.

## Architecture

The domain layer under `src/domain/` is plain TypeScript with no React or network dependencies,
which is what makes it testable:

- `types.ts` — profile, grades, terms, and the tri-state `Evaluation`
- `grades.ts` — averages, failure rules, and the `CourseFilter` selector
- `eligibility.ts` — the transfer rule engine
- `requirements.ts` / `audit.ts` — degree requirements and the audit
- `prereqs.ts` — parser for UW's free-text prerequisite strings
- `planner.ts` — candidate courses and term-by-term scheduling

Three design decisions carry most of the weight:

**Missing input is not failure.** Every check returns `met`, `unmet`, or `unknown`. A student who
has not entered their academic standing sees "needs input", never "ineligible". Rules that a
transcript cannot verify — "not enrolled in a 2+2 plan" — are modelled explicitly as
`manualCheck` and always report `unknown`, so a clean profile reads as "no blockers found" rather
than a guarantee.

**Course equivalence is inferred from mutual antirequisites.** UW publishes no equivalence table,
but it publishes antirequisites, and a *mutual* one is strong evidence two courses cover the same
ground: MATH 138 lists MATH 118 as an antirequisite and MATH 118 lists MATH 138, so MATH 118
satisfies a MATH 138 requirement. Only mutual edges count — one-way edges outnumber them roughly
two to one and are mostly missing data on the other side. Equivalence is deliberately **not**
transitive, since chaining through shared antirequisites would merge whole families of loosely
related courses. `CURATED_EQUIVALENCES` is the escape hatch for pairs the data misses, and the
audit reports a substitution as its own credit category rather than passing it off as an exact
match.

**Course-to-requirement assignment is a matching problem, not a greedy loop.** If a generic
"one MATH elective" requirement consumes MATH 137, a specific "MATH 137" requirement is left
falsely unmet. `audit.ts` expands requirements into slots and runs maximum bipartite matching,
which cannot make that mistake. This is covered by a regression test.

**Unparseable prerequisites are surfaced, not dropped.** UW prerequisites are prose. The parser
handles boolean structure, the "MATH 137 or 147" subject-elision idiom, and grade gates in both
positions ("MATH 137 with a grade of at least 60%", "at least 90% in CS 115"). A clause it cannot
interpret, like "Honours Mathematics students only", becomes an `opaque` node that propagates to
`needs-review` and is shown to the student, because silently discarding a condition would make a
course look available when it is not.

Grade gates are load-bearing, not decoration: `MATH 138` accepts `MATH 137` only at 60% or above,
so the same completed course can qualify one student and not another.

Roughly 36% of catalog requirement strings parse with no opaque clause; the other 64% carry at
least one enrolment restriction. `catalog.regression.test.ts` runs the parser over all 8,600+
synced courses and asserts it never invents a subject code — a case-insensitive pattern once made
"Level at least 2A" parse as a course in a subject called "LEAST", which hand-written fixtures
could not reveal.

## Tests

```bash
npm test
```

## Not yet built

- Transcript scanning (`transcript scan` in the original spec) — manual entry only for now
- Real degree requirements; `src/data/programs/math-cs.ts` is an unverified template, and Science
  and CFM have no transcribed programs at all
- Transfer rules for Engineering, Arts, Environment, and Health
- Checking enrolment restrictions ("Honours Math students only") against the student's current
  program, which would turn most "check yourself" notes into real answers
