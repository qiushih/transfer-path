import { checkPrereq, parseRequirements, type PrereqExpr } from "./prereqs";
import { catalogLevel, courseKey, matchesFilter, weightedAverage } from "./grades";
import { lookupCourse, type Catalog, type CatalogCourse } from "./catalog";
import type { Condition, EligibilityReport } from "./eligibility";
import type { CourseFilter } from "./grades";
import type { AcademicProfile, CourseRef, Evaluation } from "./types";

/**
 * What stands between a student and applying to, or declaring, their target.
 *
 * This is the core question the planner answers, and it is narrower than a
 * degree audit on purpose: only conditions the transfer or declaration rules
 * actually state. Requirements that apply after admission are not gaps — the
 * student is not blocked by them, and listing them would drown the handful of
 * things that genuinely stop an application.
 *
 * Gaps are split by what a student can *do* about them, because the actions
 * are different: take a course, raise a grade average, wait a term, or go ask
 * somebody.
 */

export type CourseGap = {
  kind: "course";
  /** Which rule stage raised this, e.g. "Faculty of Mathematics". */
  stage: string;
  requirement: string;
  /** How many more courses matching the filter are needed. */
  count: number;
  filter: CourseFilter;
  minGrade?: number;
};

export type AverageGap = {
  kind: "average";
  stage: string;
  requirement: string;
  required: number;
  /** Null when the student has no graded courses that the filter matches. */
  actual: number | null;
};

/** Standing, study terms, exclusions, and anything needing a human. */
export type OtherGap = {
  kind: "other";
  stage: string;
  requirement: string;
  detail?: string;
  /** True when the tool could not decide, rather than deciding against. */
  needsInput: boolean;
};

export type Gap = CourseGap | AverageGap | OtherGap;

/**
 * Walks the condition tree and the evaluation tree together. They have the
 * same shape, so pairing them avoids matching requirements by their prose,
 * which produced both duplicates and two different phrasings of one gap.
 */
export function findGaps(reports: EligibilityReport[], profile: AcademicProfile): Gap[] {
  const gaps: Gap[] = [];

  const walk = (condition: Condition, evaluation: Evaluation, stage: string) => {
    // A satisfied branch is settled, including the alternatives of a met `any`.
    if (evaluation.status === "met") return;

    if (condition.kind === "all" || condition.kind === "any") {
      const children = evaluation.children ?? [];
      condition.of.forEach((child, i) => {
        const childEvaluation = children[i];
        if (childEvaluation) walk(child, childEvaluation, stage);
      });
      return;
    }

    switch (condition.kind) {
      case "completedCourses": {
        const have = profile.attempts.filter(
          (a) =>
            matchesFilter(a.course, condition.filter) &&
            (condition.minGrade === undefined ||
              (a.grade.kind === "numeric" && a.grade.value >= condition.minGrade)),
        ).length;
        gaps.push({
          kind: "course",
          stage,
          requirement: evaluation.requirement,
          count: Math.max(0, condition.min - have),
          filter: condition.filter,
          minGrade: condition.minGrade,
        });
        return;
      }

      case "filteredAverage": {
        const relevant = profile.attempts.filter((a) => matchesFilter(a.course, condition.filter));
        gaps.push({
          kind: "average",
          stage,
          requirement: evaluation.requirement,
          required: condition.min,
          actual: weightedAverage(relevant),
        });
        return;
      }

      case "cumulativeAverage": {
        gaps.push({
          kind: "average",
          stage,
          requirement: evaluation.requirement,
          required: condition.min,
          actual: weightedAverage(profile.attempts),
        });
        return;
      }

      default:
        // Standing, study terms, failures, exclusions, and manual checks: no
        // course selection can change these, so they are reported as-is.
        gaps.push({
          kind: "other",
          stage,
          requirement: evaluation.requirement,
          detail: evaluation.missingInput,
          needsInput: evaluation.status === "unknown",
        });
    }
  };

  for (const report of reports) {
    walk(report.rule.condition, report.evaluation, report.rule.targetProgram);
  }

  return gaps;
}

/**
 * A requirement the student must satisfy by choosing courses the rule does not
 * name. The tool ranks suggestions but deliberately stops short of committing
 * to them: which math course "counts" depends on advising knowledge that is
 * not in the calendar or the catalog.
 */
export type OpenChoice = {
  gap: CourseGap;
  suggestions: { course: CourseRef; title: string }[];
};

export function openChoices(
  gaps: Gap[],
  catalog: Catalog,
  profile: AcademicProfile,
  limit = 6,
): OpenChoice[] {
  const held = new Set(profile.attempts.map((a) => courseKey(a.course)));

  return gaps
    .filter((g): g is CourseGap => g.kind === "course" && g.count > 0 && !g.filter.anyOf)
    .map((gap) => ({
      gap,
      suggestions: rankOpenCourses(catalog, gap.filter, profile)
        .filter((c) => !held.has(courseKey(c)))
        .slice(0, limit)
        .map((course) => ({
          course,
          title: lookupCourse(catalog, course)?.title ?? "",
        })),
    }));
}

