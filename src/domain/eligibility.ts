import {
  courseKey,
  describeFilter,
  isCompleted,
  isFailure,
  matchesFilter,
  weightedAverage,
  type CourseFilter,
} from "./grades";
import { EMPTY_EQUIVALENCE, type EquivalenceIndex } from "./equivalence";
import { levelRank } from "./types";
import type {
  AcademicLevel,
  AcademicProfile,
  AcademicStanding,
  CourseRef,
  Evaluation,
  EvaluationStatus,
  SystemOfStudy,
} from "./types";

/**
 * Conditions are data, not code, so a program's transfer rules can be
 * reviewed and updated by someone who is not a programmer, and diffed
 * when the faculty changes its cutoffs.
 */
export type Condition =
  | { kind: "cumulativeAverage"; min: number }
  | { kind: "filteredAverage"; filter: CourseFilter; min: number; label: string }
  | { kind: "completedCourses"; filter: CourseFilter; min: number; minGrade?: number; label: string }
  | { kind: "maxFailures"; max: number }
  | { kind: "academicStanding"; allowed: AcademicStanding[] }
  | { kind: "minStudyTerms"; min: number }
  | { kind: "systemOfStudy"; required: SystemOfStudy; note?: string }
  /**
   * A floor every matching course must clear individually, which an average
   * cannot express: Engineering may deny an applicant for a single math or
   * science grade below 70% even when their average is far above it.
   */
  | { kind: "minGradeInEvery"; filter: CourseFilter; min: number; label: string }
  /** Caps how late a student may apply, e.g. "not beyond the 2B level". */
  | { kind: "maxLevel"; max: AcademicLevel; note?: string }
  | { kind: "programExclusion"; programs: string[]; note: string }
  | { kind: "all"; label: string; of: Condition[] }
  | { kind: "any"; label: string; of: Condition[] }
  /** Escape hatch for rules the engine cannot check, e.g. "strong motivation". */
  | { kind: "manualCheck"; label: string; detail: string };

export type TransferRule = {
  /** Stable id, e.g. "math-internal-transfer". */
  id: string;
  targetProgram: string;
  /** Where these numbers came from, so a stale rule can be re-verified. */
  source: { url: string; retrieved: string };
  condition: Condition;
  notes?: string[];
};

function roundPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * A course counts if the filter matches it outright, or if a verified
 * substitution stands in for one of the courses the filter names.
 *
 * Equivalence belongs here rather than in a degree audit, because it changes
 * whether a student is *eligible*: a declaration rule naming CS 136 should
 * accept a course the department has confirmed as a substitute. Only verified
 * substitutions count — bare antirequisite overlap is content overlap, not
 * permission, and admitting it here would tell a student they can apply when
 * they cannot.
 */
function courseCounts(
  course: CourseRef,
  filter: CourseFilter,
  equivalence: EquivalenceIndex,
): boolean {
  if (matchesFilter(course, filter)) return true;
  if (!filter.anyOf) return false;
  return filter.anyOf.some((named) => equivalence.satisfies(course, named));
}

/** `unknown` dominates `unmet` only for reporting; a rule with any unmet child fails. */
function combineAll(children: Evaluation[]): EvaluationStatus {
  if (children.some((c) => c.status === "unmet")) return "unmet";
  if (children.some((c) => c.status === "unknown")) return "unknown";
  return "met";
}

function combineAny(children: Evaluation[]): EvaluationStatus {
  if (children.some((c) => c.status === "met")) return "met";
  if (children.some((c) => c.status === "unknown")) return "unknown";
  return "unmet";
}

