import type { Condition, TransferRule } from "@/domain/eligibility";

/**
 * Internal transfer into Software Engineering, transcribed from
 * uwaterloo.ca/software-engineering/future-students/internal-transfers on
 * 2026-08-22.
 *
 * SE is the one plan in this tool whose *course* requirements depend on which
 * level you are entering at: a student joining before 1B needs one course, and
 * a student joining before 2B needs six. The engine cannot ask "which entry
 * point are you aiming for", so the three published lists are modelled as an
 * `any`: satisfying the courses for a later entry point means you qualify for
 * at least one route in. The panel names which list each branch belongs to, so
 * a student can see which entry point they are actually on track for.
 *
 * SE also differs from the general Engineering transfer in a way worth
 * knowing: entry at 1B, 2A or 2B is a direct application to the SE Director,
 * so it does *not* force the 1A restart that a Faculty of Engineering transfer
 * does. Only 1A entry goes through Engineering Admissions.
 */

const before1B: Condition = {
  kind: "all",
  label: "Courses for entry before 1B",
  of: [
    {
      kind: "completedCourses",
      label: "of MATH 115 or MATH 117",
      min: 1,
      filter: {
        anyOf: [
          { subject: "MATH", catalogNumber: "115" },
          { subject: "MATH", catalogNumber: "117" },
        ],
      },
    },
  ],
};

const before2A: Condition = {
  kind: "all",
  label: "Courses for entry before 2A",
  of: [
    {
      kind: "completedCourses",
      label: "of MATH 119",
      min: 1,
      filter: { anyOf: [{ subject: "MATH", catalogNumber: "119" }] },
    },
    {
      kind: "completedCourses",
      label: "of a digital circuits course (ECE 124, MTE 262, SYDE 192, or BME 393)",
      min: 1,
      filter: {
        anyOf: [
          { subject: "ECE", catalogNumber: "124" },
          { subject: "MTE", catalogNumber: "262" },
          { subject: "SYDE", catalogNumber: "192" },
          { subject: "BME", catalogNumber: "393" },
        ],
      },
    },
    {
      kind: "completedCourses",
      label: "of CS 137",
      min: 1,
      filter: { anyOf: [{ subject: "CS", catalogNumber: "137" }] },
    },
  ],
};

const before2B: Condition = {
  kind: "all",
  label: "Courses for entry before 2B",
  of: [
    {
      kind: "completedCourses",
      label: "of MATH 135 or ECE 108 (discrete math)",
      min: 1,
      filter: {
        anyOf: [
          { subject: "MATH", catalogNumber: "135" },
          { subject: "ECE", catalogNumber: "108" },
        ],
      },
    },
    {
      kind: "completedCourses",
      label: "of STAT 206 or STAT 230",
      min: 1,
      filter: {
        anyOf: [
          { subject: "STAT", catalogNumber: "206" },
          { subject: "STAT", catalogNumber: "230" },
        ],
      },
    },
    {
      kind: "completedCourses",
      label: "of a logic course (SE 212, ECE 208, or CS 245)",
      min: 1,
      filter: {
        anyOf: [
          { subject: "SE", catalogNumber: "212" },
          { subject: "ECE", catalogNumber: "208" },
          { subject: "CS", catalogNumber: "245" },
        ],
      },
    },
    {
      kind: "completedCourses",
      label: "of CS 241 or ECE 351 (compilers)",
      min: 1,
      filter: {
        anyOf: [
          { subject: "CS", catalogNumber: "241" },
          { subject: "ECE", catalogNumber: "351" },
        ],
      },
    },
    {
      kind: "completedCourses",
      label: "of CS 138",
      min: 1,
      filter: { anyOf: [{ subject: "CS", catalogNumber: "138" }] },
    },
  ],
};

export const softwareEngineeringTransfer: TransferRule = {
  id: "se-internal-transfer",
  targetProgram: "Software Engineering",
  source: {
    url: "https://uwaterloo.ca/software-engineering/future-students/internal-transfers",
    retrieved: "2026-08-22",
  },
  condition: {
    kind: "all",
    label: "Software Engineering internal transfer",
    of: [
      { kind: "cumulativeAverage", min: 87 },
      {
        // "90% average in software-related courses." The page does not
        // enumerate which subjects count, so CS and SE are used as the closest
        // defensible reading. Treat an unmet result here as a prompt to ask.
        kind: "filteredAverage",
        label: "Average across software-related courses (CS and SE, approximate)",
        min: 90,
        filter: { subjects: ["CS", "SE"] },
      },
      {
        kind: "any",
        label: "Courses for at least one published entry point",
        of: [before2B, before2A, before1B],
      },
      {
        kind: "manualCheck",
        label: "Software development experience and version control familiarity",
        detail:
          "Applicants submit a resume describing software development experience and familiarity with version control, plus an explanation of why Software Engineering is the right fit. The Engineering transfer page adds that programming courses taken in other programs are not always sufficient - SE looks for well-structured, modular programs.",
      },
    ],
  },
  notes: [
    "Published bar: typically an 87% cumulative average and a 90% average in software-related courses.",
    "Entry points and deadlines: 1A (Fall) via Engineering Admissions in February; 1B (Winter) apply at the end of 1A to the SE Director; 2A (Fall) apply by the end of May; 2B (Spring) apply by the end of January.",
    "Capacity for 1B, 2A and 2B is limited.",
    "Only 1A entry goes through Engineering Admissions and therefore the Faculty of Engineering transfer requirements, including the 1A restart. Entry at 1B, 2A or 2B is a direct application to the SE Director.",
  ],
};
