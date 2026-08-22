import { describe, expect, it } from "vitest";
import { checkEligibility, type TransferRule } from "./eligibility";
import { CURATED_EQUIVALENCES, buildEquivalenceIndex, canSatisfy } from "./equivalence";
import { courseKey } from "./grades";
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

const MATH_118 = { subject: "MATH", catalogNumber: "118" };
const MATH_138 = { subject: "MATH", catalogNumber: "138" };

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

describe("substitution bases", () => {
  it("lets exact, alternative, and verified satisfy a requirement", () => {
    expect(canSatisfy("exact")).toBe(true);
    expect(canSatisfy("alternative")).toBe(true);
    expect(canSatisfy("verified")).toBe(true);
  });

  it("never lets bare antirequisite overlap satisfy a requirement", () => {
    expect(canSatisfy("overlap")).toBe(false);
  });
});

describe("mutual antirequisites are recorded as overlap only", () => {
  it("classifies MATH 118 against MATH 138 as overlap, not equivalence", () => {
    expect(index.lookup(MATH_118, MATH_138)?.basis).toBe("overlap");
  });

  it("does not treat that overlap as satisfying", () => {
    expect(index.satisfies(MATH_118, MATH_138)).toBe(false);
  });

  it("offers it as a possible substitute to verify", () => {
    const possible = index.possibleSubstitutesFor(MATH_138);
    expect(possible.map((s) => courseKey(s.candidate))).toContain("MATH 118");
  });

  it("is symmetric in both directions", () => {
    expect(index.lookup(MATH_138, MATH_118)?.basis).toBe("overlap");
  });

  it("ignores a one-way antirequisite entirely", () => {
    expect(index.lookup({ subject: "MATH", catalogNumber: "127" }, { subject: "MATH", catalogNumber: "137" })).toBeNull();
  });

  it("still satisfies a course against itself", () => {
    expect(index.satisfies(MATH_138, MATH_138)).toBe(true);
    expect(index.lookup(MATH_138, MATH_138)?.basis).toBe("exact");
  });
});

describe("curated equivalences", () => {
  const curated = [
    {
      candidate: MATH_118,
      target: MATH_138,
      citation: {
        url: "https://example.invalid/advisor-confirmation",
        note: "Math Undergrad Office confirmed MATH 118 is accepted for the MATH 138 requirement",
        retrieved: "2026-08-22",
      },
    },
  ];

  it("promotes a curated pair to a satisfying substitution", () => {
    CURATED_EQUIVALENCES.push(...curated);
    try {
      const withCurated = buildEquivalenceIndex(CATALOG);
      expect(withCurated.satisfies(MATH_118, MATH_138)).toBe(true);
      expect(withCurated.lookup(MATH_118, MATH_138)?.basis).toBe("verified");
    } finally {
      CURATED_EQUIVALENCES.length = 0;
    }
  });

  it("preserves the citation so the claim can be traced", () => {
    CURATED_EQUIVALENCES.push(...curated);
    try {
      const found = buildEquivalenceIndex(CATALOG).lookup(MATH_118, MATH_138);
      expect(found?.citation?.url).toBe("https://example.invalid/advisor-confirmation");
      expect(found?.citation?.retrieved).toBe("2026-08-22");
    } finally {
      CURATED_EQUIVALENCES.length = 0;
    }
  });

  it("is directional unless marked symmetric", () => {
    CURATED_EQUIVALENCES.push(...curated);
    try {
      const withCurated = buildEquivalenceIndex(CATALOG);
      // MATH 118 may be presented for MATH 138, but not the reverse.
      expect(withCurated.satisfies(MATH_138, MATH_118)).toBe(false);
    } finally {
      CURATED_EQUIVALENCES.length = 0;
    }
  });

  it("stops being a possible substitute once it is verified", () => {
    CURATED_EQUIVALENCES.push(...curated);
    try {
      const possible = buildEquivalenceIndex(CATALOG).possibleSubstitutesFor(MATH_138);
      expect(possible.map((s) => courseKey(s.candidate))).not.toContain("MATH 118");
    } finally {
      CURATED_EQUIVALENCES.length = 0;
    }
  });
});

describe("scoping a curated equivalence", () => {
  const scoped = [
    {
      candidate: MATH_118,
      target: MATH_138,
      citation: { note: "Accepted for this program only" },
      scope: { programCodes: ["MAT-CS-BCS"], calendarYears: ["2024-2025"] },
    },
  ];

  it("applies inside its scope", () => {
    CURATED_EQUIVALENCES.push(...scoped);
    try {
      const withScope = buildEquivalenceIndex(CATALOG);
      expect(
        withScope.satisfies(MATH_118, MATH_138, {
          programCode: "MAT-CS-BCS",
          calendarYear: "2024-2025",
        }),
      ).toBe(true);
    } finally {
      CURATED_EQUIVALENCES.length = 0;
    }
  });

  it("does not leak into another program", () => {
    CURATED_EQUIVALENCES.push(...scoped);
    try {
      const withScope = buildEquivalenceIndex(CATALOG);
      expect(
        withScope.satisfies(MATH_118, MATH_138, {
          programCode: "MAT-STAT-BMATH",
          calendarYear: "2024-2025",
        }),
      ).toBe(false);
    } finally {
      CURATED_EQUIVALENCES.length = 0;
    }
  });

  it("fails closed when the context does not say which program is being audited", () => {
    CURATED_EQUIVALENCES.push(...scoped);
    try {
      expect(buildEquivalenceIndex(CATALOG).satisfies(MATH_118, MATH_138, {})).toBe(false);
    } finally {
      CURATED_EQUIVALENCES.length = 0;
    }
  });
});

/**
 * Equivalence now matters at the eligibility stage rather than in a degree
 * audit: a declaration rule naming CS 136 should accept a confirmed substitute,
 * because that changes whether the student can apply at all.
 */
const ruleNaming138: TransferRule = {
  id: "test-rule",
  targetProgram: "Test program",
  source: { url: "https://example.invalid", retrieved: "2026-08-22" },
  condition: {
    kind: "completedCourses",
    label: "of MATH 138",
    min: 1,
    filter: { anyOf: [MATH_138] },
  },
};

describe("overlap inside an eligibility rule", () => {
  it("does not let MATH 118 satisfy a rule naming MATH 138", () => {
    const report = checkEligibility(ruleNaming138, profileOf([attempt("MATH", "118")]), index);
    expect(report.overall).toBe("unmet");
  });

  it("accepts the named course itself", () => {
    const report = checkEligibility(ruleNaming138, profileOf([attempt("MATH", "138")]), index);
    expect(report.overall).toBe("met");
  });

  it("accepts a curated substitute once it is verified", () => {
    CURATED_EQUIVALENCES.push({
      candidate: MATH_118,
      target: MATH_138,
      citation: { note: "Advisor confirmed for this rule" },
    });
    try {
      const withCurated = buildEquivalenceIndex(CATALOG);
      const report = checkEligibility(ruleNaming138, profileOf([attempt("MATH", "118")]), withCurated);
      expect(report.overall).toBe("met");
    } finally {
      CURATED_EQUIVALENCES.length = 0;
    }
  });

  it("ignores equivalence entirely when no index is supplied", () => {
    const report = checkEligibility(ruleNaming138, profileOf([attempt("MATH", "118")]));
    expect(report.overall).toBe("unmet");
  });
});
