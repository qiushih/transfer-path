import { describe, expect, it } from "vitest";
import { FACULTIES, declarableProgramsOf, findFaculty, findProgram, rulesFor } from "@/data/faculties";
import { cfmInternalTransfer } from "@/data/rules/cfm-internal-transfer";
import { csDeclaration } from "@/data/rules/cs-declaration";
import { checkEligibility } from "./eligibility";
import { findGaps } from "./gaps";
import { recentCalendarYears } from "./terms";
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

describe("declaring a major is a different question from transferring", () => {
  const math = findFaculty("math");

  it("offers only majors that have a transcribed rule", () => {
    for (const program of declarableProgramsOf(math)) {
      expect(program.declarationRule).toBeDefined();
    }
  });

  it("does not offer 'Not decided yet' as something to declare", () => {
    // It exists so a transferring student can see faculty requirements alone;
    // there is nothing to declare.
    expect(declarableProgramsOf(math).map((p) => p.id)).not.toContain("undecided");
  });

  it("checks only the declaration rule, not the faculty transfer", () => {
    // A student already in Mathematics has cleared the faculty gate; repeating
    // it would bury the conditions that still apply to them.
    const cs = findProgram(math, "cs");
    const declaring = [cs.declarationRule!];
    const transferring = rulesFor(math, cs);

    expect(declaring.map((r) => r.id)).toEqual(["cs-declaration"]);
    expect(transferring.map((r) => r.id)).toContain("math-internal-transfer");
    expect(declaring.map((r) => r.id)).not.toContain("math-internal-transfer");
  });

  it("produces fewer gaps than the transfer route for the same student", () => {
    const cs = findProgram(math, "cs");
    const profile = profileOf({ currentProgram: "MATH-UNDECLARED", currentLevel: "1B" });

    const declareGaps = findGaps([checkEligibility(cs.declarationRule!, profile)], profile);
    const transferGaps = findGaps(
      rulesFor(math, cs).map((r) => checkEligibility(r, profile)),
      profile,
    );

    expect(declareGaps.length).toBeLessThan(transferGaps.length);
  });

  it("keeps every declarable major reachable from the Mathematics faculty", () => {
    const ids = declarableProgramsOf(math).map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(["cs", "co", "stat", "actsc", "datasci"]));
  });
});

describe("the per-course grade floor", () => {
  const eng = findFaculty("engineering");
  const rule = eng.transferRule;
  const floorRow = (p: AcademicProfile) =>
    checkEligibility(rule, p).evaluation.children?.find((c) => /Math and science grades/.test(c.requirement));

  const graded = (subject: string, catalogNumber: string, value: number) => ({
    course: { subject, catalogNumber },
    termCode: "1249",
    units: 0.5,
    grade: { kind: "numeric" as const, value },
  });

  it("fails on a single course below the floor, even with a high average", () => {
    // 95 and 65 average to 80, comfortably above the 75% cumulative bar, but
    // the 65 is exactly what Engineering says may deny an application.
    const row = floorRow(profileOf({ attempts: [graded("MATH", "137", 95), graded("PHYS", "121", 65)] }));
    expect(row?.status).toBe("unmet");
    expect(row?.actual).toContain("PHYS 121");
  });

  it("passes when every matching course clears the floor", () => {
    const row = floorRow(profileOf({ attempts: [graded("MATH", "137", 72), graded("CHEM", "120", 88)] }));
    expect(row?.status).toBe("met");
  });

  it("ignores courses the filter does not match", () => {
    // A low English grade is not a math or science grade.
    const row = floorRow(profileOf({ attempts: [graded("MATH", "137", 90), graded("ENGL", "109", 55)] }));
    expect(row?.status).toBe("met");
  });

  it("asks rather than deciding when a matching course has no numeric grade", () => {
    const row = floorRow(
      profileOf({
        attempts: [
          graded("MATH", "137", 90),
          {
            course: { subject: "PHYS", catalogNumber: "121" },
            termCode: "1249",
            units: 0.5,
            grade: { kind: "symbol" as const, value: "CR" },
          },
        ],
      }),
    );
    expect(row?.status).toBe("unknown");
  });

  it("asks rather than passing when there are no matching courses at all", () => {
    expect(floorRow(profileOf())?.status).toBe("unknown");
  });
});

