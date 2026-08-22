import { courseKey, sameCourse } from "./grades";
import { parseRequirements } from "./prereqs";
import type { CourseRef } from "./types";

/**
 * UW does not publish a course-equivalence table, but it publishes
 * antirequisites, and a *mutual* antirequisite is strong evidence of
 * equivalence: two courses that each forbid the other cover the same ground.
 * MATH 138 lists MATH 118 as an antirequisite and MATH 118 lists MATH 138, so
 * a student who took MATH 118 has satisfied a MATH 138 requirement.
 *
 * Only mutual edges are used. One-way edges outnumber mutual ones roughly two
 * to one and are mostly missing data on the other side, so treating them as
 * equivalence would hand out credit that does not exist.
 *
 * Equivalence is deliberately NOT made transitive. A ↔ B and B ↔ C does not
 * establish A ↔ C, and chaining through shared antirequisites would merge
 * whole families of loosely related courses into one bucket.
 */

export type EquivalenceSource = "curated" | "mutual-antirequisite";

export type EquivalenceLink = {
  course: CourseRef;
  source: EquivalenceSource;
};

type MinimalCatalogCourse = {
  subject: string;
  catalogNumber: string;
  requirements: string | null;
};

/**
 * Equivalences a human has confirmed, which the antirequisite data misses.
 * Each entry is symmetric. Prefer adding here over loosening the mutual rule.
 */
export const CURATED_EQUIVALENCES: CourseRef[][] = [];

export type EquivalenceIndex = {
  /** Courses that may stand in for `course`, excluding the course itself. */
  equivalentsOf(course: CourseRef): EquivalenceLink[];
  /** True when `candidate` can satisfy a requirement naming `target`. */
  canSubstitute(candidate: CourseRef, target: CourseRef): boolean;
  sourceFor(candidate: CourseRef, target: CourseRef): EquivalenceSource | null;
  size: number;
};

export function buildEquivalenceIndex(courses: MinimalCatalogCourse[]): EquivalenceIndex {
  const antirequisites = new Map<string, Set<string>>();

  for (const course of courses) {
    if (!course.requirements) continue;
    const key = courseKey(course);
    const parsed = parseRequirements(course.requirements);
    if (parsed.antirequisite.length === 0) continue;
    antirequisites.set(key, new Set(parsed.antirequisite.map(courseKey)));
  }

  const links = new Map<string, Map<string, EquivalenceSource>>();

  const link = (a: string, b: string, source: EquivalenceSource) => {
    if (a === b) return;
    const existing = links.get(a) ?? new Map<string, EquivalenceSource>();
    // A curated link outranks an inferred one when both exist.
    if (existing.get(a) !== "curated") existing.set(b, source);
    links.set(a, existing);
  };

  for (const [course, listed] of antirequisites) {
    for (const other of listed) {
      if (antirequisites.get(other)?.has(course)) {
        link(course, other, "mutual-antirequisite");
        link(other, course, "mutual-antirequisite");
      }
    }
  }

  for (const group of CURATED_EQUIVALENCES) {
    for (const a of group) {
      for (const b of group) {
        link(courseKey(a), courseKey(b), "curated");
      }
    }
  }

  const parse = (key: string): CourseRef => {
    const [subject, catalogNumber] = key.split(" ");
    return { subject, catalogNumber };
  };

  return {
    equivalentsOf(course) {
      const found = links.get(courseKey(course));
      if (!found) return [];
      return [...found.entries()].map(([key, source]) => ({ course: parse(key), source }));
    },
    canSubstitute(candidate, target) {
      if (sameCourse(candidate, target)) return true;
      return links.get(courseKey(target))?.has(courseKey(candidate)) ?? false;
    },
    sourceFor(candidate, target) {
      if (sameCourse(candidate, target)) return null;
      return links.get(courseKey(target))?.get(courseKey(candidate)) ?? null;
    },
    size: links.size,
  };
}

/** An index with no links, for callers that have no catalog available. */
export const EMPTY_EQUIVALENCE: EquivalenceIndex = {
  equivalentsOf: () => [],
  canSubstitute: (candidate, target) => sameCourse(candidate, target),
  sourceFor: () => null,
  size: 0,
};
