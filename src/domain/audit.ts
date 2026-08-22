import { courseKey, describeFilter, isPassed, matchesFilter, sameCourse } from "./grades";
import {
  EMPTY_EQUIVALENCE,
  type EquivalenceIndex,
  type Substitution,
  type SubstitutionContext,
} from "./equivalence";
import { flattenRequirements, type DegreeProgram, type Requirement } from "./requirements";
import type { AcademicProfile, CourseAttempt, CourseRef } from "./types";

/**
 * A requirement is expanded into discrete slots so assignment becomes a
 * bipartite matching problem. Greedy assignment is wrong here: if MATH 137
 * is consumed by a generic "any math course" requirement, a specific
 * "MATH 137" requirement is left falsely unmet. Maximum matching cannot
 * make that mistake.
 */
type Slot = {
  requirementId: string;
  /** Index of this slot within its requirement, for multi-course requirements. */
  index: number;
  accepts: (attempt: CourseAttempt) => boolean;
  /** Named-course slots are reported as direct equivalents. */
  specific: boolean;
};

function expand(
  requirement: Exclude<Requirement, { kind: "group" }>,
  equivalence: EquivalenceIndex,
  context: (r: Exclude<Requirement, { kind: "group" }>) => SubstitutionContext,
): Slot[] {
  switch (requirement.kind) {
    case "course":
      return [
        {
          requirementId: requirement.id,
          index: 0,
          specific: true,
          // Exact matches, the requirement's own listed alternatives, and
          // verified substitutions only. Mere antirequisite overlap does not
          // fill the slot; it is reported separately as a lead to verify.
          accepts: (a) =>
            requirement.anyOf.some((c) => equivalence.satisfies(a.course, c, context(requirement))),
        },
      ];

    case "courses":
      return Array.from({ length: requirement.count }, (_, index) => ({
        requirementId: requirement.id,
        index,
        specific: false,
        accepts: (a: CourseAttempt) => matchesFilter(a.course, requirement.filter),
      }));

    case "units": {
      // Slots are an upper bound on how many courses can be needed. UW courses
      // are almost always 0.5 units; a 1.0-unit course fills two slots' worth of
      // units, so the units total is verified separately after matching.
      const slotCount = Math.ceil(requirement.units / 0.5);
      return Array.from({ length: slotCount }, (_, index) => ({
        requirementId: requirement.id,
        index,
        specific: false,
        accepts: (a: CourseAttempt) => matchesFilter(a.course, requirement.filter),
      }));
    }
  }
}

/**
 * Passed courses that overlap a required course without being an accepted
 * substitute. Surfacing these is the point of tracking overlap at all: a
 * student holding MATH 118 against a MATH 138 requirement should be told to
 * ask, not told they are done.
 */
function findPossibleSubstitutes(
  requirement: Extract<Requirement, { kind: "course" }>,
  passed: CourseAttempt[],
  equivalence: EquivalenceIndex,
  context: SubstitutionContext,
): PossibleSubstitute[] {
  const found: PossibleSubstitute[] = [];

  for (const target of requirement.anyOf) {
    for (const substitution of equivalence.possibleSubstitutesFor(target, context)) {
      const attempt = passed.find((a) => sameCourse(a.course, substitution.candidate));
      if (attempt) found.push({ attempt, forCourse: target, substitution });
    }
  }

  return found;
}

/**
 * Kuhn's algorithm. Slots are ordered most-restrictive-first only to reduce
 * the number of augmenting paths; maximum matching is order-independent.
 */
function maximumMatching(attempts: CourseAttempt[], slots: Slot[]): Map<number, number> {
  const eligible = slots.map((slot) =>
    attempts.map((attempt, i) => (slot.accepts(attempt) ? i : -1)).filter((i) => i >= 0),
  );

  const order = slots
    .map((_, i) => i)
    .sort((a, b) => eligible[a].length - eligible[b].length);

  const attemptToSlot = new Map<number, number>();

  const augment = (slotIndex: number, seen: Set<number>): boolean => {
    for (const attemptIndex of eligible[slotIndex]) {
      if (seen.has(attemptIndex)) continue;
      seen.add(attemptIndex);

      const heldBy = attemptToSlot.get(attemptIndex);
      if (heldBy === undefined || augment(heldBy, seen)) {
        attemptToSlot.set(attemptIndex, slotIndex);
        return true;
      }
    }
    return false;
  };

  for (const slotIndex of order) augment(slotIndex, new Set());
  return attemptToSlot;
}

export type RequirementResult = {
  requirement: Exclude<Requirement, { kind: "group" }>;
  satisfied: boolean;
  /** Courses assigned to this requirement by the matching. */
  appliedCourses: CourseAttempt[];
  /** What still has to be taken, phrased for the course planner. */
  remaining: string;
  /**
   * Courses the student has already passed that overlap a required course but
   * are not established as acceptable substitutes. These never satisfy the
   * requirement; they are leads to take to an advisor.
   */
  possibleSubstitutes: PossibleSubstitute[];
};

export type PossibleSubstitute = {
  attempt: CourseAttempt;
  /** The required course this might stand in for. */
  forCourse: CourseRef;
  substitution: Substitution;
};

