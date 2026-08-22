import type { CourseAttempt, CourseRef, Grade } from "./types";

export const PASSING_GRADE = 50;

export function isFailure(grade: Grade): boolean {
  if (grade.kind === "numeric") return grade.value < PASSING_GRADE;
  return grade.value === "NCR" || grade.value === "WF";
}

/** An attempt that has concluded with a grade, pass or fail. */
export function isCompleted(attempt: CourseAttempt): boolean {
  if (attempt.grade.kind === "numeric") return true;
  return attempt.grade.value === "CR" || attempt.grade.value === "NCR" || attempt.grade.value === "AEG";
}

export function isPassed(attempt: CourseAttempt): boolean {
  return isCompleted(attempt) && !isFailure(attempt.grade);
}

/** Only numeric grades enter an average; CR/WD/IP carry no numeric weight. */
export function contributesToAverage(attempt: CourseAttempt): boolean {
  return attempt.grade.kind === "numeric" && attempt.supersededBy === undefined;
}

/**
 * Units-weighted mean, matching how UW computes a cumulative average.
 * Returns null when no attempt carries a numeric grade — the caller must
 * surface that as "unknown" rather than treating it as zero.
 */
export function weightedAverage(attempts: CourseAttempt[]): number | null {
  const scored = attempts.filter(contributesToAverage);
  if (scored.length === 0) return null;

  let weighted = 0;
  let units = 0;
  for (const attempt of scored) {
    if (attempt.grade.kind !== "numeric") continue;
    weighted += attempt.grade.value * attempt.units;
    units += attempt.units;
  }
  return units === 0 ? null : weighted / units;
}

export function courseKey(course: CourseRef): string {
  return `${course.subject.toUpperCase()} ${course.catalogNumber.toUpperCase()}`;
}

export function sameCourse(a: CourseRef, b: CourseRef): boolean {
  return courseKey(a) === courseKey(b);
}

/**
 * Declarative selector over the catalog, used by both eligibility rules
 * ("average of all math courses") and degree requirements ("2.0 units of
 * 300+ level CS"). Every populated field must match.
 */
export type CourseFilter = {
  subjects?: string[];
  /** Inclusive lower bound on the numeric part of the catalog number. */
  minLevel?: number;
  /** Exclusive upper bound on the numeric part of the catalog number. */
  maxLevel?: number;
  /** Explicit allow-list; when set, only these courses match. */
  anyOf?: CourseRef[];
  exclude?: CourseRef[];
};

/** Catalog numbers carry letter suffixes ("235A", "121L"); level ignores them. */
export function catalogLevel(catalogNumber: string): number | null {
  const digits = catalogNumber.match(/\d+/);
  return digits ? Number.parseInt(digits[0], 10) : null;
}

export function matchesFilter(course: CourseRef, filter: CourseFilter): boolean {
  if (filter.exclude?.some((c) => sameCourse(c, course))) return false;
  if (filter.anyOf && !filter.anyOf.some((c) => sameCourse(c, course))) return false;

  if (filter.subjects && !filter.subjects.some((s) => s.toUpperCase() === course.subject.toUpperCase())) {
    return false;
  }

  if (filter.minLevel !== undefined || filter.maxLevel !== undefined) {
    const level = catalogLevel(course.catalogNumber);
    if (level === null) return false;
    if (filter.minLevel !== undefined && level < filter.minLevel) return false;
    if (filter.maxLevel !== undefined && level >= filter.maxLevel) return false;
  }

  return true;
}

export function describeFilter(filter: CourseFilter): string {
  if (filter.anyOf) return filter.anyOf.map(courseKey).join(" / ");

  const parts: string[] = [];
  if (filter.minLevel !== undefined && filter.maxLevel !== undefined) {
    parts.push(`${filter.minLevel}–${filter.maxLevel - 1} level`);
  } else if (filter.minLevel !== undefined) {
    parts.push(`${filter.minLevel}+ level`);
  } else if (filter.maxLevel !== undefined) {
    parts.push(`below ${filter.maxLevel} level`);
  }
  parts.push(filter.subjects ? filter.subjects.join("/") : "any subject");
  return parts.join(" ");
}
