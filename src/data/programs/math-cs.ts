import type { DegreeProgram, Requirement } from "@/domain/requirements";

/**
 * Computer Science (Bachelor of Computer Science - Honours), transcribed from
 * the official Undergraduate Studies Academic Calendar.
 *
 * Two calendar pages are involved and both are cited below:
 *
 * - the major page, which lists the required courses and the elective
 *   requirement, and
 * - the degree-level page, which carries the 20.0-unit total, the failure
 *   limits, and the Undergraduate Communication Requirement lists.
 *
 * CALENDAR YEAR: this is the **2026-2027** calendar. The site states: "You are
 * reading the 2026-2027 Undergraduate Studies Academic Calendar. The 2025-2026
 * version remains in effect until August 31, 2026." Transcribed 2026-08-22, so
 * for nine more days the governing calendar for continuing students is
 * 2025-2026. A student on the older calendar should not rely on this audit.
 *
 * Only requirements stated outright on those pages appear here. Several real
 * rules are deliberately absent because the engine cannot express them; they
 * are listed under UNMODELLED below rather than approximated, since a
 * plausible guess would read as fact in the audit.
 */

const CS_CORE: Requirement[] = [
  {
    kind: "course",
    id: "cs-136l",
    label: "CS 136L Tools and Techniques for Software Development",
    anyOf: [{ subject: "CS", catalogNumber: "136L" }],
  },
  {
    kind: "course",
    id: "cs-341",
    label: "CS 341 Algorithms",
    anyOf: [{ subject: "CS", catalogNumber: "341" }],
  },
  {
    kind: "course",
    id: "cs-350",
    label: "CS 350 Operating Systems",
    anyOf: [{ subject: "CS", catalogNumber: "350" }],
  },
  {
    kind: "course",
    id: "cs-first",
    label: "CS 115, CS 135, or CS 145",
    anyOf: [
      { subject: "CS", catalogNumber: "115" },
      { subject: "CS", catalogNumber: "135" },
      { subject: "CS", catalogNumber: "145" },
    ],
  },
  {
    kind: "course",
    id: "cs-136",
    label: "CS 136 or CS 146",
    anyOf: [
      { subject: "CS", catalogNumber: "136" },
      { subject: "CS", catalogNumber: "146" },
    ],
  },
  {
    kind: "course",
    id: "cs-240",
    label: "CS 240 or CS 240E",
    anyOf: [
      { subject: "CS", catalogNumber: "240" },
      { subject: "CS", catalogNumber: "240E" },
    ],
  },
  {
    kind: "course",
    id: "cs-241",
    label: "CS 241 or CS 241E",
    anyOf: [
      { subject: "CS", catalogNumber: "241" },
      { subject: "CS", catalogNumber: "241E" },
    ],
  },
  {
    kind: "course",
    id: "cs-245",
    label: "CS 245 or CS 245E",
    anyOf: [
      { subject: "CS", catalogNumber: "245" },
      { subject: "CS", catalogNumber: "245E" },
    ],
  },
  {
    kind: "course",
    id: "cs-246",
    label: "CS 246 or CS 246E",
    anyOf: [
      { subject: "CS", catalogNumber: "246" },
      { subject: "CS", catalogNumber: "246E" },
    ],
  },
  {
    kind: "course",
    id: "cs-251",
    label: "CS 251 or CS 251E",
    anyOf: [
      { subject: "CS", catalogNumber: "251" },
      { subject: "CS", catalogNumber: "251E" },
    ],
  },
];

const MATH_CORE: Requirement[] = [
  {
    kind: "course",
    id: "math-calc1",
    label: "MATH 127, MATH 137, or MATH 147",
    anyOf: [
      { subject: "MATH", catalogNumber: "127" },
      { subject: "MATH", catalogNumber: "137" },
      { subject: "MATH", catalogNumber: "147" },
    ],
  },
  {
    kind: "course",
    id: "math-calc2",
    label: "MATH 128, MATH 138, or MATH 148",
    anyOf: [
      { subject: "MATH", catalogNumber: "128" },
      { subject: "MATH", catalogNumber: "138" },
      { subject: "MATH", catalogNumber: "148" },
    ],
  },
  {
    kind: "course",
    id: "math-algebra",
    label: "MATH 135 or MATH 145",
    anyOf: [
      { subject: "MATH", catalogNumber: "135" },
      { subject: "MATH", catalogNumber: "145" },
    ],
  },
  {
    kind: "course",
    id: "math-linalg",
    label: "MATH 136 or MATH 146",
    anyOf: [
      { subject: "MATH", catalogNumber: "136" },
      { subject: "MATH", catalogNumber: "146" },
    ],
  },
  {
    kind: "course",
    id: "math-combinatorics",
    label: "MATH 239 or MATH 249",
    anyOf: [
      { subject: "MATH", catalogNumber: "239" },
      { subject: "MATH", catalogNumber: "249" },
    ],
  },
  {
    kind: "course",
    id: "stat-probability",
    label: "STAT 230 or STAT 240",
    anyOf: [
      { subject: "STAT", catalogNumber: "230" },
      { subject: "STAT", catalogNumber: "240" },
    ],
  },
  {
    kind: "course",
    id: "stat-statistics",
    label: "STAT 231 or STAT 241",
    anyOf: [
      { subject: "STAT", catalogNumber: "231" },
      { subject: "STAT", catalogNumber: "241" },
    ],
  },
];

