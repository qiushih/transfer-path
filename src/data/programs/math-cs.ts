import type { DegreeProgram } from "@/domain/requirements";

/**
 * TEMPLATE — not a real degree audit.
 *
 * These requirements have NOT been transcribed from the undergraduate
 * calendar. They exist to exercise the audit engine and to show the shape a
 * real program definition takes. `verified: false` makes the UI say so.
 *
 * To make this real: work through the plan's requirements in the calendar at
 * https://ucalendar.uwaterloo.ca/, transcribe each one, then set verified.
 */
export const mathCsTemplate: DegreeProgram = {
  code: "MAT-CS-BCS",
  name: "Computer Science (BCS) — TEMPLATE",
  faculty: "Mathematics",
  calendarYear: "2024-2025",
  source: {
    url: "https://ucalendar.uwaterloo.ca/",
    retrieved: "2026-08-21",
    verified: false,
  },
  totalUnits: 20.0,
  requirements: [
    {
      kind: "group",
      id: "g-core",
      label: "First-year core",
      of: [
        {
          kind: "course",
          id: "r-cs135",
          label: "CS 135",
          anyOf: [
            { subject: "CS", catalogNumber: "135" },
            { subject: "CS", catalogNumber: "145" },
          ],
        },
        {
          kind: "course",
          id: "r-cs136",
          label: "CS 136",
          anyOf: [
            { subject: "CS", catalogNumber: "136" },
            { subject: "CS", catalogNumber: "146" },
          ],
        },
        {
          kind: "course",
          id: "r-math135",
          label: "MATH 135",
          anyOf: [
            { subject: "MATH", catalogNumber: "135" },
            { subject: "MATH", catalogNumber: "145" },
          ],
        },
        {
          kind: "course",
          id: "r-math137",
          label: "MATH 137",
          anyOf: [
            { subject: "MATH", catalogNumber: "137" },
            { subject: "MATH", catalogNumber: "147" },
          ],
        },
        {
          kind: "course",
          id: "r-math138",
          label: "MATH 138",
          anyOf: [
            { subject: "MATH", catalogNumber: "138" },
            { subject: "MATH", catalogNumber: "148" },
          ],
        },
      ],
    },
    {
      kind: "course",
      id: "r-stat230",
      label: "STAT 230",
      anyOf: [
        { subject: "STAT", catalogNumber: "230" },
        { subject: "STAT", catalogNumber: "240" },
      ],
    },
    {
      kind: "course",
      id: "r-math239",
      label: "MATH 239",
      anyOf: [
        { subject: "MATH", catalogNumber: "239" },
        { subject: "MATH", catalogNumber: "249" },
      ],
    },
    {
      kind: "units",
      id: "r-cs-upper",
      label: "Upper-year CS",
      units: 3.0,
      filter: { subjects: ["CS"], minLevel: 300 },
    },
    {
      kind: "courses",
      id: "r-comm",
      label: "Communication requirement",
      count: 2,
      filter: { subjects: ["ENGL", "SPCOM", "EMLS"] },
    },
  ],
};

export const PROGRAMS: DegreeProgram[] = [mathCsTemplate];
