import { describe, expect, it } from "vitest";
import { mathCsBcs } from "./math-cs";
import { auditDegree } from "@/domain/audit";
import { courseKey, matchesFilter } from "@/domain/grades";
import { flattenRequirements } from "@/domain/requirements";
import type { AcademicProfile, CourseAttempt } from "@/domain/types";

/**
 * Pins the transcription to what the calendar actually says. These are not
 * engine tests — they exist so that editing the program file cannot quietly
 * drift away from the source it cites.
 */

const leaves = flattenRequirements(mathCsBcs.requirements);
const byId = new Map(leaves.map((r) => [r.id, r]));

function attempt(subject: string, catalogNumber: string, units = 0.5): CourseAttempt {
  return {
    course: { subject, catalogNumber },
    termCode: "1249",
    units,
    grade: { kind: "numeric", value: 80 },
  };
}

function profileOf(attempts: CourseAttempt[]): AcademicProfile {
  return { currentProgram: "SCI-BIO", calendarYear: "2026-2027", attempts, terms: [] };
}

describe("BCS program metadata", () => {
  it("cites the calendar page it was transcribed from", () => {
    expect(mathCsBcs.source.url).toContain("uwaterloo.ca/academic-calendar/undergraduate-studies");
    expect(mathCsBcs.source.retrieved).toBe("2026-08-22");
  });

  it("records the calendar year the requirements come from", () => {
    // The site served 2026-2027 as current on the retrieval date, while
    // 2025-2026 remained in effect until 2026-08-31.
    expect(mathCsBcs.calendarYear).toBe("2026-2027");
  });

  it("requires the 20.0 units the degree-level page states", () => {
    expect(mathCsBcs.totalUnits).toBe(20.0);
  });

  it("is marked verified now that it is calendar-sourced", () => {
    expect(mathCsBcs.source.verified).toBe(true);
  });
});

describe("required courses match the calendar", () => {
  it("lists the three unconditional CS courses", () => {
    expect(byId.get("cs-136l")?.kind).toBe("course");
    for (const id of ["cs-136l", "cs-341", "cs-350"]) {
      expect(byId.has(id)).toBe(true);
    }
  });

  it("accepts every stated alternative for the first CS course", () => {
    const requirement = byId.get("cs-first");
    expect(requirement?.kind === "course" && requirement.anyOf.map(courseKey)).toEqual([
      "CS 115",
      "CS 135",
      "CS 145",
    ]);
  });

  it("accepts the enriched variant of each core CS course", () => {
    for (const [id, expected] of [
      ["cs-240", ["CS 240", "CS 240E"]],
      ["cs-241", ["CS 241", "CS 241E"]],
      ["cs-245", ["CS 245", "CS 245E"]],
      ["cs-246", ["CS 246", "CS 246E"]],
      ["cs-251", ["CS 251", "CS 251E"]],
    ] as const) {
      const requirement = byId.get(id);
      expect(requirement?.kind === "course" && requirement.anyOf.map(courseKey)).toEqual(expected);
    }
  });

  it("accepts the non-honours calculus stream the calendar allows", () => {
    // MATH 127/128 are listed alongside 137/138 and 147/148.
    const calc1 = byId.get("math-calc1");
    expect(calc1?.kind === "course" && calc1.anyOf.map(courseKey)).toEqual([
      "MATH 127",
      "MATH 137",
      "MATH 147",
    ]);
  });

  it("requires both STAT 230-level and STAT 231-level courses", () => {
    expect(byId.has("stat-probability")).toBe(true);
    expect(byId.has("stat-statistics")).toBe(true);
  });
});

