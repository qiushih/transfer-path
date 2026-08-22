import type { CourseRef, TermSeason } from "./types";

export type CatalogCourse = {
  subject: string;
  catalogNumber: string;
  title: string;
  /** Free-text prerequisite/antirequisite string, exactly as UW publishes it. */
  requirements: string | null;
  /** Seasons this course has actually run in, derived from sampled terms. */
  seasons: TermSeason[];
};

export type Catalog = {
  generatedAt: string;
  termsSampled: string[];
  courses: CatalogCourse[];
};

export function lookupCourse(catalog: Catalog, course: CourseRef): CatalogCourse | undefined {
  return catalog.courses.find(
    (c) =>
      c.subject.toUpperCase() === course.subject.toUpperCase() &&
      c.catalogNumber.toUpperCase() === course.catalogNumber.toUpperCase(),
  );
}