export function evaluateCondition(
  condition: Condition,
  profile: AcademicProfile,
  equivalence: EquivalenceIndex = EMPTY_EQUIVALENCE,
): Evaluation {
  switch (condition.kind) {
    case "cumulativeAverage": {
      const average = weightedAverage(profile.attempts);
      if (average === null) {
        return {
          status: "unknown",
          requirement: `Cumulative average of at least ${condition.min}%`,
          missingInput: "No graded courses on file. Add courses with numeric grades.",
        };
      }
      return {
        status: average >= condition.min ? "met" : "unmet",
        requirement: `Cumulative average of at least ${condition.min}%`,
        actual: roundPct(average),
      };
    }

    case "filteredAverage": {
      const relevant = profile.attempts.filter((a) => matchesFilter(a.course, condition.filter));
      const average = weightedAverage(relevant);
      const requirement = `${condition.label} of at least ${condition.min}%`;
      if (average === null) {
        return {
          status: "unknown",
          requirement,
          missingInput: `No graded ${describeFilter(condition.filter)} courses on file.`,
        };
      }
      return {
        status: average >= condition.min ? "met" : "unmet",
        requirement,
        actual: `${roundPct(average)} over ${relevant.length} course(s)`,
      };
    }

    case "completedCourses": {
      const matching = profile.attempts.filter(
        (a) =>
          courseCounts(a.course, condition.filter, equivalence) &&
          isCompleted(a) &&
          !isFailure(a.grade) &&
          (condition.minGrade === undefined ||
            (a.grade.kind === "numeric" && a.grade.value >= condition.minGrade)),
      );
      const qualifier = condition.minGrade === undefined ? "" : ` with at least ${condition.minGrade}%`;
      return {
        status: matching.length >= condition.min ? "met" : "unmet",
        requirement: `At least ${condition.min} ${condition.label}${qualifier}`,
        actual:
          matching.length === 0
            ? "none on file"
            : `${matching.length}: ${matching.map((a) => courseKey(a.course)).join(", ")}`,
      };
    }

    case "maxFailures": {
      const failures = profile.attempts.filter((a) => isCompleted(a) && isFailure(a.grade));
      return {
        status: failures.length <= condition.max ? "met" : "unmet",
        requirement: `No more than ${condition.max} failed course(s) on record`,
        actual:
          failures.length === 0
            ? "none"
            : `${failures.length}: ${failures.map((a) => courseKey(a.course)).join(", ")}`,
      };
    }

    case "academicStanding": {
      const requirement = `Academic standing must be one of: ${condition.allowed.join(", ")}`;
      if (profile.currentStanding === undefined) {
        return {
          status: "unknown",
          requirement,
          missingInput: "Academic standing not provided. Enter it from your most recent term.",
        };
      }
      return {
        status: condition.allowed.includes(profile.currentStanding) ? "met" : "unmet",
        requirement,
        actual: profile.currentStanding,
      };
    }

    case "minStudyTerms": {
      const studyTerms = profile.terms.filter((t) => t.kind === "study");
      return {
        status: studyTerms.length >= condition.min ? "met" : "unmet",
        requirement: `At least ${condition.min} completed full-time study term(s) at Waterloo`,
        actual: `${studyTerms.length} study term(s)`,
      };
    }

    case "minGradeInEvery": {
      const requirement = `${condition.label}: every course at ${condition.min}% or higher`;
      const matching = profile.attempts.filter(
        (a) => matchesFilter(a.course, condition.filter) && isCompleted(a),
      );
      if (matching.length === 0) {
        return {
          status: "unknown",
          requirement,
          missingInput: `No completed ${describeFilter(condition.filter)} courses on file.`,
        };
      }
      // Only numeric grades can be compared against a floor; a CR pass is
      // indeterminate and defers to the student rather than failing them.
      const below = matching.filter(
        (a) => a.grade.kind === "numeric" && a.grade.value < condition.min,
      );
      const unknownGrades = matching.filter((a) => a.grade.kind !== "numeric");

      if (below.length > 0) {
        return {
          status: "unmet",
          requirement,
          actual: `below the floor: ${below.map((a) => courseKey(a.course)).join(", ")}`,
        };
      }
      if (unknownGrades.length > 0) {
        return {
          status: "unknown",
          requirement,
          missingInput: `No numeric grade for ${unknownGrades.map((a) => courseKey(a.course)).join(", ")}.`,
        };
      }
      return {
        status: "met",
        requirement,
        actual: `${matching.length} course(s) all at or above ${condition.min}%`,
      };
    }

    case "systemOfStudy": {
      const requirement = condition.note ?? `Enrolled in the ${condition.required} system of study`;
      if (profile.systemOfStudy === undefined) {
        return {
          status: "unknown",
          requirement,
          missingInput: "Tell the planner whether you are in co-op or the regular system.",
        };
      }
      return {
        status: profile.systemOfStudy === condition.required ? "met" : "unmet",
        requirement,
        actual: profile.systemOfStudy,
      };
    }

    case "maxLevel": {
      const requirement = condition.note ?? `Applying no later than the ${condition.max} level`;
      if (profile.currentLevel === undefined) {
        return {
          status: "unknown",
          requirement,
          missingInput: "Enter the level you are currently in, e.g. 2A.",
        };
      }
      return {
        status: levelRank(profile.currentLevel) <= levelRank(condition.max) ? "met" : "unmet",
        requirement,
        actual: `currently ${profile.currentLevel}`,
      };
    }

    case "programExclusion": {
      const excluded = condition.programs.some(
        (p) => p.toUpperCase() === profile.currentProgram.toUpperCase(),
      );
      return {
        status: excluded ? "unmet" : "met",
        requirement: condition.note,
        actual: `Current program: ${profile.currentProgram}`,
      };
    }

    case "all": {
      const children = condition.of.map((c) => evaluateCondition(c, profile, equivalence));
      return { status: combineAll(children), requirement: condition.label, children };
    }

    case "any": {
      const children = condition.of.map((c) => evaluateCondition(c, profile, equivalence));
      return { status: combineAny(children), requirement: condition.label, children };
    }

    case "manualCheck":
      return {
        status: "unknown",
        requirement: condition.label,
        missingInput: condition.detail,
      };
  }
}

export type EligibilityReport = {
  rule: TransferRule;
  overall: EvaluationStatus;
  evaluation: Evaluation;
  blockers: Evaluation[];
  unknowns: Evaluation[];
};

/**
 * Collects only what still stands in the student's way. A satisfied branch is
 * settled, so its unmet alternatives are skipped: CFM accepts CS 135 *or*
 * CS 115 + CS 116, and a student holding CS 135 is not blocked by the two
 * courses they did not take.
 */
function collectOutstanding(evaluation: Evaluation): Evaluation[] {
  if (evaluation.status === "met") return [];
  if (!evaluation.children || evaluation.children.length === 0) return [evaluation];
  return evaluation.children.flatMap(collectOutstanding);
}

export function checkEligibility(
  rule: TransferRule,
  profile: AcademicProfile,
  equivalence: EquivalenceIndex = EMPTY_EQUIVALENCE,
): EligibilityReport {
  const evaluation = evaluateCondition(rule.condition, profile, equivalence);
  const outstanding = collectOutstanding(evaluation);
  return {
    rule,
    overall: evaluation.status,
    evaluation,
    blockers: outstanding.filter((l) => l.status === "unmet"),
    unknowns: outstanding.filter((l) => l.status === "unknown"),
  };
}