describe("upper-year CS bands", () => {
  const three = byId.get("cs-upper-3-courses");
  const two = byId.get("cs-upper-2");

  it("asks for three from CS 340-398 or CS 440-489", () => {
    expect(three?.kind === "courses" && three.count).toBe(3);
  });

  it("asks for two more restricted to CS 440-489", () => {
    expect(two?.kind === "courses" && two.count).toBe(2);
  });

  it("excludes CS 399, which is outside the stated band", () => {
    if (three?.kind !== "courses") throw new Error("expected a courses requirement");
    expect(matchesFilter({ subject: "CS", catalogNumber: "399" }, three.filter)).toBe(false);
    expect(matchesFilter({ subject: "CS", catalogNumber: "398" }, three.filter)).toBe(true);
  });

  it("does not let a 340-level course satisfy the 440-489 band", () => {
    if (two?.kind !== "courses") throw new Error("expected a courses requirement");
    expect(matchesFilter({ subject: "CS", catalogNumber: "341" }, two.filter)).toBe(false);
    expect(matchesFilter({ subject: "CS", catalogNumber: "486" }, two.filter)).toBe(true);
  });

  it("stops at CS 489, not CS 490", () => {
    if (two?.kind !== "courses") throw new Error("expected a courses requirement");
    expect(matchesFilter({ subject: "CS", catalogNumber: "489" }, two.filter)).toBe(true);
    expect(matchesFilter({ subject: "CS", catalogNumber: "490" }, two.filter)).toBe(false);
  });
});

describe("undergraduate communication requirement", () => {
  const first = byId.get("comm-list1");
  const second = byId.get("comm-second");

  it("restricts the first course to List 1", () => {
    if (first?.kind !== "courses") throw new Error("expected a courses requirement");
    expect(matchesFilter({ subject: "ENGL", catalogNumber: "109" }, first.filter)).toBe(true);
    // ENGL 119 is List 2, so it cannot be the first course.
    expect(matchesFilter({ subject: "ENGL", catalogNumber: "119" }, first.filter)).toBe(false);
  });

  it("lets the second course come from either list", () => {
    if (second?.kind !== "courses") throw new Error("expected a courses requirement");
    expect(matchesFilter({ subject: "ENGL", catalogNumber: "119" }, second.filter)).toBe(true);
    expect(matchesFilter({ subject: "COMMST", catalogNumber: "100" }, second.filter)).toBe(true);
  });

  it("records the 60% floor on the first List 1 course in its label", () => {
    expect(first?.label).toContain("60%");
  });
});

describe("auditing a partially complete student", () => {
  const result = auditDegree(
    mathCsBcs,
    profileOf([
      attempt("CS", "135"),
      attempt("CS", "136"),
      attempt("CS", "136L", 0.25),
      attempt("MATH", "137"),
      attempt("MATH", "138"),
      attempt("ENGL", "109"),
    ]),
  );

  it("credits the courses that were taken", () => {
    const satisfied = result.requirements.filter((r) => r.satisfied).map((r) => r.requirement.id);
    expect(satisfied).toEqual(
      expect.arrayContaining(["cs-first", "cs-136", "cs-136l", "math-calc1", "math-calc2", "comm-list1"]),
    );
  });

  it("still reports the courses that were not", () => {
    const unmet = result.requirements.filter((r) => !r.satisfied).map((r) => r.requirement.id);
    expect(unmet).toEqual(expect.arrayContaining(["cs-341", "cs-350", "cs-240", "stat-probability"]));
  });

  it("counts CS 136L as the quarter unit the calendar assigns it", () => {
    const applied = result.mapping.find((m) => courseKey(m.attempt.course) === "CS 136L");
    expect(applied?.attempt.units).toBe(0.25);
  });
});

describe("elective bands are marked as approximate", () => {
  it("says so in every elective label, since the subject lists are not transcribed", () => {
    for (const id of ["elective-arts", "elective-sci", "elective-additional"]) {
      expect(byId.get(id)?.label).toContain("approximate");
    }
  });

  it("still accepts the subject codes the calendar names outright", () => {
    const arts = byId.get("elective-arts");
    if (arts?.kind !== "units") throw new Error("expected a units requirement");
    for (const subject of ["BET", "BUS", "COMM", "STV"]) {
      expect(matchesFilter({ subject, catalogNumber: "101" }, arts.filter)).toBe(true);
    }
  });

  it("keeps the three bands separate rather than one 4.0-unit bucket", () => {
    const units = ["elective-arts", "elective-sci", "elective-additional"].map((id) => {
      const r = byId.get(id);
      return r?.kind === "units" ? r.units : 0;
    });
    expect(units).toEqual([1.0, 1.0, 2.0]);
  });
});
