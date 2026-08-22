import type { TransferRule } from "@/domain/eligibility";

/**
 * Declaration Requirements for the Computer Science major, transcribed
 * verbatim from the Undergraduate Studies Academic Calendar (2026-2027) on
 * 2026-08-22.
 *
 * This is a *second stage*, not an alternative to the Faculty of Mathematics
 * transfer rule. The calendar opens with "Students from within the Faculty of
 * Mathematics may apply for admission to the Computer Science major", so a
 * student outside Math must first be admitted to the Faculty and then declare
 * the major. Modelling only one of the two would understate what a transfer
 * applicant actually has to do.
 *
 * Deliberately excluded: everything on the same page that applies *after*
 * admission to the major — required courses, elective bands, unit totals,
 * co-op and PD. Those are graduation requirements, not declaration criteria.
 */

/** The calendar defines the math major average over "all math and computer science courses". */
export const MATH_MAJOR_SUBJECTS = [
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

export const csDeclaration: TransferRule = {
  id: "cs-declaration",
  targetProgram: "Computer Science major (declaration)",
  source: {
    url: "https://uwaterloo.ca/academic-calendar/undergraduate-studies/catalog#/programs/SJPJkCAih",
    retrieved: "2026-08-22",
  },
  condition: {
    kind: "all",
    label: "Computer Science major declaration requirements",
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
        kind: "completedCourses",
        label: "of CS 136L",
        min: 1,
        filter: { anyOf: [{ subject: "CS", catalogNumber: "136L" }] },
      },
      {
        kind: "filteredAverage",
        label: "Cumulative math major average, over all math and CS courses",
        min: 65,
        filter: { subjects: MATH_MAJOR_SUBJECTS },
      },
      {
        kind: "filteredAverage",
        label: "Cumulative CS major average",
        min: 70,
        filter: { subjects: ["CS"] },
      },
      {
        // "Have completed at least one term in the Faculty of Mathematics with
        // a typical course load for a Computer Science major." The course-load
        // shapes the calendar gives are checked by the student, since the
        // engine cannot tell which term a load belongs to or classify
        // non-math electives by faculty.
        kind: "minStudyTerms",
        min: 1,
      },
      {
        kind: "manualCheck",
        label: "At least one term in the Faculty of Mathematics with a typical CS course load",
        detail:
          "The calendar defines a typical load as: for students taking a first-year CS course, one CS course, two math courses, and two non-math electives; for students taking second-year CS courses, two CS courses, two math courses, and one non-math elective.",
      },
      {
        kind: "manualCheck",
        label: "Not beyond the 2B level",
        detail:
          "The calendar states students are normally not considered for admission beyond the 2B level.",
      },
    ],
  },
  notes: [
    "Computer Science is a limited-enrolment academic plan. The calendar states that meeting these conditions does not guarantee admission, and that applicants missing some conditions are considered individually.",
    "Applies to students already in the Faculty of Mathematics. A student in another faculty must first be admitted to the Faculty of Mathematics.",
  ],
};
