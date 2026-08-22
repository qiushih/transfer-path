import type { TransferRule } from "@/domain/eligibility";

/**
 * The Faculty of Mathematics counts these eight subjects as "math courses"
 * for both the course-count and the subject-average thresholds.
 */
export const MATH_SUBJECTS = ["ACTSC", "AMATH", "CO", "CS", "MATBUS", "MATH", "PMATH", "STAT"];

export const mathInternalTransfer: TransferRule = {
  id: "math-internal-transfer",
  targetProgram: "Faculty of Mathematics",
  source: {
    url: "https://uwaterloo.ca/math/internal-transfer",
    retrieved: "2026-08-21",
  },
  condition: {
    kind: "all",
    label: "Faculty of Mathematics internal transfer",
    of: [
      { kind: "cumulativeAverage", min: 75 },
      {
        kind: "filteredAverage",
        label: "Average across math courses",
        min: 75,
        filter: { subjects: MATH_SUBJECTS },
      },
      {
        kind: "completedCourses",
        label: "math courses",
        min: 3,
        filter: { subjects: MATH_SUBJECTS },
      },
      {
        kind: "completedCourses",
        label: "MATH-subject course (or approved equivalent)",
        min: 1,
        filter: { subjects: ["MATH"] },
      },
      { kind: "maxFailures", max: 2 },
      { kind: "minStudyTerms", min: 1 },
      {
        kind: "programExclusion",
        programs: ["BASE"],
        note: "Students in (or who have previously failed) the BASE program are not eligible",
      },
      {
        kind: "manualCheck",
        label: "Not enrolled in a 2+2, 3+1, or 2+1+1 plan",
        detail: "Confirm your plan is not a joint/pathway program — these are ineligible.",
      },
      {
        kind: "manualCheck",
        label: "Applying during a study term, entering Math on a study term",
        detail:
          "Applications cannot be submitted during a scheduled co-op work term, and the first term in Math must be a study term.",
      },
    ],
  },
  notes: [
    "Winter 2027 entry: applications open 2026-07-06 and close 2026-08-26.",
    "External transfer and readmitted students must first complete one full-time term at Waterloo.",
  ],
};
