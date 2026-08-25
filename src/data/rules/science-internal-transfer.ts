import type { TransferRule } from "@/domain/eligibility";

/** Lab sciences the Faculty of Science counts as "Science course work". */
export const SCIENCE_SUBJECTS = ["BIOL", "CHEM", "EARTH", "PHYS", "SCI"];

export const scienceInternalTransfer: TransferRule = {
  id: "science-internal-transfer",
  targetProgram: "Faculty of Science",
  source: {
    url: "https://uwaterloo.ca/science-undergraduate-office/modifying-your-program/transferring-science",
    retrieved: "2026-08-21",
  },
  condition: {
    kind: "all",
    label: "Faculty of Science internal transfer",
    of: [
      { kind: "cumulativeAverage", min: 60 },
      {
        kind: "filteredAverage",
        label: "Average across Science courses",
        min: 60,
        filter: { subjects: SCIENCE_SUBJECTS },
      },
      {
        kind: "completedCourses",
        label: "Science course at 60% or higher",
        min: 1,
        minGrade: 60,
        filter: { subjects: SCIENCE_SUBJECTS },
      },
      { kind: "academicStanding", allowed: ["good", "satisfactory"] },
      {
        kind: "programExclusion",
        programs: ["BIOTECH-CPA", "CAP", "OPTOMETRY", "PHARMACY"],
        note: "Biotechnology/CPA, Conditional Admission to Pharmacy, Optometry, and Pharmacy students are not eligible",
      },
      {
        kind: "manualCheck",
        label: "English Language requirements for the Faculty of Science met",
        detail: "Science sets its own English Language admission requirement; confirm with the Science Undergraduate Office.",
      },
    ],
  },
  notes: [
    "Submission deadlines: Fall 2026 - 2026-08-07; Winter 2027 - 2026-12-04; Spring 2027 - 2027-04-02.",
    "Students not in satisfactory standing may instead qualify through a non-degree term: minimum 4 courses including 2 Science courses from different areas with labs, 60% cumulative term average, and no failed or INC grades.",
  ],
};
