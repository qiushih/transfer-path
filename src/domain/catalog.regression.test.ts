import { describe, expect, it } from "vitest";
import catalog from "../data/catalog.json";
import { parseRequirements, type PrereqExpr } from "./prereqs";

/**
 * Runs the prerequisite parser over the whole synced catalog. This exists
 * because a case-insensitive subject pattern once turned ordinary prose into
 * course references - "Level at least 2A" parsed as a course in subject
 * "LEAST" - which is invisible in hand-written fixtures but obvious at scale.
 */
describe("prereq parser against the synced catalog", () => {
  const courses = catalog.courses as { subject: string; requirements: string | null }[];
  const synced = courses.length > 100;

  it.skipIf(!synced)("never invents a subject code that is not in the catalog", () => {
    const subjects = new Set(courses.map((c) => c.subject));
    // UW's own data contains these two oddities; they are not parser errors.
    const knownOddities = new Set(["LEVGE", "PHS"]);
    const invented = new Set<string>();

    const walk = (expr: PrereqExpr | null) => {
      if (!expr) return;
      if (expr.kind === "course" && !subjects.has(expr.course.subject)) {
        if (!knownOddities.has(expr.course.subject)) invented.add(expr.course.subject);
      }
      if (expr.kind === "and" || expr.kind === "or") expr.of.forEach(walk);
    };

    for (const course of courses) {
      if (!course.requirements) continue;
      const parsed = parseRequirements(course.requirements);
      walk(parsed.prerequisite);
      walk(parsed.corequisite);
    }

    expect([...invented]).toEqual([]);
  });

  it.skipIf(!synced)("parses without throwing on every requirement string", () => {
    let parsed = 0;
    for (const course of courses) {
      if (!course.requirements) continue;
      expect(() => parseRequirements(course.requirements!)).not.toThrow();
      parsed++;
    }
    expect(parsed).toBeGreaterThan(1000);
  });
});