export type NeededCourse = {
  course: CourseRef;
  title: string;
  /**
   * Other courses that would have served the same purpose. A "one of" branch
   * has no reliable ranking in the data — CS 136 accepts CS 115, CS 135, or
   * CS 145, and which is right depends on the stream a student is in — so the
   * plan commits to one and shows the rest rather than hiding the choice.
   */
  alternatives: CourseRef[];
  /** The gap this closes, or the course it is a prerequisite for. */
  reason: string;
  /** True when the course is only here to unlock another one. */
  isPrerequisite: boolean;
  seasons: CatalogCourse["seasons"];
  parsed: ReturnType<typeof parseRequirements>;
  minGrade?: number;
};

/**
 * Turns course gaps into concrete courses, then pulls in the prerequisites
 * those courses need.
 *
 * The prerequisite expansion is what makes this an *earliest path* rather than
 * a shopping list. CS 136 is a declaration requirement; CS 135 is not, but a
 * student who has neither cannot reach CS 136 without it, so CS 135 belongs in
 * the plan. Only missing prerequisites are pulled in, and only through `or`
 * branches the student cannot already satisfy.
 */
/**
 * The smallest set of courses that would unlock `expr`.
 *
 * `checkPrereq` reports every course it looked for, which flattens an `or`:
 * CS 136 accepts "one of CS 145, CS 115, CS 116, CS 135", and adding all four
 * tells a student to take four courses where one will do. This walks the
 * expression instead and commits to a single branch of each `or`.
 */
function minimalPrereqChoice(
  expr: PrereqExpr | null,
  catalog: Catalog,
  chosen: Map<string, NeededCourse>,
  held: Set<string>,
): CourseRef[] {
  if (!expr) return [];

  switch (expr.kind) {
    case "opaque":
      // Nothing actionable — an enrolment restriction is not a course.
      return [];

    case "course": {
      const key = courseKey(expr.course);
      // Already held or already in the plan: this branch is covered.
      if (held.has(key) || chosen.has(key)) return [];
      return [expr.course];
    }

    case "and":
      return expr.of.flatMap((child) => minimalPrereqChoice(child, catalog, chosen, held));

    case "or": {
      const branches = expr.of.map((child) => ({
        courses: minimalPrereqChoice(child, catalog, chosen, held),
        gate: highestGate(child),
      }));
      const options = branches.map((b) => b.courses);
      // An option needing nothing means the student already satisfies this or.
      if (options.some((o) => o.length === 0)) return [];

      // Fewest courses wins. Among equals, prefer the one offered in more
      // terms: this is the *earliest* path, and CS 135 running every term
      // beats CS 145 running once a year even though both are one course.
      return branches.reduce((best, option) => {
        if (option.courses.length !== best.courses.length) {
          return option.courses.length < best.courses.length ? option : best;
        }
        const breadth =
          offeringBreadth(option.courses, catalog) - offeringBreadth(best.courses, catalog);
        if (breadth !== 0) return breadth > 0 ? option : best;
        // A missing gate is not evidence of an easier route — CS 145 states no
        // percentage simply because it is the advanced stream — so gates only
        // decide between branches that both state one.
        if (option.gate > 0 && best.gate > 0 && option.gate !== best.gate) {
          return option.gate < best.gate ? option : best;
        }
        // Still tied: the lower catalog number is the standard stream, so
        // CS 135 is proposed rather than CS 145 (Advanced Level).
        return lowestLevel(option.courses) < lowestLevel(best.courses) ? option : best;
      }, branches[0]).courses;
    }
  }
}

/**
 * Orders catalog matches by how soon a student could actually take them.
 *
 * A broad gap like "3 math courses" matches hundreds of courses, and taking
 * the first alphabetically proposes things like ACTSC 221 to a student aiming
 * at Computer Science. Since the question is the *earliest* route, a course
 * whose prerequisites are already met beats one that needs two terms of
 * build-up, and a course offered every term beats one offered annually.
 */
function rankOpenCourses(
  catalog: Catalog,
  filter: CourseFilter,
  profile: AcademicProfile,
): CourseRef[] {
  const matches = catalog.courses.filter(
    (c) =>
      matchesFilter({ subject: c.subject, catalogNumber: c.catalogNumber }, filter) &&
      isRealCourse(c),
  );

  return matches
    .map((c) => {
      const parsed = parseRequirements(c.requirements);
      const check = checkPrereq(parsed.prerequisite, profile);
      return {
        course: { subject: c.subject, catalogNumber: c.catalogNumber },
        blocked: check.status === "not-satisfied" ? check.missing.length : 0,
        seasons: c.seasons.length,
        level: catalogLevel(c.catalogNumber) ?? 999,
      };
    })
    .sort(
      (a, b) =>
        a.blocked - b.blocked || b.seasons - a.seasons || a.level - b.level,
    )
    .map((c) => c.course);
}

