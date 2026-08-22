import { describe, expect, it } from "vitest";
import catalogData from "../data/catalog.json";
import { mathCsBcs } from "../data/programs/math-cs";
import { auditDegree } from "./audit";
import { courseKey } from "./grades";
import { buildPlan, findCandidates, type Catalog } from "./planner";
import type { AcademicProfile } from "./types";

const catalog = catalogData as Catalog;

const emptyProfile: AcademicProfile = {
  currentProgram: "SCI-BIO",
  calendarYear: "2026-2027",
  attempts: [],
  terms: [],
};

describe("a course is never proposed twice", () => {
  const audit = auditDegree(mathCsBcs, emptyProfile);
  const candidates = findCandidates(audit, catalog, emptyProfile);

  it("does not repeat a course that matches several unmet requirements", () => {
    // CS 341 is both a named requirement and a member of the CS 340-398 band,
    // which previously produced duplicate plan entries and duplicate React keys.
    const keys = candidates.map((c) => courseKey(c.course));
    expect(keys).toHaveLength(new Set(keys).size);
  });

  it("still proposes the named course rather than dropping it", () => {
    const keys = candidates.map((c) => courseKey(c.course));
    expect(keys).toContain("CS 341");
  });

  it("attributes a shared course to its most specific requirement", () => {
    // Program order puts the named CS 341 requirement before the upper-year
    // band, so the first match wins and the label names the specific one.
    const cs341 = candidates.find((c) => courseKey(c.course) === "CS 341");
    expect(cs341?.forRequirement).toContain("CS 341");
  });

  it("schedules each course at most once across the whole plan", () => {
    const plan = buildPlan(candidates, emptyProfile, "F");
    const scheduled = plan.terms.flatMap((t) => t.courses.map((c) => courseKey(c.course)));
    expect(scheduled).toHaveLength(new Set(scheduled).size);
  });
});
