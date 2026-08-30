import type { TransferRule } from "@/domain/eligibility";

/**
 * Internal transfer into the Faculty of Environment, transcribed from
 * uwaterloo.ca/environment/undergraduate/current-students/transfers on
 * 2026-08-22.
 *
 * Environment is structurally different from the other faculties in this tool:
 * **it publishes no faculty-wide criteria at all.** The faculty page states
 * only that a student from outside Environment must follow the process of the
 * school they want to join, and links to the four of them. There is no average,
 * no course list, and no deadline to transcribe.
 *
 * So this rule deliberately checks almost nothing. Inventing a plausible
 * faculty-level cutoff would be worse than saying plainly that the school
 * decides - a student who cleared an invented bar would think they were on
 * track when the real requirements live one page further in.
 */
export const environmentInternalTransfer: TransferRule = {
  id: "environment-internal-transfer",
  targetProgram: "Faculty of Environment",
  source: {
    url: "https://uwaterloo.ca/environment/undergraduate/current-students/transfers",
    retrieved: "2026-08-22",
  },
  condition: {
    kind: "all",
    label: "Faculty of Environment internal transfer",
    of: [
      {
        kind: "manualCheck",
        label: "The school you want to join sets the requirements, not the faculty",
        detail:
          "The Faculty of Environment publishes no faculty-wide transfer criteria. Students from another faculty follow the process of the school they are joining: Environment, Resources and Sustainability; Geography and Environmental Management; Planning; or Environment, Enterprise and Development. Pick that school below, or contact its academic advisor.",
      },
    ],
  },
  notes: [
    "Requirements vary by school and are published on each school's own page, so choose a program below to see what is actually checked.",
    "Students already inside the Faculty of Environment who want a different plan speak directly to the academic advisor for that plan.",
  ],
};

/**
 * ERS is the one Environment school publishing a concrete number, so it is the
 * only one modelled as a checkable rule rather than a referral.
 */
export const ersTransfer: TransferRule = {
  id: "ers-transfer",
  targetProgram: "Environment, Resources and Sustainability (ERS)",
  source: {
    url: "https://uwaterloo.ca/environment-resources-and-sustainability/undergraduate/transfer-environment-resources-and-sustainability",
    retrieved: "2026-08-22",
  },
  condition: {
    kind: "all",
    label: "ERS transfer requirements",
    of: [
      { kind: "cumulativeAverage", min: 70 },
      {
        kind: "manualCheck",
        label: "Coursework emphasising reading and writing",
        detail:
          "ERS states that completed coursework should emphasise reading and writing skills, since those are central to the curriculum. This is a judgement the school makes, not a course list.",
      },
    ],
  },
  notes: [
    "The published bar is a 70% overall average from another University of Waterloo program.",
    "Transfers start in the fall term only, and applications go in after winter grades are available, using the Plan Modification or Internal/Faculty Transfer Application form.",
    "Contact: sers.admin@uwaterloo.ca, Environment 2 (EV2).",
  ],
};