/** Every course named by a top-level `or`, so the student can see the real choice. */
function prereqAlternatives(expr: PrereqExpr | null, held: Set<string>): CourseRef[] {
  if (!expr || expr.kind !== "or") return [];
  const found: CourseRef[] = [];
  const visit = (node: PrereqExpr) => {
    if (node.kind === "course") {
      if (!held.has(courseKey(node.course))) found.push(node.course);
      return;
    }
    if (node.kind === "and" || node.kind === "or") node.of.forEach(visit);
  };
  expr.of.forEach(visit);
  return found;
}

/** The strictest grade gate anywhere in a branch, or 0 when it has none. */
function highestGate(expr: PrereqExpr): number {
  switch (expr.kind) {
    case "course":
      return expr.minGrade ?? 0;
    case "and":
    case "or":
      return Math.max(0, ...expr.of.map(highestGate));
    case "opaque":
      return 0;
  }
}

function lowestLevel(courses: CourseRef[]): number {
  return Math.min(...courses.map((c) => catalogLevel(c.catalogNumber) ?? 999), 999);
}

/** How widely a set of courses is offered, used to break ties between equal branches. */
function offeringBreadth(courses: CourseRef[], catalog: Catalog): number {
  return courses.reduce((sum, c) => sum + (lookupCourse(catalog, c)?.seasons.length ?? 0), 0);
}

/**
 * The catalog contains transfer-credit placeholders such as "ACTSC 1XX —
 * ACTSC Transfer Credit". They match subject filters but cannot be enrolled
 * in, so proposing one as the way to close a gap is useless advice.
 */
function isRealCourse(course: CatalogCourse): boolean {
  if (/XX/.test(course.catalogNumber)) return false;
  // Below 100 is pre-university at Waterloo (MATH 52 Pre-University Calculus),
  // which does not count toward a transfer requirement for a math course.
  const level = catalogLevel(course.catalogNumber);
  if (level !== null && level < 100) return false;
  // Administrative placeholders that match a subject filter but are not a
  // course a student can decide to enrol in.
  // Laurier cross-registrations are not a Waterloo student's normal route.
  return !/transfer credit|study abroad|exchange|work term|co-?op|\(WLU\)/i.test(course.title);
}

export function neededCourses(
  gaps: Gap[],
  catalog: Catalog,
  profile: AcademicProfile,
  maxDepth = 4,
): NeededCourse[] {
  const held = new Set(profile.attempts.map((a) => courseKey(a.course)));
  const chosen = new Map<string, NeededCourse>();

  const add = (
    course: CourseRef,
    reason: string,
    isPrerequisite: boolean,
    minGrade?: number,
    alternatives: CourseRef[] = [],
  ) => {
    const key = courseKey(course);
    if (held.has(key) || chosen.has(key)) return;
    const entry = lookupCourse(catalog, course);
    chosen.set(key, {
      course,
      title: entry?.title ?? "Not found in synced catalog",
      reason,
      isPrerequisite,
      alternatives,
      seasons: entry?.seasons ?? [],
      parsed: parseRequirements(entry?.requirements ?? null),
      minGrade,
    });
  };

  for (const gap of gaps) {
    if (gap.kind !== "course" || gap.count <= 0) continue;
    // Only requirements that name their courses are scheduled. A gap like
    // "3 math courses" matches hundreds of entries, and picking three of them
    // would dress an arbitrary choice up as advice; those are offered as a
    // shortlist instead. See `openChoices`.
    if (!gap.filter.anyOf) continue;

    let added = 0;
    for (const option of gap.filter.anyOf) {
      if (added >= gap.count) break;
      if (held.has(courseKey(option))) continue;
      const others = gap.filter.anyOf.filter(
        (o) => courseKey(o) !== courseKey(option) && !held.has(courseKey(o)),
      );
      add(option, gap.requirement, false, gap.minGrade, others);
      added += 1;
    }
  }

  // Expand prerequisites breadth-first so a chain like CS 135 -> CS 136 is
  // fully present before the plan tries to order it.
  for (let depth = 0; depth < maxDepth; depth++) {
    const pending = [...chosen.values()];
    let grew = false;

    for (const needed of pending) {
      const choice = minimalPrereqChoice(needed.parsed.prerequisite, catalog, chosen, held);
      const alternatives = prereqAlternatives(needed.parsed.prerequisite, held).filter(
        (c) => !choice.some((p) => courseKey(p) === courseKey(c)),
      );

      for (const missing of choice) {
        const key = courseKey(missing);
        if (held.has(key) || chosen.has(key)) continue;
        add(missing, `prerequisite for ${courseKey(needed.course)}`, true, undefined, alternatives);
        grew = true;
      }
    }

    if (!grew) break;
  }

  return [...chosen.values()];
}
