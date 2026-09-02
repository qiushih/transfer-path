# UWaterloo Transfer & Major Planner

Answers one question for a University of Waterloo student: **what am I missing before I can apply
to transfer or declare my target major, and what is the earliest path to becoming eligible?**

Scope is deliberately narrow. This models the conditions for *applying or declaring only*. What a
student must do after being admitted - upper-year courses, elective bands, total degree units,
co-op and PD - is **not** modelled, because those requirements never block an application and
listing them buries the handful of things that do.

Source: <https://github.com/qiushih/transfer-path> - if it is useful, a star helps other Waterloo
students find it.

> **Unofficial - for quick reference only.** Please consult your academic advisor before trusting
> this information. Requirements change, and some conditions cannot be checked automatically.

## Quick start

```bash
npm install
```

```bash
npm run dev
```

To refresh the course catalog, register for a key at <https://openapi.data.uwaterloo.ca> and sync:

**A key is mandatory.** Every v3 endpoint sits behind the global `apiKey` security scheme - an
anonymous request returns `401` with "There does not appear to be an X-API-KEY header", and an
invalid key returns `401` too. There is no anonymous or rate-limited public tier.

```bash
UW_API_KEY=your-key npm run sync
```

## How the data is split

The UW Open Data API v3 provides the course catalog, class schedules, subjects, and terms. It does
**not** publish degree requirements, transfer rules, GPA cutoffs, or academic standing. So the
data arrives from several places:

| Layer | Source | Lives in |
| --- | --- | --- |
| Course catalog, prerequisite text, term availability | Synced from the API | `src/data/catalog.json` |
| Course equivalences | Derived from synced antirequisites | `src/domain/equivalence.ts` |
| Transfer and declaration rules | Hand-curated from faculty pages and the calendar | `src/data/rules/` |
| Which rules apply to which faculty and program | Hand-curated | `src/data/faculties.ts` |

**Reaching a major is often two steps, and showing only one is wrong.** A Science student who
wants Computer Science must be admitted to the Faculty of Mathematics *and* then meet the CS
major's declaration requirements, which are stricter than the faculty transfer alone. A faculty
carries a `transferRule`; each program under it carries an optional `declarationRule`; and
`rulesFor()` returns whichever apply, in the order a student clears them.

### Faculty transfer rules

| Faculty | Source |
| --- | --- |
| Mathematics | `uwaterloo.ca/math/internal-transfer` |
| Engineering | `uwaterloo.ca/engineering/undergraduate-students/policies-regulations/transfers` |
| Science | `uwaterloo.ca/science-undergraduate-office/modifying-your-program/transferring-science` |
| Arts | `uwaterloo.ca/arts/undergraduate/faculty-transfer-arts` |
| Environment | `uwaterloo.ca/environment/undergraduate/current-students/transfers` |

Two faculties break the pattern. **Arts** states three averages that are not interchangeable - a
qualifying-term average, an average over every Arts course ever taken, and an overall cumulative
average - so a student can clear the overall bar and still fail the Arts-only one. **Environment**
publishes no faculty-wide criteria at all: its page routes students to one of four schools, so its
rule deliberately checks nothing and says so, rather than inventing a plausible cutoff that would
leave a student thinking they were on track.

Engineering is unlike the others in a way that matters more than any of its numbers: **an
accepted transfer restarts in 1A**, and 1A runs only in September. That is modelled as a condition
a student has to acknowledge, not a footnote, because it makes an Engineering transfer
incomparable with a Math or Science one.

### Program declaration rules

Eleven Faculty of Mathematics programs, each transcribed from its own calendar page:

Computer Science · Data Science · Actuarial Science · Combinatorics and Optimization · Statistics ·
Applied Mathematics · Pure Mathematics · Computational Mathematics · Mathematical Economics ·
Financial Analysis and Risk Management · Computing and Financial Management

Plus **Software Engineering** under Engineering, and **Environment, Resources and Sustainability**
under Environment - the one Environment school publishing a concrete bar (70% overall).

