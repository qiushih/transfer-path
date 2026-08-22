import { courseKey } from "./grades";
import { checkPrereq } from "./prereqs";
import type { NeededCourse } from "./gaps";
import type { AcademicProfile, CourseAttempt, TermSeason } from "./types";

/**
 * Orders the courses a student still needs into terms, earliest first.
 *
 * The plan answers "what is the shortest route to being able to apply", so it
 * schedules only what the transfer or declaration rules require, plus the
 * prerequisites those courses depend on. It is not a path to graduation.
 */

export type PlannedTerm = {
  season: TermSeason;
  index: number;
  courses: NeededCourse[];
};

export type EligibilityPlan = {
  terms: PlannedTerm[];
  /** Needed courses that no term could accommodate, with the reason. */
  unschedulable: { course: NeededCourse; reason: string }[];
  /** Terms until the last required course is done, or null when nothing is needed. */
  termsToEligible: number | null;
};

const SEASON_ORDER: TermSeason[] = ["F", "W", "S"];

function nextSeason(season: TermSeason): TermSeason {
  return SEASON_ORDER[(SEASON_ORDER.indexOf(season) + 1) % SEASON_ORDER.length];
}

/** Treats already-planned courses as passed when testing later terms' prereqs. */
function syntheticAttempts(planned: Set<string>, profile: AcademicProfile): CourseAttempt[] {
  const existing = new Set(profile.attempts.map((a) => courseKey(a.course)));
  return [...planned]
    .filter((key) => !existing.has(key))
    .map((key) => {
      const [subject, catalogNumber] = key.split(" ");
      return {
        course: { subject, catalogNumber },
        termCode: "planned",
        units: 0.5,
        // A planned course is assumed passed well enough to clear any grade
        // gate on a later course; the plan is a route, not a prediction.
        grade: { kind: "numeric", value: 100 } as const,
      };
    });
}

export function planPath(
  needed: NeededCourse[],
  profile: AcademicProfile,
  startSeason: TermSeason,
  coursesPerTerm = 5,
  maxTerms = 6,
): EligibilityPlan {
  const planned = new Set<string>();
  const remaining = [...needed];
  const terms: PlannedTerm[] = [];
  let season = startSeason;

  for (let index = 0; index < maxTerms && remaining.length > 0; index++) {
    const term: PlannedTerm = { season, index, courses: [] };
    const synthetic: AcademicProfile = {
      ...profile,
      attempts: [...profile.attempts, ...syntheticAttempts(planned, profile)],
    };

    // Prerequisites first: they unlock the rest, so a term wasted on a course
    // that could have waited pushes the eligible date out.
    const ordered = [...remaining].sort(
      (a, b) => Number(b.isPrerequisite) - Number(a.isPrerequisite),
    );

    for (const course of ordered) {
      if (term.courses.length >= coursesPerTerm) break;
      if (course.seasons.length > 0 && !course.seasons.includes(season)) continue;
      if (checkPrereq(course.parsed.prerequisite, synthetic).status === "not-satisfied") continue;

      term.courses.push(course);
      remaining.splice(remaining.indexOf(course), 1);
    }

    for (const scheduled of term.courses) planned.add(courseKey(scheduled.course));
    if (term.courses.length > 0) terms.push(term);
    season = nextSeason(season);
  }

  const unschedulable = remaining.map((course) => {
    const check = checkPrereq(course.parsed.prerequisite, profile);
    if (check.status === "not-satisfied") {
      return {
        course,
        reason: `missing ${check.missing.map(courseKey).join(", ")}`,
      };
    }
    if (course.seasons.length > 0) {
      return { course, reason: `only offered in ${course.seasons.join("/")}` };
    }
    return { course, reason: "no term available within the planning horizon" };
  });

  return {
    terms,
    unschedulable,
    termsToEligible: terms.length === 0 ? null : terms.length,
  };
}
