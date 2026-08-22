/**
 * Builds the local course catalog from the UW Open Data API.
 *
 * Run with: UW_API_KEY=... npm run sync
 * Register for a key at https://openapi.data.uwaterloo.ca (POST /v3/Account/Register).
 *
 * Term availability is *derived*: the API has no "offered in" field, so a
 * course is treated as available in a season if it appeared in that season
 * in any of the terms sampled below.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const BASE = "https://openapi.data.uwaterloo.ca/v3";
const OUT = resolve(import.meta.dirname, "../src/data/catalog.json");

/** How many terms back to sample when deriving seasonal availability. */
const TERMS_SAMPLED = 9;

type ApiCourse = {
  courseId: string;
  subjectCode: string;
  catalogNumber: string;
  title: string;
  description: string | null;
  requirementsDescription: string | null;
  associatedAcademicOrgCode: string | null;
};

/**
 * Deliberately lean: this file is imported by a client component, so every
 * field ships to the browser. Course descriptions alone were 3.6MB of a 4.9MB
 * catalog and nothing renders them, so they are dropped at sync time. Adding
 * them back means serving them from a separate lazily-fetched file, not
 * widening this type.
 */
type CatalogCourse = {
  subject: string;
  catalogNumber: string;
  title: string;
  /** Free-text prerequisite/antirequisite string, exactly as UW publishes it. */
  requirements: string | null;
  /** Seasons this course has actually run in, derived from sampled terms. */
  seasons: ("F" | "W" | "S")[];
};

function apiKey(): string {
  const key = process.env.UW_API_KEY;
  if (!key) {
    console.error(
      "UW_API_KEY is not set.\n" +
        "Register at https://openapi.data.uwaterloo.ca, then run:\n" +
        "  UW_API_KEY=your-key npm run sync",
    );
    process.exit(1);
  }
  return key;
}

/**
 * Parameter properties are not erasable, and this script runs under
 * `node --experimental-strip-types`, so the field is assigned explicitly.
 */
class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function get<T>(path: string, key: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { headers: { "x-api-key": key } });
  if (!response.ok) {
    throw new HttpError(response.status, `GET ${path} failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

const SEASON_DIGIT = { W: "1", S: "5", F: "9" } as const;

function seasonOf(termCode: string): "F" | "W" | "S" | null {
  const digit = termCode.at(-1);
  if (digit === "1") return "W";
  if (digit === "5") return "S";
  if (digit === "9") return "F";
  return null;
}

/** UW term codes are (year - 1900) followed by a season digit: Fall 2024 is 1249. */
function termCode(year: number, season: keyof typeof SEASON_DIGIT): string {
  return `${year - 1900}${SEASON_DIGIT[season]}`;
}

function recentTerms(count: number): string[] {
  const now = new Date();
  const terms: string[] = [];
  let year = now.getFullYear();
  let seasons: (keyof typeof SEASON_DIGIT)[] = ["F", "S", "W"];

  while (terms.length < count) {
    for (const season of seasons) {
      const code = termCode(year, season);
      if (Number(code) <= Number(termCode(now.getFullYear(), "F")) && terms.length < count) {
        terms.push(code);
      }
    }
    year -= 1;
    seasons = ["F", "S", "W"];
  }
  return terms;
}

async function main() {
  const key = apiKey();
  const terms = recentTerms(TERMS_SAMPLED);
  console.log(`Sampling ${terms.length} terms: ${terms.join(", ")}`);

  const courses = new Map<string, CatalogCourse>();

  for (const term of terms) {
    let batch: ApiCourse[];
    try {
      batch = await get<ApiCourse[]>(`/Courses/${term}`, key);
    } catch (error) {
      // A rejected key fails identically on every term. Treating that as a
      // skip would "succeed" with zero courses and overwrite a good catalog.
      if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
        console.error(
          `\nUW rejected the API key (HTTP ${error.status}).\n` +
            "Check that UW_API_KEY holds a valid key; the catalog was left unchanged.",
        );
        process.exit(1);
      }
      // Future or unpublished terms return errors; they simply contribute nothing.
      console.warn(`  ${term}: skipped (${(error as Error).message})`);
      continue;
    }

    const season = seasonOf(term);
    for (const course of batch) {
      const id = `${course.subjectCode} ${course.catalogNumber}`;
      const existing = courses.get(id);

      if (existing) {
        if (season && !existing.seasons.includes(season)) existing.seasons.push(season);
        continue;
      }

      courses.set(id, {
        subject: course.subjectCode,
        catalogNumber: course.catalogNumber,
        title: course.title,
        requirements: course.requirementsDescription,
        seasons: season ? [season] : [],
      });
    }
    console.log(`  ${term}: ${batch.length} offerings, ${courses.size} distinct courses so far`);
  }

  // Every term could legitimately fail (network, an unpublished range). Writing
  // an empty catalog would silently discard the last good sync.
  if (courses.size === 0) {
    console.error("\nNo courses were returned by any sampled term; the catalog was left unchanged.");
    process.exit(1);
  }

  const catalog = {
    generatedAt: new Date().toISOString(),
    termsSampled: terms,
    courses: [...courses.values()].sort((a, b) =>
      `${a.subject}${a.catalogNumber}`.localeCompare(`${b.subject}${b.catalogNumber}`),
    ),
  };

  await mkdir(resolve(OUT, ".."), { recursive: true });
  // Minified: this is generated data that ships to the browser, not something
  // anyone reads by hand.
  await writeFile(OUT, JSON.stringify(catalog));
  console.log(`Wrote ${catalog.courses.length} courses to ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
