import { courseKey, sameCourse } from "./grades";
import { parseRequirements } from "./prereqs";
import type { CourseRef } from "./types";

/**
 * How one course can stand in for another, in descending order of confidence.
 * The distinction matters because the four are *not* interchangeable evidence:
 *
 * - `exact`       — the student took the course the requirement names.
 * - `alternative` — the requirement itself lists this course as acceptable.
 * - `verified`    — an official source or a curated rule says the substitution
 *                   is accepted for this program.
 * - `overlap`     — UW's antirequisites show the two courses cover the same
 *                   ground. This proves *content overlap only*.
 *
 * An antirequisite says "you may not hold credit for both", which is a
 * statement about duplicate credit, not about whether a program will accept
 * one in place of the other. MATH 118 and MATH 138 are mutual antirequisites,
 * but a program that names MATH 138 is naming the Honours-stream course, and
 * only the department can say whether MATH 118 is accepted for it. So
 * `overlap` is surfaced as a lead to verify, never as a satisfied requirement.
 */
export type SubstitutionBasis = "exact" | "alternative" | "verified" | "overlap";

/** Bases that may mark a requirement satisfied. `overlap` is deliberately absent. */
export const SATISFYING_BASES: readonly SubstitutionBasis[] = ["exact", "alternative", "verified"];

export function canSatisfy(basis: SubstitutionBasis): boolean {
  return SATISFYING_BASES.includes(basis);
}

export type EquivalenceCitation = {
  /** Where the substitution was confirmed. */
  url?: string;
  /** Who confirmed it, or the wording used. */
  note?: string;
  /** ISO date the source was read. */
  retrieved?: string;
};

/**
 * Substitutions are rarely universal. A department may accept a swap for one
 * program and not another, or only for a given calendar year. An absent field
 * means "not scoped on this axis" rather than "applies to nothing".
 */
export type EquivalenceScope = {
  /** `DegreeProgram.code` values this applies to. */
  programCodes?: string[];
  /** `Requirement.id` values this applies to. */
  requirementIds?: string[];
  /** Calendar years, e.g. "2024-2025". */
  calendarYears?: string[];
};

export type SubstitutionContext = {
  programCode?: string;
  requirementId?: string;
  calendarYear?: string;
};

export type Substitution = {
  candidate: CourseRef;
  target: CourseRef;
  basis: SubstitutionBasis;
  citation?: EquivalenceCitation;
  scope?: EquivalenceScope;
};

/**
 * A manually verified substitution. Entries are directional by default:
 * `candidate` may be presented for `target`. Set `symmetric` when the
 * department accepts the swap both ways.
 */
export type CuratedEquivalence = {
  candidate: CourseRef;
  target: CourseRef;
  symmetric?: boolean;
  citation: EquivalenceCitation;
  scope?: EquivalenceScope;
};

/**
 * Manually verified substitutions. This list is the *only* way a substitution
 * that is not an exact match or a listed alternative can satisfy a
 * requirement, so entries must cite a real source. Adding a pair here is a
 * claim that a department accepts the swap — not merely that the courses
 * overlap, which the antirequisite data already tells us.
 */
export const CURATED_EQUIVALENCES: CuratedEquivalence[] = [];

type MinimalCatalogCourse = {
  subject: string;
  catalogNumber: string;
  requirements: string | null;
};

function scopeApplies(scope: EquivalenceScope | undefined, context: SubstitutionContext): boolean {
  if (!scope) return true;
  const matches = (allowed: string[] | undefined, actual: string | undefined) =>
    // An unscoped axis applies everywhere. A scoped axis with no value to
    // check against fails closed, because we cannot confirm it applies.
    allowed === undefined || (actual !== undefined && allowed.includes(actual));

  return (
    matches(scope.programCodes, context.programCode) &&
    matches(scope.requirementIds, context.requirementId) &&
    matches(scope.calendarYears, context.calendarYear)
  );
}