describe("Engineering's 1A restart is surfaced, not buried", () => {
  const eng = findFaculty("engineering");

  it("makes restarting in 1A a condition the student must acknowledge", () => {
    const row = checkEligibility(eng.transferRule, profileOf()).evaluation.children?.find((c) =>
      /restart in 1A/.test(c.requirement),
    );
    expect(row).toBeDefined();
    expect(row?.missingInput).toContain("September");
  });

  it("routes non-SE Engineering programs through the faculty transfer", () => {
    const undecided = findProgram(eng, "undecided");
    expect(rulesFor(eng, undecided).map((r) => r.id)).toEqual(["engineering-internal-transfer"]);
  });
});

describe("Software Engineering entry points", () => {
  const eng = findFaculty("engineering");
  const se = findProgram(eng, "se");
  const rule = se.declarationRule!;

  const graded = (subject: string, catalogNumber: string, value = 92) => ({
    course: { subject, catalogNumber },
    termCode: "1249",
    units: 0.5,
    grade: { kind: "numeric" as const, value },
  });

  const entryRow = (p: AcademicProfile) =>
    checkEligibility(rule, p).evaluation.children?.find((c) => /entry point/.test(c.requirement));

  it("does not force the 1A restart, since 1B/2A/2B apply directly to the SE Director", () => {
    expect(se.requiresFacultyTransfer).toBe(false);
    expect(rulesFor(eng, se).map((r) => r.id)).toEqual(["se-internal-transfer"]);
  });

  it("accepts the shortest published course list as one valid entry point", () => {
    const row = entryRow(profileOf({ attempts: [graded("MATH", "117")] }));
    expect(row?.status).toBe("met");
  });

  it("accepts a later entry point's fuller course list", () => {
    const row = entryRow(
      profileOf({
        attempts: [
          graded("MATH", "135"),
          graded("STAT", "230"),
          graded("CS", "245"),
          graded("CS", "241"),
          graded("CS", "138"),
        ],
      }),
    );
    expect(row?.status).toBe("met");
  });

  it("reports no entry point when none of the lists is complete", () => {
    const row = entryRow(profileOf({ attempts: [graded("CS", "137")] }));
    expect(row?.status).toBe("unmet");
  });

  it("holds SE to its own averages rather than the faculty's", () => {
    const text = JSON.stringify(rule.condition);
    expect(text).toContain('"min":87');
    expect(text).toContain('"min":90');
    expect(text).not.toContain('"min":75');
  });

  it("flags the software-average subject list as approximate", () => {
    expect(JSON.stringify(rule.condition)).toContain("approximate");
  });
});

describe("calendar year options", () => {
  // Built from local components: `new Date("2026-09-01")` is parsed as UTC and
  // lands on 31 August in a western timezone, which is the boundary under test.
  const at = (y: number, monthIndex: number, day: number) => new Date(y, monthIndex, day);

  it("offers ten years, newest first", () => {
    const years = recentCalendarYears(10, at(2026, 7, 25));
    expect(years).toHaveLength(10);
    expect(years[0]).toBe("2026-2027");
    expect(years[9]).toBe("2017-2018");
  });

  it("formats each entry as a Waterloo calendar year", () => {
    for (const year of recentCalendarYears(10, at(2026, 7, 25))) {
      expect(year).toMatch(/^\d{4}-\d{4}$/);
      const [start, end] = year.split("-").map(Number);
      expect(end).toBe(start + 1);
    }
  });

  it("rolls over in September, when a new calendar year takes effect", () => {
    // August is still the previous year's calendar; September starts the next.
    expect(recentCalendarYears(1, at(2026, 7, 31))[0]).toBe("2026-2027");
    expect(recentCalendarYears(1, at(2026, 8, 1))[0]).toBe("2027-2028");
  });

  it("has no duplicates", () => {
    const years = recentCalendarYears(10, at(2026, 7, 25));
    expect(years).toHaveLength(new Set(years).size);
  });
});

