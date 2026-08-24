import type { TransferRule } from "@/domain/eligibility";

/** Subjects Engineering treats as "math or science" for the per-course floor. */
export const MATH_SCIENCE_SUBJECTS = [
  "MATH",
  "STAT",
  "CS",
  "AMATH",
  "PMATH",
  "CO",
  "ACTSC",
  "PHYS",
  "CHEM",
  "BIOL",
  "EARTH",
  "SCI",
];

/**
 * Internal transfer into the Faculty of Engineering, transcribed from
 * uwaterloo.ca/engineering/undergraduate-students/policies-regulations/transfers
 * on 2026-08-22.
 *
 * Engineering is unlike the other faculties in this tool in a way that matters
 * more than any of its numbers: **an accepted transfer starts over in 1A**,
 * and 1A runs only in September. A student comparing Engineering against a
 * Math or Science transfer is not comparing like with like, so that fact is
 * modelled as a condition the student must consciously accept rather than a
 * footnote they can skim past.
 */
export const engineeringInternalTransfer: TransferRule = {
  id: "engineering-internal-transfer",
  targetProgram: "Faculty of Engineering",
  source: {
    url: "https://uwaterloo.ca/engineering/undergraduate-students/policies-regulations/transfers",
    retrieved: "2026-08-22",
  },
  condition: {
    kind: "all",
    label: "Faculty of Engineering internal transfer",
    of: [
      { kind: "cumulativeAverage", min: 75 },
      {
        // "Grades of less than 70% in any math or science course may result in
        // an application being denied." A single low grade matters here even
        // when the average clears 75%, which no average can express.
        kind: "minGradeInEvery",
        label: "Math and science grades",
        min: 70,
        filter: { subjects: MATH_SCIENCE_SUBJECTS },
      },
      { kind: "academicStanding", allowed: ["good", "satisfactory"] },
      {
        kind: "manualCheck",
        label: "Willing to restart in 1A, which runs only in September",
        detail:
          "Every student entering Engineering starts in the 1A term, and 1A is offered only in September. Completed university terms do not carry you into a later Engineering level, so a transfer restarts the degree.",
      },
      {
        kind: "manualCheck",
        label: "High school admission requirements for the chosen Engineering program met",
        detail:
          "Applicants must satisfy the high school admission requirements for the program of interest. Subjects taken three or more years ago may no longer qualify and may need to be refreshed. Completing the equivalents at university level may strengthen an application but is not required.",
      },
      {
        kind: "manualCheck",
        label: "English language proficiency requirements for Engineering met",
        detail: "The Faculty of Engineering sets its own English language proficiency requirement.",
      },
    ],
  },
  notes: [
    "The 75% cumulative average is a floor, not a target: the page states that much higher averages are often required.",
    "Transfer applicants compete in the same applicant pool as external applicants, which the faculty describes as an extremely competitive process.",
    "Deadline: 1 March for entry to 1A the following September. A Faculty Transfer Form and a letter explaining your motivation are required, and decisions conclude in mid-May.",
    "Contact the Admissions Officer for your program for 1A/1B entry, or the Advanced Admissions Officer for 2A and higher.",
  ],
};
