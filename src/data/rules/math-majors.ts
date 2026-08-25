import type { Condition, TransferRule } from "@/domain/eligibility";

/**
 * Declaration rules for Faculty of Mathematics majors, transcribed from the
 * 2026-2027 Undergraduate Studies Academic Calendar on 2026-08-22.
 *
 * The important finding from reading these pages: **most Math majors have no
 * declaration requirements at all.** Combinatorics and Optimization, Pure
 * Mathematics, Computational Mathematics and Statistics state only minimum
 * averages, and several pages have no "Declaration Requirements" section
 * whatsoever. Only the limited-enrolment plans - Computer Science, Data
 * Science, Actuarial Science, FARM - gate on anything more.
 *
 * That is worth showing plainly rather than padding out: a student asking
 * "what do I need for CO?" should be told the honest answer, which is the
 * faculty transfer plus two averages.
 */

const CALENDAR = "https://uwaterloo.ca/academic-calendar/undergraduate-studies/catalog#/programs";
const RETRIEVED = "2026-08-22";

/** The calendar's "all math courses" for major-average purposes. */
export const ALL_MATH_SUBJECTS = [
  "MATH",
  "STAT",
  "CS",
  "ACTSC",
  "AMATH",
  "CO",
  "PMATH",
  "MATBUS",
  "CM",
];

/**
 * The shape shared by every Math major that states only averages: a cumulative
 * overall minimum plus a major average over all math courses.
 */
function averagesOnlyMajor(options: {
  id: string;
  name: string;
  programId: string;
  overall: number;
  major: number;
  extra?: Condition[];
  notes?: string[];
}): TransferRule {
  return {
    id: options.id,
    targetProgram: options.name,
    source: { url: `${CALENDAR}/${options.programId}`, retrieved: RETRIEVED },
    condition: {
      kind: "all",
      label: `${options.name} declaration requirements`,
      of: [
        { kind: "cumulativeAverage", min: options.overall },
        {
          kind: "filteredAverage",
          label: "Cumulative major average, over all math courses",
          min: options.major,
          filter: { subjects: ALL_MATH_SUBJECTS },
        },
        ...(options.extra ?? []),
      ],
    },
    notes: [
      "The calendar states no declaration requirements for this major beyond the averages above; the Faculty of Mathematics transfer requirements still apply.",
      ...(options.notes ?? []),
    ],
  };
}

export const coDeclaration = averagesOnlyMajor({
  id: "co-declaration",
  name: "Combinatorics and Optimization",
  programId: "SyeD110Co2",
  overall: 60,
  major: 65,
});

export const statisticsDeclaration = averagesOnlyMajor({
  id: "statistics-declaration",
  name: "Statistics",
  programId: "H1XegyCAin",
  overall: 60,
  major: 65,
});

export const appliedMathDeclaration = averagesOnlyMajor({
  id: "amath-declaration",
  name: "Applied Mathematics",
  programId: "r1lByy00sh",
  overall: 60,
  major: 65,
});

export const pureMathDeclaration = averagesOnlyMajor({
  id: "pmath-declaration",
  name: "Pure Mathematics",
  programId: "S1eexkCAo2",
  overall: 60,
  major: 65,
});

export const computationalMathDeclaration = averagesOnlyMajor({
  id: "cm-declaration",
  name: "Computational Mathematics",
  programId: "rkDkJCAj2",
  overall: 60,
  // Computational Mathematics sets 60, not the 65 most other majors use.
  major: 60,
});

/** Mathematical Economics splits its averages by subject rather than "all math". */
export const mathEconDeclaration: TransferRule = {
  id: "mathec-declaration",
  targetProgram: "Mathematical Economics",
  source: { url: `${CALENDAR}/r1gAJJ0Cin`, retrieved: RETRIEVED },
  condition: {
    kind: "all",
    label: "Mathematical Economics declaration requirements",
    of: [
      { kind: "cumulativeAverage", min: 60 },
      {
        kind: "filteredAverage",
        label: "Cumulative Mathematics average",
        min: 60,
        filter: { subjects: ALL_MATH_SUBJECTS },
      },
      {
        kind: "filteredAverage",
        label: "Cumulative Economics average",
        min: 70,
        filter: { subjects: ["ECON"] },
      },
    ],
  },
  notes: [
    "The calendar states no declaration requirements beyond the averages above; the Faculty of Mathematics transfer requirements still apply.",
  ],
};

/**
 * Actuarial Science gates on a specific course and a major average, with an
 * explicit fallback for students who do not have a major average yet.
 */