describe("an unknown current program is not treated as 'not excluded'", () => {
  const science = findFaculty("science");

  it("asks instead of passing when no program is on file", () => {
    const row = checkEligibility(science.transferRule, profileOf({ currentProgram: "" }))
      .evaluation.children?.find((c) => /not eligible/.test(c.requirement));
    expect(row?.status).toBe("unknown");
    expect(row?.missingInput).toContain("PHARMACY");
  });

  it("still fails a student who is in an excluded program", () => {
    const row = checkEligibility(science.transferRule, profileOf({ currentProgram: "PHARMACY" }))
      .evaluation.children?.find((c) => /not eligible/.test(c.requirement));
    expect(row?.status).toBe("unmet");
  });

  it("passes a student in a program that is not excluded", () => {
    const row = checkEligibility(science.transferRule, profileOf({ currentProgram: "ARTS-ECON" }))
      .evaluation.children?.find((c) => /not eligible/.test(c.requirement));
    expect(row?.status).toBe("met");
  });
});

describe("Faculty of Arts transfer", () => {
  const arts = findFaculty("arts");
  const rule = arts.transferRule;
  const row = (p: AcademicProfile, match: RegExp) =>
    checkEligibility(rule, p).evaluation.children?.find((c) => match.test(c.requirement));

  const graded = (subject: string, catalogNumber: string, value: number) => ({
    course: { subject, catalogNumber },
    termCode: "1249",
    units: 0.5,
    grade: { kind: "numeric" as const, value },
  });

  it("keeps the Arts average and the overall average as separate gates", () => {
    // 62% in Arts courses clears the 60% overall bar but misses the 65% Arts one.
    const profile = profileOf({ attempts: [graded("ENGL", "109", 62), graded("PHIL", "145", 62)] });
    expect(row(profile, /Cumulative average/)?.status).toBe("met");
    expect(row(profile, /all Arts courses/)?.status).toBe("unmet");
  });

  it("passes a student who clears both", () => {
    const profile = profileOf({
      attempts: [graded("ENGL", "109", 72), graded("PHIL", "145", 70), graded("HIST", "101", 68)],
    });
    expect(row(profile, /all Arts courses/)?.status).toBe("met");
    expect(row(profile, /Arts course\(s\)/)?.status).toBe("met");
  });

  it("requires three Arts courses for the qualifying term", () => {
    const profile = profileOf({ attempts: [graded("ENGL", "109", 80)] });
    expect(row(profile, /Arts course\(s\)/)?.status).toBe("unmet");
  });

  it("does not let a non-Arts course count toward the Arts average", () => {
    const profile = profileOf({ attempts: [graded("MATH", "137", 95)] });
    // No Arts courses on file, so the Arts average cannot be computed.
    expect(row(profile, /all Arts courses/)?.status).toBe("unknown");
  });

  it("blocks a student who has failed a course in the qualifying term", () => {
    const profile = profileOf({
      attempts: [
        graded("ENGL", "109", 80),
        { ...graded("PHIL", "145", 30), grade: { kind: "symbol" as const, value: "NCR" } },
      ],
    });
    expect(row(profile, /failed course/)?.status).toBe("unmet");
  });
});

describe("Faculty of Environment defers to its schools", () => {
  const env = findFaculty("environment");

  it("states plainly that the faculty publishes no criteria of its own", () => {
    const report = checkEligibility(env.transferRule, profileOf());
    // Nothing is checkable at faculty level, so it can only report unknown.
    expect(report.overall).toBe("unknown");
    expect(JSON.stringify(report.evaluation)).toContain("school");
  });

  it("invents no faculty-level average", () => {
    const text = JSON.stringify(env.transferRule.condition);
    expect(text).not.toContain("cumulativeAverage");
    expect(text).not.toContain("filteredAverage");
  });

  it("checks the real ERS bar of 70% instead", () => {
    const ers = findProgram(env, "ers");
    const rule = ers.declarationRule!;
    const graded = (v: number) => ({
      course: { subject: "ENVS", catalogNumber: "195" },
      termCode: "1249",
      units: 0.5,
      grade: { kind: "numeric" as const, value: v },
    });

    const strong = checkEligibility(rule, profileOf({ attempts: [graded(75)] }));
    const weak = checkEligibility(rule, profileOf({ attempts: [graded(65)] }));

    expect(strong.evaluation.children?.[0].status).toBe("met");
    expect(weak.evaluation.children?.[0].status).toBe("unmet");
  });

  it("does not stack a faculty transfer on top of the ERS rule", () => {
    // The faculty has no criteria, so ERS is the whole requirement.
    const ers = findProgram(env, "ers");
    expect(rulesFor(env, ers).map((r) => r.id)).toEqual(["ers-transfer"]);
  });
});
