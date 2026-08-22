import { describe, expect, it } from "vitest";
import { auditDegree } from "./audit";
import type { DegreeProgram } from "./requirements";
import type { AcademicProfile, CourseAttempt } from "./types";

function attempt(subject: string, catalogNumber: string, value = 80, units = 0.5): CourseAttempt {
  return {
    course: { subject, catalogNumber },
    termCode: "1249",
    units,
    grade: { kind: "numeric", value },
  };
}

function profileOf(attempts: CourseAttempt[]): AcademicProfile {
  return {
    currentProgram: "SCI-BIO",
    calendarYear: "2024-2025",
    attempts,
    terms: [{ termCode: "1249", kind: "study" }],
  };
}

const program: DegreeProgram = {
  code: "TEST",
  name: "Test Program",
  faculty: "Mathematics",
  calendarYear: "2024-2025",
  source: { url: "https://example.invalid", retrieved: "2026-08-21", verified: false },
  totalUnits: 2.0,
  requirements: [
    { kind: "course", id: "r-math137", label: "MATH 137", anyOf: [{ subject: "MATH", catalogNumber: "137" }] },
    {
      kind: "courses",
      id: "r-elective",
      label: "One MATH elective",
      count: 1,
      filter: { subjects: ["MATH"] },
    },
  ],
};

describe("auditDegree course assignment", () => {
  it("does not let a generic requirement consume a course a specific requirement needs", () => {
    // Greedy assignment that fills "One MATH elective" first would take
    // MATH 137 and report the named MATH 137 requirement as unmet.
    const result = auditDegree(program, profileOf([attempt("MATH", "137"), attempt("MATH", "239")]));

    const named = result.requirements.find((r) => r.requirement.id === "r-math137");
    const elective = result.requirements.find((r) => r.requirement.id === "r-elective");

    expect(named?.satisfied).toBe(true);
    expect(named?.appliedCourses[0].course.catalogNumber).toBe("137");
    expect(elective?.satisfied).toBe(true);
    expect(elective?.appliedCourses[0].course.catalogNumber).toBe("239");
  });

  it("reports a named course as an exact match and a filtered match as a requirement match", () => {
    const result = auditDegree(program, profileOf([attempt("MATH", "137"), attempt("MATH", "239")]));

    const byCourse = new Map(result.mapping.map((m) => [m.attempt.course.catalogNumber, m.category]));
    expect(byCourse.get("137")).toBe("exact");
    expect(byCourse.get("239")).toBe("requirement");
  });

  it("excludes failed courses from satisfying requirements", () => {
    const result = auditDegree(program, profileOf([attempt("MATH", "137", 42)]));
    expect(result.requirements.find((r) => r.requirement.id === "r-math137")?.satisfied).toBe(false);
  });

  it("categorises surplus courses as elective while room remains, then unused", () => {
    // 2.0 total units less 1.0 of named requirements leaves 1.0 of elective
    // room, so the first two surplus courses fit and the third does not.
    const result = auditDegree(
      program,
      profileOf([
        attempt("MATH", "137"),
        attempt("MATH", "239"),
        attempt("ENGL", "108"),
        attempt("PHIL", "145"),
        attempt("HIST", "102"),
      ]),
    );

    const categories = result.mapping.map((m) => m.category);
    expect(categories.filter((c) => c === "elective")).toHaveLength(2);
    expect(categories.filter((c) => c === "unused")).toHaveLength(1);
    expect(result.unitsCompleted).toBe(2.5);
    expect(result.unitsApplied).toBe(2.0);
  });

  it("states what is still outstanding for an unmet requirement", () => {
    const result = auditDegree(program, profileOf([]));
    expect(result.requirements.find((r) => r.requirement.id === "r-math137")?.remaining).toBe("MATH 137");
    expect(result.unitsRemaining).toBe(2.0);
  });
});