/**
 * "Complete 3 additional CS courses chosen from CS340-CS398, CS440-CS489" and
 * "Complete 2 additional CS courses chosen from CS440-CS489".
 *
 * The 340-398 band is expressed as two filters because `CourseFilter` takes a
 * single contiguous level range, and 399 is outside the stated band.
 */
const CS_UPPER: Requirement[] = [
  {
    kind: "group",
    id: "cs-upper-3",
    label: "3 additional CS courses from CS 340-398 or CS 440-489",
    of: [
      {
        kind: "courses",
        id: "cs-upper-3-courses",
        label: "3 CS courses from CS 340-398 or CS 440-489",
        count: 3,
        filter: { subjects: ["CS"], minLevel: 340, maxLevel: 490, exclude: [{ subject: "CS", catalogNumber: "399" }] },
      },
    ],
  },
  {
    kind: "courses",
    id: "cs-upper-2",
    label: "2 additional CS courses from CS 440-489",
    count: 2,
    filter: { subjects: ["CS"], minLevel: 440, maxLevel: 490 },
  },
];

/**
 * Undergraduate Communication Requirement, from the degree-level page: "two
 * communications courses" as either two List 1 courses, or one from each list.
 *
 * Modelled as two slots because the engine cannot express "the second may come
 * from either list": the first is restricted to List 1, and the second accepts
 * the union of both lists, which is exactly what either stated option allows.
 */
const COMM_LIST_1 = [
  { subject: "COMMST", catalogNumber: "100" },
  { subject: "COMMST", catalogNumber: "223" },
  { subject: "EMLS", catalogNumber: "101" },
  { subject: "EMLS", catalogNumber: "102" },
  { subject: "EMLS", catalogNumber: "129" },
  { subject: "ENGL", catalogNumber: "109" },
  { subject: "ENGL", catalogNumber: "129" },
];

const COMM_LIST_2 = [
  { subject: "COMMST", catalogNumber: "225" },
  { subject: "COMMST", catalogNumber: "227" },
  { subject: "COMMST", catalogNumber: "228" },
  { subject: "EMLS", catalogNumber: "103" },
  { subject: "EMLS", catalogNumber: "104" },
  { subject: "EMLS", catalogNumber: "110" },
  { subject: "ENGL", catalogNumber: "101B" },
  { subject: "ENGL", catalogNumber: "108B" },
  { subject: "ENGL", catalogNumber: "108D" },
  { subject: "ENGL", catalogNumber: "119" },
  { subject: "ENGL", catalogNumber: "208B" },
  { subject: "ENGL", catalogNumber: "209" },
  { subject: "ENGL", catalogNumber: "210E" },
  { subject: "ENGL", catalogNumber: "210F" },
  { subject: "ENGL", catalogNumber: "378" },
];

const COMMUNICATION: Requirement[] = [
  {
    kind: "courses",
    id: "comm-list1",
    label: "Communication List 1 course (minimum 60%, before the 2A term)",
    count: 1,
    filter: { anyOf: COMM_LIST_1 },
  },
  {
    kind: "courses",
    id: "comm-second",
    label: "Second communication course, from List 1 or List 2",
    count: 1,
    filter: { anyOf: [...COMM_LIST_1, ...COMM_LIST_2] },
  },
];

/**
 * Elective Requirement, stated on the major page as three bands totalling
 * 4.0 units. The *requirements* are quoted from the calendar; the subject
 * lists below are NOT.
 *
 * This is the one approximation in this file. The calendar defines these bands
 * by Faculty ("chosen from the Faculty of Arts", "the following Faculties:
 * Environment, Health, Science") and then defers to "Course Subjects Offered
 * for faculty assignment of subject codes". The synced catalog carries no
 * faculty field, so the faculty-to-subject expansion below was assembled by
 * hand and is not itself transcribed from the program page.
 *
 * The consequence: a course in an Arts subject missing from this list will be
 * reported as not counting when it does. Treat an unmet elective band as a
 * prompt to check, not a verdict. Only the subject codes the calendar names
 * outright — BET, BUS, COMM, STV — are certain.
 */
const CALENDAR_NAMED_SUBJECTS = ["BET", "BUS", "COMM", "STV"];

/** Not from the calendar — see the note above. */
const ASSUMED_ARTS_SUBJECTS = [
  "ENGL", "PHIL", "PSYCH", "ECON", "HIST", "FINE", "MUSIC", "SOC", "ANTH",
  "CLAS", "DRAMA", "GSJ", "LS", "PACS", "RS", "SPCOM", "COMMST",
];

