import { describe, expect, it } from "vitest";
import { auditDegree } from "./audit";
import { buildEquivalenceIndex } from "./equivalence";
import { courseKey } from "./grades";
import type { DegreeProgram } from "./requirements";
import type { AcademicProfile, CourseAttempt } from "./types";

/** Mirrors the real MATH 118/138 antirequisite pair, plus a one-way case. */
const CATALOG = [
  { subject: "MATH", catalogNumber: "138", requirements: "Prereq: MATH 137. Antireq: MATH 118, 119, 128, 148" },
  { subject: "MATH", catalogNumber: "118", requirements: "Antireq: MATH 119, MATH 128, MATH 138, MATH 148" },
  { subject: "MATH", catalogNumber: "137", requirements: "Antireq: MATH 127" },
  // One-way only: 137 lists 127, but 127 does not list 137 back.
  { subject: "MATH", catalogNumber: "127", requirements: "Prereq: 4U Calculus" },
  { subject: "ENGL", catalogNumber: "108", requirements: null },
];

function attempt(subject: string, catalogNumber: string): CourseAttempt {
  return {
    course: { subject, catalogNumber },
    termCode: "1249",
    units: 0.5,
    grade: { kind: "numeric", value: 80 },
  };
}

function profileOf(attempts: CourseAttempt[]): AcademicProfile {
  return { currentProgram: "SCI-BIO", calendarYear: "2024-2025", attempts, terms: [] };
}

const index = buildEquivalenceIndex(CATALOG);

describe("equivalence from mutual antirequisites", () => {
  it("treats MATH 118 as substitutable for MATH 138", () => {
    expect(index.canSubstitute({ subject: "MATH", catalogNumber: "118" }, { subject: "MATH", catalogNumber: "138" })).toBe(true);
    expect(index.sourceFor({ subject: "MATH", catalogNumber: "118" }, { subject: "MATH", catalogNumber: "138" })).toBe(
      "mutual-antirequisite",
    );
  });

  it("is symmetric", () => {
    expect(index.canSubstitute({ subject: "MATH", catalogNumber: "138" }, { subject: "MATH", catalogNumber: "118" })).toBe(true);
  });

  it("ignores a one-way antirequisite", () => {
    // MATH 137 lists MATH 127, but MATH 127 does not list it back, so this is
    // not evidence of equivalence.
    expect(index.canSubstitute({ subject: "MATH", catalogNumber: "127" }, { subject: "MATH", catalogNumber: "137" })).toBe(false);
  });

  it("does not make equivalence transitive beyond a direct mutual pair", () => {
    // 118 ↔ 138 and 118 ↔ 148 both hold, but 148 has no antirequisite entry of
    // its own, so nothing links it to 138 through 118.
    expect(index.canSubstitute({ subject: "MATH", catalogNumber: "148" }, { subject: "MATH", catalogNumber: "138" })).toBe(false);
  });

  it("always lets a course substitute for itself", () => {
    expect(index.canSubstitute({ subject: "ENGL", catalogNumber: "108" }, { subject: "ENGL", catalogNumber: "108" })).toBe(true);
  });

  it("lists the equivalents of a course", () => {
    const found = index.equivalentsOf({ subject: "MATH", catalogNumber: "138" }).map((l) => courseKey(l.course));
    expect(found).toContain("MATH 118");
  });
});

const program: DegreeProgram = {
  code: "TEST",
  name: "Test",
  faculty: "Mathematics",
  calendarYear: "2024-2025",
  source: { url: "https://example.invalid", retrieved: "2026-08-21", verified: false },
  totalUnits: 1.0,
  requirements: [
    {
      kind: "course",
      id: "r-math138",
      label: "MATH 138",
      anyOf: [{ subject: "MATH", catalogNumber: "138" }],
    },
  ],
};

describe("equivalence inside the degree audit", () => {
  it("satisfies a MATH 138 requirement with MATH 118", () => {
    const result = auditDegree(program, profileOf([attempt("MATH", "118")]), index);
    const requirement = result.requirements[0];

    expect(requirement.satisfied).toBe(true);
    expect(requirement.appliedCourses.map((a) => courseKey(a.course))).toEqual(["MATH 118"]);
  });

  it("labels the substitution rather than passing it off as an exact match", () => {
    const result = auditDegree(program, profileOf([attempt("MATH", "118")]), index);
    expect(result.mapping[0].category).toBe("equivalent");
    expect(result.mapping[0].appliedTo).toContain("MATH 138");
  });

  it("still reports an exact match as a direct match", () => {
    const result = auditDegree(program, profileOf([attempt("MATH", "138")]), index);
    expect(result.mapping[0].category).toBe("direct");
  });

  it("leaves the requirement unmet without an equivalence index", () => {
    const result = auditDegree(program, profileOf([attempt("MATH", "118")]));
    expect(result.requirements[0].satisfied).toBe(false);
  });
});

describe("direct matches are not mislabelled as substitutions", () => {
  const eitherProgram: DegreeProgram = {
    ...program,
    requirements: [
      {
        kind: "course",
        id: "r-math137",
        label: "MATH 137",
        // 137 and 147 are themselves mutual antirequisites, which is what made
        // an exact 137 look like a substitution for 147.
        anyOf: [
          { subject: "MATH", catalogNumber: "137" },
          { subject: "MATH", catalogNumber: "147" },
        ],
      },
    ],
  };

  const withPair = buildEquivalenceIndex([
    ...CATALOG,
    { subject: "MATH", catalogNumber: "147", requirements: "Antireq: MATH 137" },
    { subject: "MATH", catalogNumber: "137", requirements: "Antireq: MATH 147" },
  ]);

  it("calls an exact hit on a listed alternative a direct match", () => {
    const result = auditDegree(eitherProgram, profileOf([attempt("MATH", "137")]), withPair);
    expect(result.mapping[0].category).toBe("direct");
  });

  it("does not repeat the course name when the label already contains it", () => {
    const result = auditDegree(program, profileOf([attempt("MATH", "118")]), index);
    expect(result.mapping[0].appliedTo).toBe("MATH 138");
  });
});