**Most Math majors have no declaration requirements at all.** CO, Statistics, Pure Mathematics,
Applied Mathematics and Computational Mathematics state only minimum averages, and several calendar
pages carry no "Declaration Requirements" section whatsoever. Only the limited-enrolment plans -
Computer Science, Data Science, Actuarial Science, FARM - gate on anything more. Those rules look
sparse because the requirements are sparse, and their notes say so rather than padding the list.

Two programs admit directly rather than through their faculty, so requiring the faculty transfer
first would invent a step that does not exist: **CFM** accepts applications from any Waterloo
program, and **Software Engineering** takes 1B/2A/2B entry straight to the SE Director, which is
also how it avoids Engineering's 1A restart.

Every curated file records the URL it was transcribed from and the date it was retrieved, so a
stale rule can be re-checked.

Two caveats worth knowing about the API:

- It has no course **units** field, so entries default to 0.5 units and can be overridden per
  attempt.
- It has no "offered in term" field, so seasonal availability is *derived* by sampling which terms
  a course actually appeared in.

`catalog.json` is imported by a client component, so **every field in it ships to the browser**.
The sync therefore drops course descriptions, which nothing renders and which accounted for 3.6MB
of a 4.9MB file; the catalog is 1.3MB raw and about 165KB gzipped. If descriptions are ever needed
in the UI, serve them from a separate lazily-fetched file rather than widening this one.

## Course availability

Every recommended course - in the term-by-term plan and in the "choose yourself" shortlists -
carries a **check sections** link into Waterloo's Schedule of Classes, filtered to that course in
the term the plan puts it in.

The catalog sync only records which *seasons* a course has historically run in. That is enough to
order a plan but says nothing about whether a section exists next term or still has seats, which
is what the schedule shows.

The site's search is a POST form, but its CGI also accepts GET, so this is a plain link: no
server, no API key, no scraping, and the app stays static. Verified 2026-08-22.

The schedule publishes a **rolling window** of roughly two terms ahead. A term beyond it returns
"your query had no matches", which reads as *"this course is not offered"* when it really means
*"the timetable is not out yet"* - so links past that window are labelled **sections (not posted
yet)** instead.

## Privacy

There are no accounts and no server-side storage. A transcript is a student record, so the profile
is held in `localStorage` and never leaves the browser. "Clear my data" removes it.

## Architecture

The domain layer under `src/domain/` is plain TypeScript with no React or network dependencies,
which is what makes it testable:

- `types.ts` - profile, grades, terms, and the tri-state `Evaluation`
- `grades.ts` - averages, failure rules, and the `CourseFilter` selector
- `eligibility.ts` - the transfer and declaration rule engine
- `gaps.ts` - what still blocks an application, and the courses that would close it
- `prereqs.ts` - parser for UW's free-text prerequisite strings
- `planner.ts` - term-by-term ordering of the courses needed to become eligible
- `transcript.ts` - parses a Quest transcript into course attempts
- `equivalence.ts` - which courses may stand in for which, and on what evidence
- `terms.ts` - term codes, seasons, and the calendar-year list
- `schedule.ts` - deep links into the Schedule of Classes

Three design decisions carry most of the weight:

**Missing input is not failure.** Every check returns `met`, `unmet`, or `unknown`. A student who
has not entered their academic standing sees "needs input", never "ineligible". Rules that a
transcript cannot verify - "not enrolled in a 2+2 plan" - are modelled explicitly as
`manualCheck` and always report `unknown`, so a clean profile reads as "no blockers found" rather
than a guarantee.

**Substitution has four levels, and only three of them can satisfy a requirement.** They are
ranked by what the evidence actually proves:

| Basis | Evidence | Can satisfy? |
| --- | --- | --- |
| `exact` | The student took the course the requirement names | Yes |
| `alternative` | The requirement itself lists the course as acceptable | Yes |
| `verified` | A curated entry citing an official source or an advisor | Yes |
| `overlap` | UW lists the two as mutual antirequisites | **No** |

