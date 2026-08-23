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

describe("Faculty of Mathematics majors", () => {
  const math = findFaculty("math");
  const ids = math.programs.map((p) => p.id);

  it("offers the majors a student would actually pick between", () => {
    expect(ids).toEqual(
      expect.arrayContaining(["cs", "datasci", "actsc", "co", "stat", "amath", "pmath", "cm", "mathec", "farm"]),
    );
  });

  it("cites a real Waterloo source and a retrieval date for every major", () => {
    for (const program of math.programs) {
      if (!program.declarationRule) continue;
      // CFM cites its own faculty page rather than the calendar, which is
      // where its transfer conditions are actually published.
      expect(program.declarationRule.source.url).toContain("uwaterloo.ca");
      expect(program.declarationRule.source.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("keeps program ids unique so selection cannot be ambiguous", () => {
    expect(ids).toHaveLength(new Set(ids).size);
  });
});

describe("majors differ from each other where the calendar says they do", () => {
  const math = findFaculty("math");
  const ruleFor = (id: string) => findProgram(math, id).declarationRule!;

  it("does not require CS 136L for Data Science, unlike Computer Science", () => {
    const cs = JSON.stringify(ruleFor("cs").condition);
    const ds = JSON.stringify(ruleFor("datasci").condition);
    expect(cs).toContain('"catalogNumber":"136L"');
    expect(ds).not.toContain('"catalogNumber":"136L"');
  });

  it("uses Computational Mathematics' 60% major average, not the usual 65%", () => {
    const cm = JSON.stringify(ruleFor("cm").condition);
    const co = JSON.stringify(ruleFor("co").condition);
    expect(cm).toContain('"min":60');
    expect(co).toContain('"min":65');
  });

  it("gates Actuarial Science on MTHEL 131", () => {
    expect(JSON.stringify(ruleFor("actsc").condition)).toContain('"subject":"MTHEL"');
  });

  it("keeps the Actuarial Science fallback for students with no major average yet", () => {
    const report = checkEligibility(
      ruleFor("actsc"),
      profileOf({
        attempts: Array.from({ length: 10 }, (_, i) => ({
          course: { subject: "MATH", catalogNumber: `1${30 + i}` },
          termCode: "1249",
          units: 0.5,
          grade: { kind: "numeric" as const, value: 75 },
        })),
      }),
    );
    const fallback = report.evaluation.children?.find((c) => /Major average of 70/.test(c.requirement));
    expect(fallback?.status).toBe("met");
  });

  it("separates the Mathematics and Economics averages for Mathematical Economics", () => {
    const rule = JSON.stringify(ruleFor("mathec").condition);
    expect(rule).toContain("Economics average");
    expect(rule).toContain('"subjects":["ECON"]');
  });
});

describe("majors with no declaration requirements say so plainly", () => {
  const math = findFaculty("math");

  it("reports only averages for Combinatorics and Optimization", () => {
    const rule = findProgram(math, "co").declarationRule!;
    const kinds = (rule.condition as { of: { kind: string }[] }).of.map((c) => c.kind);
    // The calendar states no course or level conditions for CO.
    expect(kinds).toEqual(["cumulativeAverage", "filteredAverage"]);
  });

  it("says in its notes that nothing further is required", () => {
    const rule = findProgram(math, "co").declarationRule!;
    expect(rule.notes?.join(" ")).toContain("no declaration requirements");
  });

  it("still leaves the faculty transfer in place for those majors", () => {
    const co = findProgram(math, "co");
    expect(rulesFor(math, co).map((r) => r.id)).toEqual(["math-internal-transfer", "co-declaration"]);
  });
});