/** Not from the calendar — see the note above. */
const ASSUMED_ENV_HEALTH_SCI_SUBJECTS = [
  "BIOL", "CHEM", "EARTH", "PHYS", "SCI", "KIN", "HLTH", "PHS", "REC",
  "ENVS", "ERS", "GEOG", "INTEG", "PLAN",
];

const ELECTIVES: Requirement[] = [
  {
    kind: "units",
    id: "elective-arts",
    label: "1.0 unit from the Faculty of Arts or BET/BUS/COMM/STV (subject list approximate)",
    units: 1.0,
    filter: { subjects: [...CALENDAR_NAMED_SUBJECTS, ...ASSUMED_ARTS_SUBJECTS] },
  },
  {
    kind: "units",
    id: "elective-sci",
    label:
      "1.0 unit from the Faculties of Environment, Health, or Science (subject list approximate)",
    units: 1.0,
    filter: { subjects: ASSUMED_ENV_HEALTH_SCI_SUBJECTS },
  },
  {
    kind: "units",
    id: "elective-additional",
    label:
      "2.0 additional units from Arts, Environment, Health, Science, or BET/BUS/COMM/STV (subject list approximate)",
    units: 2.0,
    filter: {
      subjects: [
        ...CALENDAR_NAMED_SUBJECTS,
        ...ASSUMED_ARTS_SUBJECTS,
        ...ASSUMED_ENV_HEALTH_SCI_SUBJECTS,
      ],
    },
  },
];

export const mathCsBcs: DegreeProgram = {
  code: "MAT-CS-BCS",
  name: "Computer Science (Bachelor of Computer Science - Honours)",
  faculty: "Mathematics",
  calendarYear: "2026-2027",
  source: {
    url: "https://uwaterloo.ca/academic-calendar/undergraduate-studies/catalog#/programs/SJPJkCAih",
    retrieved: "2026-08-22",
    // Every requirement below is quoted from the calendar pages cited above.
    // Rules the engine cannot express are listed under UNMODELLED rather than
    // approximated, so nothing here is inferred.
    verified: true,
  },
  totalUnits: 20.0,
  requirements: [
    { kind: "group", id: "cs-core", label: "Required CS courses", of: CS_CORE },
    { kind: "group", id: "math-core", label: "Required math courses", of: MATH_CORE },
    { kind: "group", id: "cs-upper", label: "Additional CS courses", of: CS_UPPER },
    { kind: "group", id: "communication", label: "Undergraduate Communication Requirement", of: COMMUNICATION },
    { kind: "group", id: "electives", label: "Elective Requirement (4.0 units)", of: ELECTIVES },
  ],
};

/**
 * UNMODELLED — stated by the calendar but not expressible in this engine, and
 * therefore NOT checked by the audit. A student must confirm these separately.
 *
 * From the major page:
 * - "Complete 1 course from the following: CS440-CS498, any CS course at the
 *   600- or 700-level", then one of CO 487, CS 499T, or STAT 440. The second
 *   half is a plain course choice, but the first depends on graduate-level
 *   courses the undergraduate catalog sync does not carry.
 * - "Complete all the required courses listed below including the 11.25 units
 *   of math courses" and "a minimum of 5.0 units of non-math courses". Both
 *   are Faculty-scoped unit totals; the catalog has no faculty field, so the
 *   elective bands above approximate coverage but not these totals.
 * - Minimum cumulative major average of 60.0% over a named course set, and a
 *   minimum cumulative overall average of 60.0%. Averages belong to the
 *   eligibility engine, not the degree audit.
 *
 * From the degree-level page:
 * - "Maximum of unusable attempts: 5.0 units" and "Maximum failed or excluded
 *   course units (excluding COOP, PD): 2.0".
 * - "A minimum of 7 (regular) or 8 (co-operative) full-time terms."
 * - Co-op: five credited work terms and five PD courses (PD1, PD11, PD10, and
 *   two more).
 * - Elective constraints: a course counted toward the Communication
 *   Requirement cannot also count toward the Elective Requirement; of the 4.0
 *   elective units at least 1.0 must be at the 200-level or higher; a course
 *   cross-listed with a math course cannot count.
 * - The first List 1 communication course must be completed with at least 60%
 *   before enrolling in 2A. The 60% floor is recorded in the label only.
 *
 * The Depth requirement ("1.5 units in the same subject") that appears on the
 * CS advising checklist is NOT stated on either calendar page and is therefore
 * omitted entirely.
 *
 * APPROXIMATED — the three elective bands are real and quoted, but the
 * faculty-to-subject-code expansion they are matched against was assembled by
 * hand, since the calendar defers to "Course Subjects Offered" and the synced
 * catalog has no faculty field. An elective band reported as unmet may simply
 * involve a subject missing from those lists.
 */
