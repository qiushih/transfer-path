import type { TransferRule } from "@/domain/eligibility";

export const cfmInternalTransfer: TransferRule = {
  id: "cfm-internal-transfer",
  targetProgram: "Computing and Financial Management (CFM)",
  source: {
    url: "https://uwaterloo.ca/computing-financial-management/future-students/apply-admissions/transferring-computing-and-financial-management",
    retrieved: "2026-08-21",
  },
  condition: {
    kind: "all",
    label: "CFM internal transfer",
    of: [
      { kind: "cumulativeAverage", min: 80 },
      {
        kind: "filteredAverage",
        label: "Average across math courses",
        min: 80,
        filter: { subjects: ["MATH", "STAT", "ACTSC"] },
      },
      {
        kind: "filteredAverage",
        label: "Average across CS courses",
        min: 80,
        filter: { subjects: ["CS"] },
      },
      {
        // CS 115 and CS 116 together substitute for the single CS 135 course,
        // which is why this is a nested all-inside-any rather than a course list.
        kind: "any",
        label: "Introductory CS sequence",
        of: [
          {
            kind: "completedCourses",
            label: "of CS 135 or CS 145",
            min: 1,
            filter: {
              anyOf: [
                { subject: "CS", catalogNumber: "135" },
                { subject: "CS", catalogNumber: "145" },
              ],
            },
          },
          {
            kind: "all",
            label: "CS 115 and CS 116 together",
            of: [
              {
                kind: "completedCourses",
                label: "of CS 115",
                min: 1,
                filter: { anyOf: [{ subject: "CS", catalogNumber: "115" }] },
              },
              {
                kind: "completedCourses",
                label: "of CS 116",
                min: 1,
                filter: { anyOf: [{ subject: "CS", catalogNumber: "116" }] },
              },
            ],
          },
        ],
      },
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
        label: "of MATH 127, MATH 137, or MATH 147",
        min: 1,
        filter: {
          anyOf: [
            { subject: "MATH", catalogNumber: "127" },
            { subject: "MATH", catalogNumber: "137" },
            { subject: "MATH", catalogNumber: "147" },
            // Engineering students may present MATH 116/117 instead.
            { subject: "MATH", catalogNumber: "116" },
            { subject: "MATH", catalogNumber: "117" },
          ],
        },
      },
      {
        kind: "completedCourses",
        label: "100-level AFM or ECON course (AFM preferred)",
        min: 1,
        filter: { subjects: ["AFM", "ECON"], minLevel: 100, maxLevel: 200 },
      },
      { kind: "minStudyTerms", min: 2 },
      {
        kind: "systemOfStudy",
        required: "co-op",
        note: "Enrolled as a co-op student (CFM is co-op only)",
      },
      {
        kind: "manualCheck",
        label: "Currently a University of Waterloo student",
        detail:
          "Transfers to CFM from other post-secondary institutions are not eligible due to limitations with courses and co-op.",
      },
    ],
  },
  notes: [
    "Fall 2026 transfer applications close 2026-08-31.",
    "The published bar is 'grades above 80% in all courses'; averages in the low 80s are described as competitive, not guaranteed.",
  ],
};