export const actuarialScienceDeclaration: TransferRule = {
  id: "actsc-declaration",
  targetProgram: "Actuarial Science",
  source: { url: `${CALENDAR}/HkeH1JRCjh`, retrieved: RETRIEVED },
  condition: {
    kind: "all",
    label: "Actuarial Science declaration requirements",
    of: [
      {
        kind: "completedCourses",
        label: "of MTHEL 131",
        min: 1,
        minGrade: 60,
        filter: { anyOf: [{ subject: "MTHEL", catalogNumber: "131" }] },
      },
      {
        // "A minimum major average (MAV) of 70.0%; or, if a MAV does not yet
        // exist, a minimum cumulative average of 70.0% with at least 10 passed
        // courses." The fallback is a real alternative, not a restatement.
        kind: "any",
        label: "Major average of 70%, or the stated fallback",
        of: [
          {
            kind: "filteredAverage",
            label: "Major average over ACTSC 231/232, STAT 230/240, STAT 231/241, and 300/400-level math",
            min: 70,
            filter: {
              anyOf: [
                { subject: "ACTSC", catalogNumber: "231" },
                { subject: "ACTSC", catalogNumber: "232" },
                { subject: "STAT", catalogNumber: "230" },
                { subject: "STAT", catalogNumber: "240" },
                { subject: "STAT", catalogNumber: "231" },
                { subject: "STAT", catalogNumber: "241" },
              ],
            },
          },
          {
            kind: "all",
            label: "No major average yet",
            of: [
              { kind: "cumulativeAverage", min: 70 },
              { kind: "completedCourses", label: "passed courses", min: 10, filter: {} },
            ],
          },
        ],
      },
      { kind: "cumulativeAverage", min: 60 },
      {
        kind: "manualCheck",
        label: "Credential combination is valid",
        detail:
          "The calendar directs students to check invalid credential combinations before declaring this plan.",
      },
    ],
  },
  notes: [
    "Business Administration and Mathematics double degree students may present BUS 121W with a minimum grade of C- instead of MTHEL 131.",
    "The major average is defined over ACTSC 231, ACTSC 232, STAT 230 or 240, STAT 231 or 241, and all math courses at the 300- or 400-level. Only the named courses are checked here; the 300/400-level portion is not, because it depends on which courses count toward the major.",
  ],
};

/**
 * Data Science mirrors Computer Science almost exactly, with one real
 * difference worth preserving: it does not require CS 136L.
 */
export const dataScienceDeclaration: TransferRule = {
  id: "datasci-declaration",
  targetProgram: "Data Science",
  source: { url: `${CALENDAR}/HymD11R0j3`, retrieved: RETRIEVED },
  condition: {
    kind: "all",
    label: "Data Science declaration requirements",
    of: [
      {
        kind: "completedCourses",
        label: "of CS 136 or CS 146",
        min: 1,
        filter: {
          anyOf: [
            { subject: "CS", catalogNumber: "136" },
            { subject: "CS", catalogNumber: "146" },
          ],
        },
      },
      {
        kind: "filteredAverage",
        label: "Cumulative math major average, over all math and CS courses",
        min: 65,
        filter: { subjects: ALL_MATH_SUBJECTS },
      },
      {
        kind: "filteredAverage",
        label: "Cumulative CS major average",
        min: 70,
        filter: { subjects: ["CS"] },
      },
      { kind: "minStudyTerms", min: 1 },
      { kind: "maxLevel", max: "2B", note: "Applying no later than the 2B level" },
      {
        kind: "manualCheck",
        label: "At least one term in the Faculty of Mathematics with a typical course load",
        detail:
          "The calendar defines a typical load as: for students taking a first-year CS course, one CS course, two math courses, and two non-math electives; for students taking second-year CS courses, two CS courses, two math courses, and one non-math elective.",
      },
    ],
  },
  notes: [
    "Data Science is a limited-enrolment academic plan. Meeting these conditions does not guarantee admission, and applicants missing some are considered individually.",
    "Transfer into Data Science from a Mathematics plan outside Computer Science is subject to enrolment limits, and does not then allow an automatic transfer into Computer Science.",
    "Unlike Computer Science, Data Science does not require CS 136L.",
  ],
};

/**
 * FARM is admitted at Year One rather than declared later, so the honest
 * answer for a transfer applicant is mostly "this is not a normal route".
 */
export const farmDeclaration: TransferRule = {
  id: "farm-declaration",
  targetProgram: "Mathematics/Financial Analysis and Risk Management (CFA specialization)",
  source: { url: `${CALENDAR}/SkgAy1R0jh`, retrieved: RETRIEVED },
  condition: {
    kind: "all",
    label: "FARM declaration requirements",
    of: [
      { kind: "cumulativeAverage", min: 60 },
      {
        kind: "filteredAverage",
        label: "Cumulative major average, over all math courses",
        min: 60,
        filter: { subjects: ALL_MATH_SUBJECTS },
      },
      {
        kind: "filteredAverage",
        label: "Cumulative special major average, over ACTSC/AFM/BUS/COMM/ECON/MATBUS",
        min: 70,
        filter: { subjects: ["ACTSC", "AFM", "BUS", "COMM", "ECON", "MATBUS"] },
      },
      {
        kind: "manualCheck",
        label: "Admission to a restricted-enrolment plan normally granted at Year One",
        detail:
          "The calendar states that most students in this plan are admitted at the Year One level directly into the Mathematics/Financial Analysis and Risk Management admission category. Transferring in later is not the normal route - speak to the Math Undergraduate Office.",
      },
    ],
  },
  notes: [
    "Students select their specialization in 3A. This rule follows the Chartered Financial Analyst specialization; the Professional Risk Management specialization is a separate calendar page.",
  ],
};
