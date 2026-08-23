import { describe, expect, it } from "vitest";
import { FACULTIES, findFaculty, findProgram, rulesFor } from "@/data/faculties";
import { cfmInternalTransfer } from "@/data/rules/cfm-internal-transfer";
import { csDeclaration } from "@/data/rules/cs-declaration";
import { checkEligibility } from "./eligibility";
import type { AcademicLevel, AcademicProfile, SystemOfStudy } from "./types";

function profileOf(over: Partial<AcademicProfile> = {}): AcademicProfile {
  return {
    currentProgram: "SCI-BIO",
    calendarYear: "2026-2027",
    attempts: [],
    terms: [{ termCode: "1249", kind: "study" }],
    currentStanding: "good",
    ...over,
  };
}

function findRow(rule: typeof csDeclaration, profile: AcademicProfile, match: RegExp) {
  const report = checkEligibility(rule, profile);
  return report.evaluation.children?.find((c) => match.test(c.requirement));
}

describe("current level decides a rule instead of asking the student", () => {
  it("passes a student at or before the 2B cap", () => {
    for (const level of ["1A", "2A", "2B"] as AcademicLevel[]) {
      const row = findRow(csDeclaration, profileOf({ currentLevel: level }), /2B level/);
      expect(row?.status).toBe("met");
    }
  });

  it("fails a student past the cap", () => {
    const row = findRow(csDeclaration, profileOf({ currentLevel: "3A" }), /2B level/);
    expect(row?.status).toBe("unmet");
    expect(row?.actual).toContain("3A");
  });

  it("asks rather than guessing when the level is unknown", () => {
    const row = findRow(csDeclaration, profileOf(), /2B level/);
    expect(row?.status).toBe("unknown");
    expect(row?.missingInput).toBeDefined();
  });
});

describe("system of study decides CFM's co-op condition", () => {
  it("passes a co-op student", () => {
    const row = findRow(cfmInternalTransfer, profileOf({ systemOfStudy: "co-op" }), /co-op student/);
    expect(row?.status).toBe("met");
  });

  it("fails a regular student, since CFM is co-op only", () => {
    const row = findRow(cfmInternalTransfer, profileOf({ systemOfStudy: "regular" }), /co-op student/);
    expect(row?.status).toBe("unmet");
  });

  it("asks rather than guessing when it is unknown", () => {
    const row = findRow(cfmInternalTransfer, profileOf(), /co-op student/);
    expect(row?.status).toBe("unknown");
  });

  it("never silently passes an unanswered question", () => {
    // An absent answer must not read as a satisfied requirement.
    for (const system of [undefined, "regular"] as (SystemOfStudy | undefined)[]) {
      const row = findRow(cfmInternalTransfer, profileOf({ systemOfStudy: system }), /co-op student/);
      expect(row?.status).not.toBe("met");
    }
  });
});

describe("faculty and program are separate gates", () => {
  const math = findFaculty("math");

  it("requires both the faculty transfer and the declaration for Computer Science", () => {
    const cs = findProgram(math, "cs");
    const rules = rulesFor(math, cs);
    expect(rules.map((r) => r.id)).toEqual(["math-internal-transfer", "cs-declaration"]);
  });

  it("does not invent a faculty step for a program that admits directly", () => {
    // CFM's published route is a direct application from any Waterloo program.
    const cfm = findProgram(math, "cfm");
    expect(cfm.requiresFacultyTransfer).toBe(false);
    expect(rulesFor(math, cfm).map((r) => r.id)).toEqual(["cfm-internal-transfer"]);
  });

  it("shows only the faculty requirements when no program is chosen", () => {
    const undecided = findProgram(math, "undecided");
    expect(rulesFor(math, undecided).map((r) => r.id)).toEqual(["math-internal-transfer"]);
  });

  it("gives every faculty at least one program option to select", () => {
    for (const faculty of FACULTIES) {
      expect(faculty.programs.length).toBeGreaterThan(0);
    }
  });

  it("falls back to the first program when the id belongs to another faculty", () => {
    const science = findFaculty("science");
    // "cs" is a Mathematics program; selecting it under Science must not throw.
    expect(findProgram(science, "cs").id).toBe(science.programs[0].id);
  });
});