export type EquivalenceIndex = {
  /**
   * The strongest substitution linking `candidate` to `target`, or null.
   * Callers must check `basis` before treating it as satisfying; use
   * `satisfies` when that is all you need.
   */
  lookup(candidate: CourseRef, target: CourseRef, context?: SubstitutionContext): Substitution | null;
  /** True only for `exact` and `verified` links. Listed alternatives are the requirement's own business. */
  satisfies(candidate: CourseRef, target: CourseRef, context?: SubstitutionContext): boolean;
  /** Overlap-only links, which need human verification before they count. */
  possibleSubstitutesFor(target: CourseRef, context?: SubstitutionContext): Substitution[];
  size: number;
};

export function buildEquivalenceIndex(courses: MinimalCatalogCourse[]): EquivalenceIndex {
  const antirequisites = new Map<string, Set<string>>();

  for (const course of courses) {
    if (!course.requirements) continue;
    const parsed = parseRequirements(course.requirements);
    if (parsed.antirequisite.length === 0) continue;
    antirequisites.set(courseKey(course), new Set(parsed.antirequisite.map(courseKey)));
  }

  /** target key -> candidate key -> substitution */
  const byTarget = new Map<string, Map<string, Substitution>>();

  const add = (sub: Substitution) => {
    const targetKey = courseKey(sub.target);
    const candidateKey = courseKey(sub.candidate);
    if (targetKey === candidateKey) return;

    const forTarget = byTarget.get(targetKey) ?? new Map<string, Substitution>();
    const existing = forTarget.get(candidateKey);
    // A verified link always wins over inferred overlap.
    if (!existing || (existing.basis === "overlap" && sub.basis === "verified")) {
      forTarget.set(candidateKey, sub);
    }
    byTarget.set(targetKey, forTarget);
  };

  const parseKey = (key: string): CourseRef => {
    const [subject, catalogNumber] = key.split(" ");
    return { subject, catalogNumber };
  };

  // Mutual antirequisites only. One-way edges outnumber mutual ones roughly
  // two to one and are mostly missing data on the other side.
  for (const [course, listed] of antirequisites) {
    for (const other of listed) {
      if (!antirequisites.get(other)?.has(course)) continue;
      add({ candidate: parseKey(other), target: parseKey(course), basis: "overlap" });
      add({ candidate: parseKey(course), target: parseKey(other), basis: "overlap" });
    }
  }

  for (const entry of CURATED_EQUIVALENCES) {
    add({
      candidate: entry.candidate,
      target: entry.target,
      basis: "verified",
      citation: entry.citation,
      scope: entry.scope,
    });
    if (entry.symmetric) {
      add({
        candidate: entry.target,
        target: entry.candidate,
        basis: "verified",
        citation: entry.citation,
        scope: entry.scope,
      });
    }
  }

  return {
    lookup(candidate, target, context = {}) {
      if (sameCourse(candidate, target)) {
        return { candidate, target, basis: "exact" };
      }
      const found = byTarget.get(courseKey(target))?.get(courseKey(candidate));
      if (!found) return null;
      return scopeApplies(found.scope, context) ? found : null;
    },

    satisfies(candidate, target, context = {}) {
      if (sameCourse(candidate, target)) return true;
      const found = byTarget.get(courseKey(target))?.get(courseKey(candidate));
      if (!found || !canSatisfy(found.basis)) return false;
      return scopeApplies(found.scope, context);
    },

    possibleSubstitutesFor(target, context = {}) {
      const found = byTarget.get(courseKey(target));
      if (!found) return [];
      return [...found.values()].filter(
        (sub) => sub.basis === "overlap" && scopeApplies(sub.scope, context),
      );
    },

    size: byTarget.size,
  };
}

/** An index with no links, for callers that have no catalog available. */
export const EMPTY_EQUIVALENCE: EquivalenceIndex = {
  lookup: (candidate, target) =>
    sameCourse(candidate, target) ? { candidate, target, basis: "exact" } : null,
  satisfies: (candidate, target) => sameCourse(candidate, target),
  possibleSubstitutesFor: () => [],
  size: 0,
};
