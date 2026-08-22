import { describe, expect, it } from "vitest";
import { checkPrereq, parseRequirements } from "./prereqs";
import { courseKey } from "./grades";
import type { AcademicProfile, CourseAttempt } from "./types";

function attempt(subject: string, catalogNumber: string, value = 80): CourseAttempt {
  return {
    course: { subject, catalogNumber },
    termCode: "1249",
    units: 0.5,
    grade: { kind: "numeric", value },
  };
}

function profileOf(attempts: CourseAttempt[]): AcademicProfile {
  return {
    currentProgram: "SCI-BIO",
    calendarYear: "2024-2025",
    attempts,
    terms: [],
  };
}

describe("parseRequirements", () => {
  it("expands an omitted subject on later alternatives", () => {
    const parsed = parseRequirements("Prereq: MATH 137 or 147");
    expect(parsed.prerequisite).toEqual({
      kind: "or",
      of: [
        { kind: "course", course: { subject: "MATH", catalogNumber: "137" } },
        { kind: "course", course: { subject: "MATH", catalogNumber: "147" } },
      ],
    });
    expect(parsed.fullyParsed).toBe(true);
  });

  it("respects parentheses around alternatives", () => {
    const parsed = parseRequirements("Prereq: (MATH 135 or 145) and (MATH 137 or 147)");
    expect(parsed.prerequisite?.kind).toBe("and");
    expect(parsed.fullyParsed).toBe(true);
  });

  it("separates antirequisites into a flat course list", () => {
    const parsed = parseRequirements("Prereq: MATH 137; Antireq: MATH 116, MATH 117");
    expect(parsed.antirequisite.map(courseKey)).toEqual(["MATH 116", "MATH 117"]);
  });

  it("preserves a non-course clause instead of discarding it", () => {
    const parsed = parseRequirements("Prereq: Level at least 2A");
    expect(parsed.fullyParsed).toBe(false);
    expect(parsed.prerequisite).toEqual({ kind: "opaque", text: "Level at least 2A" });
  });

  it("returns an empty result for a course with no stated requirements", () => {
    expect(parseRequirements(null).prerequisite).toBeNull();
    expect(parseRequirements("").fullyParsed).toBe(true);
  });
});

describe("checkPrereq", () => {
  it("satisfies an or-branch when the student has either course", () => {
    const { prerequisite } = parseRequirements("Prereq: MATH 137 or 147");
    const check = checkPrereq(prerequisite, profileOf([attempt("MATH", "147")]));

    expect(check.status).toBe("satisfied");
    expect(check.missing).toHaveLength(0);
  });

  it("reports the specific missing course for an unmet and-branch", () => {
    const { prerequisite } = parseRequirements("Prereq: MATH 135 and MATH 137");
    const check = checkPrereq(prerequisite, profileOf([attempt("MATH", "135")]));

    expect(check.status).toBe("not-satisfied");
    expect(check.missing.map(courseKey)).toEqual(["MATH 137"]);
  });

  it("does not count a failed course as satisfying a prerequisite", () => {
    const { prerequisite } = parseRequirements("Prereq: MATH 137");
    const check = checkPrereq(prerequisite, profileOf([attempt("MATH", "137", 41)]));
    expect(check.status).toBe("not-satisfied");
  });

  it("asks for review rather than guessing on an unparseable clause", () => {
    const { prerequisite } = parseRequirements("Prereq: Level at least 2A");
    const check = checkPrereq(prerequisite, profileOf([]));

    expect(check.status).toBe("needs-review");
    expect(check.unverified).toEqual(["Level at least 2A"]);
  });

  it("treats a satisfied course as enough even when an opaque clause is or-ed with it", () => {
    const { prerequisite } = parseRequirements("Prereq: MATH 137 or department consent");
    const check = checkPrereq(prerequisite, profileOf([attempt("MATH", "137")]));
    expect(check.status).toBe("satisfied");
  });
});