The last line is the important one. An antirequisite says "you may not hold credit for both",
which is a statement about **duplicate credit, not about program-level substitution**. MATH 118
and MATH 138 are mutual antirequisites, but a program naming MATH 138 is naming the Honours-stream
course, and only the department can say whether MATH 118 is accepted for it. So overlap is
surfaced as *"possible substitute - needs verification"* against the still-unmet requirement,
never as a pass.

Overlap is derived only from *mutual* edges (one-way edges outnumber them roughly two to one and
are mostly missing data on the other side) and is deliberately **not** transitive, since chaining
through shared antirequisites would merge whole families of loosely related courses.

`CURATED_EQUIVALENCES` is the only way to promote a pair to `verified`. Entries are directional
unless marked `symmetric`, must carry a citation, and may be scoped by program, requirement, and
calendar year - a swap a department allows for one program is not evidence about another. Scoped
entries **fail closed**: if the check cannot say which program it is looking at, the scoped
substitution does not apply.

**The plan includes prerequisites, which is what makes it a path rather than a list.** CS 136 is a
declaration requirement; CS 135 is not, but a student with neither cannot reach CS 136 without it,
so CS 135 is pulled into the plan and scheduled first. Only *missing* prerequisites are added, and
a "one of" prerequisite costs one course rather than all of them - flattening the alternatives
told students to take four intro CS courses where one would do.

**The tool commits to a course only when the rule names one.** A requirement like "3 math courses"
matches hundreds of catalog entries, and picking three would dress an arbitrary choice up as
advice; those are shown as a ranked shortlist to confirm with an advisor. Where a rule does name
courses, the plan picks one and lists the alternatives rather than hiding the choice - the data
has no reliable way to rank CS 115 against CS 135 against CS 145.

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
synced courses and asserts it never invents a subject code - a case-insensitive pattern once made
"Level at least 2A" parse as a course in a subject called "LEAST", which hand-written fixtures
could not reveal.

## Tests

```bash
npm test
```

## Transcript import

Paste the course table from a Quest transcript, or open a PDF of it, and the parser fills in
courses, grades, units, and terms.

**The transcript never leaves the browser.** PDF text extraction runs client-side via pdf.js,
which is dynamically imported so its ~0.43MB stays out of the initial bundle for the majority of
visitors who paste text instead. A transcript is among the most sensitive documents a student
holds, and the rest of this app already keeps the profile local, so extraction had to stay local
too.

Two deliberate choices in the parser:

- **Nothing is imported without confirmation.** Every parsed row is shown in a preview table with
  its grade, and only rows that parsed cleanly are pre-ticked. A row with any issue - no term
  heading above it, a missing units column, an out-of-range percentage - is shown but left
  unticked. A silently mis-read grade is worse than one the student is asked about.
- **Re-importing updates rather than duplicates.** Attempts are keyed by course *and* term, so
  importing an updated transcript refreshes existing rows and still keeps a genuine repeat of the
  same course in a different term.

Scanned or photographed transcripts have no text layer and would need OCR, which is not
implemented. That case is detected and reported explicitly rather than failing as an empty parse.

## Deliberately out of scope

Graduation requirements. Upper-year courses, elective bands, total degree units, co-op and PD
apply only *after* admission and never block an application, so they are not modelled.

## Not yet built

- OCR for transcripts that are photos or flatbed scans rather than text PDFs
- The remaining Faculty of Mathematics programs: Mathematical Physics, Mathematical Studies,
  Mathematical Optimization, Mathematical Finance, Mathematics/Business Administration,
  Mathematics/CPA, and Mathematics and Teaching
- Program-level rules for Engineering plans other than Software Engineering, and for any Science
  program - both faculties currently offer the faculty transfer only
- Transfer rules for Health
- The other three Environment schools - Geography and Environmental Management, Planning, and
  Environment, Enterprise and Development - which publish requirements on their own pages
- Arts major-level bars (70% major average for Honours, 65% for general)
- Checking enrolment restrictions ("Honours Math students only") against the student's current
  program, which would turn most "check yourself" notes into real answers
