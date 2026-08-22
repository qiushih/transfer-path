import { describe, expect, it } from "vitest";
import { checkEligibility } from "./eligibility";
import { cfmInternalTransfer } from "@/data/rules/cfm-internal-transfer";
import type { AcademicProfile, CourseAttempt } from "./types";

function attempt(subject: string, catalogNumber: string, value: number): CourseAttempt {
  return { course: { subject, catalogNumber }, termCode: "1249", units: 0.5, grade: { kind: "numeric", value } };
}

function profileOf(attempts: CourseAttempt[]): AcademicProfile {
  return {
    currentProgram: "SCI-BIO",
    calendarYear: "2024-2025",
    attempts,
    terms: [{ termCode: "1245", kind: "study" }, { termCode: "1249", kind: "study" }],
    currentStanding: "good",
  };
}

describe("CFM alternative course sequences", () => {
  it("does not count the unused half of a satisfied either/or as a blocker", () => {
    // CS 135 satisfies the intro sequence, so CS 115 and CS 116 are moot.
    const report = checkEligibility(
      cfmInternalTransfer,
      profileOf([attempt("CS", "135", 88), attempt("MATH", "137", 82)]),
    );
    const labels = report.blockers.map((b) => b.requirement);
    expect(labels.some((l) => l.includes("CS 115"))).toBe(false);
    expect(labels.some((l) => l.includes("CS 116"))).toBe(false);
  });

  it("accepts CS 115 plus CS 116 in place of CS 135", () => {
    const report = checkEligibility(
      cfmInternalTransfer,
      profileOf([attempt("CS", "115", 88), attempt("CS", "116", 86), attempt("MATH", "137", 82)]),
    );
    const sequence = report.evaluation.children?.find((c) => c.requirement === "Introductory CS sequence");
    expect(sequence?.status).toBe("met");
  });

  it("blocks when neither intro path is complete", () => {
    const report = checkEligibility(cfmInternalTransfer, profileOf([attempt("CS", "115", 88)]));
    const sequence = report.evaluation.children?.find((c) => c.requirement === "Introductory CS sequence");
    expect(sequence?.status).toBe("unmet");
  });

  it("enforces the 80% cumulative bar", () => {
    const report = checkEligibility(cfmInternalTransfer, profileOf([attempt("CS", "135", 70)]));
    expect(report.blockers.map((b) => b.requirement)).toContain("Cumulative average of at least 80%");
  });
});
