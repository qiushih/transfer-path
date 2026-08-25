import { seasonOfTerm, termCodeFor, yearOfTerm } from "./terms";
import type { CourseRef, TermCode, TermSeason } from "./types";

/**
 * Deep links into Waterloo's Schedule of Classes so a student can see whether
 * a recommended course actually has sections in the term the plan puts it in.
 *
 * The planner knows only which *seasons* a course has historically run in,
 * derived from sampled terms in the catalog sync. That is enough to order a
 * plan but says nothing about whether a section exists next term, or whether
 * it is already full. The schedule site is the only source for that, and it
 * publishes enrolment capacity and totals per section.
 *
 * The site's search form posts to a Perl CGI, but the CGI also accepts GET,
 * which is what makes a plain link possible - no server, no API key, and no
 * scraping. Verified 2026-08-22 against CS 136 and CS 136L.
 */

const SCHEDULE_CGI = "https://classes.uwaterloo.ca/cgi-bin/cgiwrap/infocour/salook.pl";

/** Chronological position of a term, so two terms can be compared. */
function termOrdinal(season: TermSeason, year: number): number {
  const withinYear: Record<TermSeason, number> = { W: 0, S: 1, F: 2 };
  return year * 3 + withinYear[season];
}

/** The term a date falls in: Winter Jan-Apr, Spring May-Aug, Fall Sep-Dec. */
export function currentTerm(now = new Date()): { season: TermSeason; year: number } {
  const month = now.getMonth();
  const season: TermSeason = month <= 3 ? "W" : month <= 7 ? "S" : "F";
  return { season, year: now.getFullYear() };
}

/** How many terms after the current one a term falls; negative means past. */
export function termsFromNow(code: TermCode, now = new Date()): number | null {
  const season = seasonOfTerm(code);
  const year = yearOfTerm(code);
  if (!season || year === null) return null;

  const current = currentTerm(now);
  return termOrdinal(season, year) - termOrdinal(current.season, current.year);
}

/**
 * Whether the Schedule of Classes is likely to have this term loaded.
 *
 * The site publishes a rolling window - when checked on 2026-08-22 it offered
 * Winter 2026 through Winter 2027, about two terms ahead. A term beyond that
 * returns "your query had no matches", which reads as "this course is not
 * offered" when it really means "the timetable is not out yet". Saying which
 * of the two it is matters more than hiding the link.
 */
export function isLikelyPublished(code: TermCode, now = new Date()): boolean {
  const ahead = termsFromNow(code, now);
  if (ahead === null) return false;
  return ahead >= -3 && ahead <= 2;
}

/** The soonest term a student could realistically enrol in. */
export function nextTermCode(now = new Date()): TermCode {
  const { season, year } = currentTerm(now);
  const order: TermSeason[] = ["W", "S", "F"];
  const index = order.indexOf(season);
  // Fall rolls into Winter of the following calendar year.
  return index === 2 ? termCodeFor("W", year + 1) : termCodeFor(order[index + 1], year);
}

/**
 * A link to this course's sections in one term. `level=under` selects the
 * undergraduate schedule; `cournum` accepts letter suffixes such as "136L".
 */
export function scheduleUrl(course: CourseRef, termCode: TermCode): string {
  const params = new URLSearchParams({
    level: "under",
    sess: termCode,
    subject: course.subject,
    cournum: course.catalogNumber,
  });
  return `${SCHEDULE_CGI}?${params.toString()}`;
}
