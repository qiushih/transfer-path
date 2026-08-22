import { describe, expect, it } from "vitest";
import { checkEligibility } from "./eligibility";
import { mathInternalTransfer } from "@/data/rules/math-internal-transfer";
import type { AcademicProfile, CourseAttempt, Grade } from "./types";

function attempt(subject: string, catalogNumber: string, grade: Grade, units = 0.5): CourseAttempt {
  return { course: { subject, catalogNumber }, termCode: "1249", units, grade };
}

function numeric(value: number): Grade {
  return { kind: "numeric", value };
}

function profileOf(overrides: Partial<AcademicProfile> = {}): AcademicProfile {
  return {
    currentProgram: "SCI-BIO",
    calendarYear: "2024-2025",
    attempts: [
      attempt("MATH", "137", numeric(82)),
      attempt("MATH", "135", numeric(78)),
      attempt("CS", "135", numeric(80)),
    ],
    terms: [{ termCode: "1245", kind: "study" }],
    currentStanding: "good",
    ...overrides,
  };
}

describe("Math internal transfer eligibility", () => {
  it("raises no blockers for a profile that clears every checkable threshold", () => {
    const report = checkEligibility(mathInternalTransfer, profileOf());

    expect(report.blockers).toHaveLength(0);
    // Two rules on the Math page cannot be verified from a transcript, so the
    // overall verdict stays `unknown` pending the student's confirmation
    // rather than claiming an eligibility the tool cannot establish.
    expect(report.overall).toBe("unknown");
    expect(report.unknowns.every((u) => u.requirement.match(/study term|2\+2/))).toBe(true);
  });

  it("flags a cumulative average below the cutoff as a blocker", () => {
    const report = checkEligibility(
      mathInternalTransfer,
      profileOf({
        attempts: [
          attempt("MATH", "137", numeric(60)),
          attempt("MATH", "135", numeric(62)),
          attempt("CS", "135", numeric(64)),
        ],
      }),
    );

    expect(report.overall).toBe("unmet");
    expect(report.blockers.map((b) => b.requirement)).toContain(
      "Cumulative average of at least 75%",
    );
  });

  it("does not invent a standing rule the Math page does not state", () => {
    const report = checkEligibility(mathInternalTransfer, profileOf({ currentStanding: undefined }));
    expect(report.blockers).toHaveLength(0);
  });

  it("counts NCR as a failure toward the two-failure limit", () => {
    const report = checkEligibility(
      mathInternalTransfer,
      profileOf({
        attempts: [
          attempt("MATH", "137", numeric(82)),
          attempt("MATH", "135", numeric(78)),
          attempt("CS", "135", numeric(80)),
          attempt("PHYS", "121", numeric(30)),
          attempt("CHEM", "120", numeric(20)),
          attempt("BIOL", "130", { kind: "symbol", value: "NCR" }),
        ],
      }),
    );

    const failureBlocker = report.blockers.find((b) => b.requirement.includes("failed"));
    expect(failureBlocker).toBeDefined();
    expect(failureBlocker?.actual).toContain("3");
  });

  it("blocks students who have not completed a full-time study term", () => {
    const report = checkEligibility(mathInternalTransfer, profileOf({ terms: [] }));
    expect(report.blockers.some((b) => b.requirement.includes("study term"))).toBe(true);
  });

  it("blocks excluded source programs", () => {
    const report = checkEligibility(mathInternalTransfer, profileOf({ currentProgram: "BASE" }));
    expect(report.blockers.some((b) => b.requirement.includes("BASE"))).toBe(true);
  });

  it("treats missing academic standing as unknown, never as ineligible", () => {
    const standingRule = {
      ...mathInternalTransfer,
      id: "standing-only",
      condition: { kind: "academicStanding" as const, allowed: ["good" as const] },
    };

    const unknown = checkEligibility(standingRule, profileOf({ currentStanding: undefined }));
    expect(unknown.overall).toBe("unknown");
    expect(unknown.blockers).toHaveLength(0);
    expect(unknown.unknowns[0].missingInput).toContain("Academic standing");

    const failing = checkEligibility(standingRule, profileOf({ currentStanding: "probation" }));
    expect(failing.overall).toBe("unmet");
  });

  it("excludes non-math courses from the math average", () => {
    const report = checkEligibility(
      mathInternalTransfer,
      profileOf({
        attempts: [
          attempt("MATH", "137", numeric(76)),
          attempt("MATH", "135", numeric(76)),
          attempt("CS", "135", numeric(76)),
          attempt("ENGL", "108", numeric(95)),
        ],
      }),
    );

    const mathAverage = report.evaluation.children?.find((c) =>
      c.requirement.includes("Average across math"),
    );
    expect(mathAverage?.actual).toContain("76.0%");
    expect(mathAverage?.actual).toContain("3 course(s)");
  });
});