export type CreditCategory =
  /** The requirement names this exact course. */
  | "exact"
  /** The requirement itself lists this course as an accepted alternative. */
  | "alternative"
  /** A curated or officially sourced substitution was applied. */
  | "verified-equivalent"
  /** Counts toward a requirement expressed as a filter. */
  | "requirement"
  /** Applies to the degree's free-elective unit total. */
  | "elective"
  /** Passed, but the target degree has no room for it. */
  | "unused";

export type CreditMapping = {
  attempt: CourseAttempt;
  category: CreditCategory;
  appliedTo?: string;
};

export type AuditResult = {
  program: DegreeProgram;
  requirements: RequirementResult[];
  mapping: CreditMapping[];
  unitsCompleted: number;
  unitsApplied: number;
  unitsRemaining: number;
};

export function auditDegree(
  program: DegreeProgram,
  profile: AcademicProfile,
  equivalence: EquivalenceIndex = EMPTY_EQUIVALENCE,
): AuditResult {
  const passed = profile.attempts.filter(isPassed);
  const leaves = flattenRequirements(program.requirements);

  const contextFor = (r: Exclude<Requirement, { kind: "group" }>): SubstitutionContext => ({
    programCode: program.code,
    requirementId: r.id,
    calendarYear: program.calendarYear,
  });

  const slots: Slot[] = [];
  for (const requirement of leaves) slots.push(...expand(requirement, equivalence, contextFor));

  const attemptToSlot = maximumMatching(passed, slots);

  const byRequirement = new Map<string, CourseAttempt[]>();
  for (const [attemptIndex, slotIndex] of attemptToSlot) {
    const id = slots[slotIndex].requirementId;
    const list = byRequirement.get(id) ?? [];
    list.push(passed[attemptIndex]);
    byRequirement.set(id, list);
  }

  const requirements: RequirementResult[] = leaves.map((requirement) => {
    const applied = byRequirement.get(requirement.id) ?? [];
    const appliedUnits = applied.reduce((sum, a) => sum + a.units, 0);

    switch (requirement.kind) {
      case "course": {
        const satisfied = applied.length >= 1;
        return {
          requirement,
          satisfied,
          appliedCourses: applied,
          remaining: satisfied ? "" : requirement.anyOf.map(courseKey).join(" or "),
          // Only worth raising while the requirement is still open.
          possibleSubstitutes: satisfied
            ? []
            : findPossibleSubstitutes(requirement, passed, equivalence, contextFor(requirement)),
        };
      }
      case "courses": {
        const short = requirement.count - applied.length;
        return {
          requirement,
          satisfied: short <= 0,
          appliedCourses: applied,
          remaining: short <= 0 ? "" : `${short} more ${describeFilter(requirement.filter)} course(s)`,
          possibleSubstitutes: [],
        };
      }
      case "units": {
        const short = requirement.units - appliedUnits;
        return {
          requirement,
          satisfied: short <= 0,
          appliedCourses: applied,
          remaining:
            short <= 0 ? "" : `${short.toFixed(1)} more units of ${describeFilter(requirement.filter)}`,
          possibleSubstitutes: [],
        };
      }
    }
  });

  const slotByAttempt = new Map<number, Slot>();
  for (const [attemptIndex, slotIndex] of attemptToSlot) {
    slotByAttempt.set(attemptIndex, slots[slotIndex]);
  }

  const requiredUnits = requirements.reduce((sum, r) => {
    if (r.requirement.kind === "units") return sum + r.requirement.units;
    if (r.requirement.kind === "courses") return sum + r.requirement.count * 0.5;
    return sum + 0.5;
  }, 0);
  let electiveRoom = Math.max(0, program.totalUnits - requiredUnits);

  const mapping: CreditMapping[] = passed.map((attempt, index) => {
    const slot = slotByAttempt.get(index);
    if (slot) {
      const requirement = leaves.find((r) => r.id === slot.requirementId);

      if (slot.specific && requirement?.kind === "course") {
        const listed = requirement.anyOf.some((c) => sameCourse(c, attempt.course));
        if (listed) {
          // The first entry is the course the requirement is named for; a hit
          // on any later entry is an alternative the requirement itself allows.
          const isPrimary = sameCourse(requirement.anyOf[0], attempt.course);
          return {
            attempt,
            category: isPrimary ? "exact" : "alternative",
            appliedTo: requirement.label,
          };
        }

        const stoodInFor = requirement.anyOf.find((c) =>
          equivalence.satisfies(attempt.course, c, contextFor(requirement)),
        );
        if (stoodInFor) {
          const label = requirement.label;
          const named = courseKey(stoodInFor);
          return {
            attempt,
            category: "verified-equivalent",
            appliedTo: label.includes(named) ? label : `${label} (counts as ${named})`,
          };
        }
      }

      return {
        attempt,
        category: slot.specific ? "exact" : "requirement",
        appliedTo: requirement?.label,
      };
    }
    if (electiveRoom >= attempt.units) {
      electiveRoom -= attempt.units;
      return { attempt, category: "elective", appliedTo: "Free electives" };
    }
    return { attempt, category: "unused" };
  });

  const unitsCompleted = passed.reduce((sum, a) => sum + a.units, 0);
  const unitsApplied = mapping
    .filter((m) => m.category !== "unused")
    .reduce((sum, m) => sum + m.attempt.units, 0);

  return {
    program,
    requirements,
    mapping,
    unitsCompleted,
    unitsApplied,
    unitsRemaining: Math.max(0, program.totalUnits - unitsApplied),
  };
}
