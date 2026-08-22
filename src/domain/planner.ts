import type { AuditResult } from "./audit";
import { courseKey, matchesFilter, sameCourse } from "./grades";
import { checkPrereq, parseRequirements, type ParsedRequirements } from "./prereqs";
import type { AcademicProfile, CourseAttempt, CourseRef, TermSeason } from "./types";

export type CatalogCourse = {
  subject: string;
  catalogNumber: string;
  title: string;
  requirements: string | null;
  seasons: TermSeason[];
};

export type Catalog = {
  generatedAt: string;
  termsSampled: string[];
  courses: CatalogCourse[];
};

export type Candidate = {
  course: CourseRef;
  title: string;
  /** Which outstanding requirement this course would satisfy. */
  forRequirement: string;
  seasons: TermSeason[];
  parsed: ParsedRequirements;
  prereqStatus: "satisfied" | "not-satisfied" | "needs-review";
  missingPrereqs: CourseRef[];
  unverifiedPrereqs: string[];
};

function lookup(catalog: Catalog, course: CourseRef): CatalogCourse | undefined {
  return catalog.courses.find(
    (c) =>
      c.subject.toUpperCase() === course.subject.toUpperCase() &&
      c.catalogNumber.toUpperCase() === course.catalogNumber.toUpperCase(),
  );
}

/** Courses that would close the gaps the audit reported, with prereq status attached. */
export function findCandidates(
  audit: AuditResult,
  catalog: Catalog,
  profile: AcademicProfile,
  /** Cap per filter-based requirement, since "any 300-level CS" matches dozens. */
  perRequirementLimit = 8,
): Candidate[] {
  const taken = new Set(profile.attempts.map((a) => courseKey(a.course)));
  const candidates: Candidate[] = [];
  /**
   * One course can match several unmet requirements — CS 341 is both a named
   * requirement and a member of the CS 340-398 band — but taking it once fills
   * exactly one slot. Without this, the plan lists and schedules the same
   * course repeatedly. Requirements are visited in program order, so the first
   * match is the most specific one.
   */
  const proposed = new Set<string>();

  const describe = (entry: CatalogCourse, forRequirement: string): Candidate => {
    const course = { subject: entry.subject, catalogNumber: entry.catalogNumber };
    const parsed = parseRequirements(entry.requirements);
    const check = checkPrereq(parsed.prerequisite, profile);
    return {
      course,
      title: entry.title,
      forRequirement,
      seasons: entry.seasons,
      parsed,
      prereqStatus: check.status,
      missingPrereqs: check.missing,
      unverifiedPrereqs: check.unverified,
    };
  };

  for (const result of audit.requirements) {
    if (result.satisfied) continue;
    const requirement = result.requirement;

    if (requirement.kind === "course") {
      for (const option of requirement.anyOf) {
        if (taken.has(courseKey(option))) continue;
        if (proposed.has(courseKey(option))) continue;
        proposed.add(courseKey(option));
        const entry = lookup(catalog, option);
        candidates.push(
          entry
            ? describe(entry, requirement.label)
            : {
                course: option,
                title: "Not found in synced catalog",
                forRequirement: requirement.label,
                seasons: [],
                parsed: parseRequirements(null),
                prereqStatus: "needs-review",
                missingPrereqs: [],
                unverifiedPrereqs: ["Course not present in the synced catalog."],
              },
        );
      }
      continue;
    }

    const matching = catalog.courses
      .filter((c) => {
        const course = { subject: c.subject, catalogNumber: c.catalogNumber };
        const key = courseKey(course);
        return matchesFilter(course, requirement.filter) && !taken.has(key) && !proposed.has(key);
      })
      .slice(0, perRequirementLimit);

    for (const entry of matching) {
      proposed.add(courseKey(entry));
      candidates.push(describe(entry, requirement.label));
    }
  }

  return candidates;
}

export type PlannedTerm = {
  season: TermSeason;
  index: number;
  courses: Candidate[];
};

const SEASON_ORDER: TermSeason[] = ["F", "W", "S"];

function nextSeason(season: TermSeason): TermSeason {
  return SEASON_ORDER[(SEASON_ORDER.indexOf(season) + 1) % SEASON_ORDER.length];
}

/**
 * Places candidates into successive terms, only scheduling a course once its
 * parsed prerequisites are covered by the profile or an earlier planned term.
 * Courses with unparseable prerequisites are scheduled but flagged, because
 * the tool cannot prove they are blocked and should not silently hide them.
 */
export function buildPlan(
  candidates: Candidate[],
  profile: AcademicProfile,
  startSeason: TermSeason,
  coursesPerTerm = 5,
  maxTerms = 8,
): { terms: PlannedTerm[]; unschedulable: Candidate[] } {
  // One candidate per requirement: the plan needs a concrete choice, and the
  // first matching option is the cheapest defensible pick.
  const chosen: Candidate[] = [];
  const seenRequirement = new Set<string>();
  for (const candidate of candidates) {
    if (seenRequirement.has(candidate.forRequirement)) continue;
    seenRequirement.add(candidate.forRequirement);
    chosen.push(candidate);
  }

  const completed = new Set(profile.attempts.map((a) => courseKey(a.course)));
  const remaining = [...chosen];
  const terms: PlannedTerm[] = [];
  let season = startSeason;

  for (let index = 0; index < maxTerms && remaining.length > 0; index++) {
    const term: PlannedTerm = { season, index, courses: [] };
    const syntheticProfile: AcademicProfile = {
      ...profile,
      attempts: [...profile.attempts, ...syntheticAttempts(completed, profile)],
    };

    for (const candidate of [...remaining]) {
      if (term.courses.length >= coursesPerTerm) break;
      if (candidate.seasons.length > 0 && !candidate.seasons.includes(season)) continue;

      const check = checkPrereq(candidate.parsed.prerequisite, syntheticProfile);
      if (check.status === "not-satisfied") continue;

      term.courses.push(candidate);
      remaining.splice(remaining.indexOf(candidate), 1);
    }

    // Everything left needs a prerequisite from this term, so commit it before
    // planning the next one.
    for (const scheduled of term.courses) completed.add(courseKey(scheduled.course));
    if (term.courses.length > 0) terms.push(term);
    season = nextSeason(season);
  }

  return { terms, unschedulable: remaining };
}

/** Treats already-planned courses as passed when testing later terms' prereqs. */
function syntheticAttempts(completed: Set<string>, profile: AcademicProfile): CourseAttempt[] {
  const existing = new Set(profile.attempts.map((a) => courseKey(a.course)));
  return [...completed]
    .filter((key) => !existing.has(key))
    .map((key) => {
      const [subject, catalogNumber] = key.split(" ");
      return {
        course: { subject, catalogNumber },
        termCode: "planned",
        units: 0.5,
        grade: { kind: "numeric", value: 100 } as const,
      };
    });
}

export function isAlreadyTaken(profile: AcademicProfile, course: CourseRef): boolean {
  return profile.attempts.some((a) => sameCourse(a.course, course));
}
