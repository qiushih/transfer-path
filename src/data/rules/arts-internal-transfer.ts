import type { TransferRule } from "@/domain/eligibility";

/** Subject codes the Faculty of Arts average is computed over. */
export const ARTS_SUBJECTS = [
  "ENGL",
  "PHIL",
  "PSYCH",
  "ECON",
  "HIST",
  "FINE",
  "MUSIC",
  "SOC",
  "ANTH",
  "CLAS",
  "DRAMA",
  "GSJ",
  "LS",
  "PACS",
  "RS",
  "SPCOM",
  "COMMST",
  "SDS",
  "SWK",
  "GEOG",
  "PSCI",
  "FR",
  "SPAN",
  "GER",
  "ITAL",
  "JAPAN",
  "CHINA",
  "KOREA",
  "REES",
  "EASIA",
  "MEDVL",
  "BLKST",
  "INDG",
  "ARBUS",
  "AFM",
];

/**
 * Internal transfer into the Faculty of Arts, transcribed from
 * uwaterloo.ca/arts/undergraduate/faculty-transfer-arts on 2026-08-22.
 *
 * Arts states three averages at once, and they are not interchangeable: a
 * term average earned while actually taking Arts courses, an average across
 * every Arts course ever taken, and an overall cumulative average. A student
 * can clear the overall bar and still fail on the Arts-only one, which is
 * exactly why each is modelled separately rather than collapsed into "65%".
 */
export const artsInternalTransfer: TransferRule = {
  id: "arts-internal-transfer",
  targetProgram: "Faculty of Arts",
  source: {
    url: "https://uwaterloo.ca/arts/undergraduate/faculty-transfer-arts",
    retrieved: "2026-08-22",
  },
  condition: {
    kind: "all",
    label: "Faculty of Arts internal transfer",
    of: [
      { kind: "cumulativeAverage", min: 60 },
      {
        kind: "filteredAverage",
        label: "Average across all Arts courses, including any failed",
        min: 65,
        filter: { subjects: ARTS_SUBJECTS },
      },
      {
        kind: "completedCourses",
        label: "Arts course(s) toward the qualifying term",
        min: 3,
        filter: { subjects: ARTS_SUBJECTS },
      },
      {
        // "no fails, no repeats of past courses" in the qualifying term.
        kind: "maxFailures",
        max: 0,
      },
      {
        // FRW students are told to seek readmission to their home faculty
        // first, so this is a real gate rather than a soft preference.
        kind: "academicStanding",
        allowed: ["good", "satisfactory", "conditional", "probation"],
      },
      {
        kind: "manualCheck",
        label: "Enrolled full-time, with a 65% average in the qualifying term",
        detail:
          "Arts requires a 65% term average earned while taking three to four Arts courses, with no failures and no repeats of past courses. The planner checks the Arts average and the course count across your whole record, but cannot isolate a single qualifying term.",
      },
      {
        kind: "manualCheck",
        label: "Undergraduate Communication Requirement assessed",
        detail:
          "Your UCR is assessed as part of the transfer process. Speak to a Faculty Transfer Advisor in Arts before submitting the form.",
      },
    ],
  },
  notes: [
    "Consult a Faculty Transfer Advisor in Arts before submitting anything; the Faculty Transfer Form is due at least one month before the start of the term you want to enter.",
    "Students in FRW (failed to remain) standing must apply for readmission to their home faculty first.",
    "Majors set their own bars on top of the faculty transfer: an Honours major needs a 70% major average and a general major 65%.",
    "Transfer credit is capped at 10.0 units for a four-year degree and 7.5 units for a three-year degree.",
  ],
};
