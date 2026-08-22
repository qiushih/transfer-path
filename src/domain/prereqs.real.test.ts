import { describe, expect, it } from "vitest";
import { checkPrereq, parseRequirements } from "./prereqs";
import { courseKey } from "./grades";
import type { AcademicProfile, CourseAttempt } from "./types";

/**
 * Verbatim `requirementsDescription` strings from the synced UW catalog.
 * These are the shapes that broke the first parser: grade gates written both
 * before and after the course, nested groups, and trailing enrolment
 * restrictions after a semicolon.
 */
const REAL = {
  cs136:
    "Prereq: One of CS 145, at least 90% in CS 115, at least 70% in CS 116, at least 60% in CS 135. Coreq: CS 136L. Antireq: CS 137, 138, 146, PHYS 239",
  math138:
    "Prereq: (MATH 116 or 117 or 127 with a grade of at least 70%) or MATH 137 with a grade of at least 60% or MATH 147. Antireq: MATH 118, 119, 128, 148",
  stat230:
    "Prereq: ((One of MATH 116, 117, 137, 147) with a minimum grade of 80%) or (MATH 128 with a minimum grade of 60%) or (one of MATH 118, 119, 138, 148); Honours Math or Math/Phys students only. Antireq: STAT 220, 240",
};

function attempt(subject: string, catalogNumber: string, value: number): CourseAttempt {
  return {
    course: { subject, catalogNumber },
    termCode: "1249",
    units: 0.5,
    grade: { kind: "numeric", value },
  };
}

function profileOf(attempts: CourseAttempt[]): AcademicProfile {
  return { currentProgram: "SCI-BIO", calendarYear: "2024-2025", attempts, terms: [] };
}

describe("real UW prerequisite strings", () => {
  it("keeps every alternative in MATH 138 instead of dropping the tail", () => {
    const { prerequisite } = parseRequirements(REAL.math138);
    const text = JSON.stringify(prerequisite);

    // The original parser lost MATH 137 and MATH 147 entirely.
    for (const catalogNumber of ["116", "117", "127", "137", "147"]) {
      expect(text).toContain(`"catalogNumber":"${catalogNumber}"`);
    }
  });

  it("satisfies MATH 138 for a student who has MATH 137 above the 60% gate", () => {
    const { prerequisite } = parseRequirements(REAL.math138);
    const check = checkPrereq(prerequisite, profileOf([attempt("MATH", "137", 82)]));
    expect(check.status).toBe("satisfied");
  });

  it("refuses MATH 138 when MATH 137 is passed but below the 60% gate", () => {
    const { prerequisite } = parseRequirements(REAL.math138);
    const check = checkPrereq(prerequisite, profileOf([attempt("MATH", "137", 55)]));
    expect(check.status).toBe("not-satisfied");
    expect(check.missing.map(courseKey)).toContain("MATH 137");
  });

  it("keeps all four CS 136 alternatives and honours their differing gates", () => {
    const { prerequisite } = parseRequirements(REAL.cs136);
    const text = JSON.stringify(prerequisite);
    for (const catalogNumber of ["145", "115", "116", "135"]) {
      expect(text).toContain(`"catalogNumber":"${catalogNumber}"`);
    }

    expect(checkPrereq(prerequisite, profileOf([attempt("CS", "135", 75)])).status).toBe("satisfied");
    // CS 135 needs 60%, but CS 115 needs 90% — the gates are not interchangeable.
    expect(checkPrereq(prerequisite, profileOf([attempt("CS", "135", 52)])).status).toBe("not-satisfied");
    expect(checkPrereq(prerequisite, profileOf([attempt("CS", "115", 95)])).status).toBe("satisfied");
    expect(checkPrereq(prerequisite, profileOf([attempt("CS", "115", 80)])).status).toBe("not-satisfied");
  });

  it("applies a group-level gate to each course inside the group", () => {
    const { prerequisite } = parseRequirements(REAL.stat230);
    // "(One of MATH 116, 117, 137, 147) with a minimum grade of 80%"
    const text = JSON.stringify(prerequisite);
    for (const catalogNumber of ["116", "117", "137", "147"]) {
      expect(text).toContain(`{"subject":"MATH","catalogNumber":"${catalogNumber}"},"minGrade":80`);
    }
  });

  it("lets a grade gate decide against the student even when a restriction is unverifiable", () => {
    const { prerequisite } = parseRequirements(REAL.stat230);
    // 75 misses every gate, so the trailing "Honours Math ... only" cannot rescue it.
    const check = checkPrereq(prerequisite, profileOf([attempt("MATH", "137", 75)]));
    expect(check.status).toBe("not-satisfied");
  });

  it("defers to the student when only an enrolment restriction is left open", () => {
    const { prerequisite } = parseRequirements(REAL.stat230);
    // The 80% gate is cleared, but "Honours Math or Math/Phys students only" is
    // a real restriction on a transfer applicant and must not be assumed away.
    const check = checkPrereq(prerequisite, profileOf([attempt("MATH", "137", 85)]));
    expect(check.status).toBe("needs-review");
    expect(check.unverified.join(" ")).toContain("students only");
  });

  it("separates the antirequisite list from the prerequisite expression", () => {
    const parsed = parseRequirements(REAL.math138);
    expect(parsed.antirequisite.map(courseKey)).toEqual([
      "MATH 118",
      "MATH 119",
      "MATH 128",
      "MATH 148",
    ]);
  });

  it("defers to the student when a gated course was taken credit/no-credit", () => {
    const { prerequisite } = parseRequirements(REAL.math138);
    const check = checkPrereq(
      prerequisite,
      profileOf([
        {
          course: { subject: "MATH", catalogNumber: "137" },
          termCode: "1249",
          units: 0.5,
          grade: { kind: "symbol", value: "CR" },
        },
      ]),
    );
    expect(check.status).toBe("needs-review");
    expect(check.unverified.join(" ")).toContain("MATH 137");
  });
});

describe("subject elision only continues a real course list", () => {
  it("does not turn a level reference into a phantom course", () => {
    // "or level at least 2A Software Engineering" previously produced MATH 2A,
    // inheriting the subject from earlier in the same sentence.
    const { prerequisite } = parseRequirements(
      "Prereq: MATH 135 or level at least 2A Software Engineering",
    );
    expect(JSON.stringify(prerequisite)).not.toContain('"catalogNumber":"2A"');
  });

  it("still elides the subject inside a genuine list", () => {
    const { prerequisite } = parseRequirements("Prereq: MATH 116, 117, 137, 147");
    const text = JSON.stringify(prerequisite);
    for (const catalogNumber of ["116", "117", "137", "147"]) {
      expect(text).toContain(`"catalogNumber":"${catalogNumber}"`);
    }
  });
});
