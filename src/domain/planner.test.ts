import { describe, expect, it } from "vitest";
import { csDeclaration } from "../data/rules/cs-declaration";
import { mathInternalTransfer } from "../data/rules/math-internal-transfer";
import type { Catalog, CatalogCourse } from "./catalog";
import { checkEligibility } from "./eligibility";
import { findGaps, neededCourses, openChoices } from "./gaps";
import { courseKey } from "./grades";
import { planPath } from "./planner";
import type { AcademicProfile, CourseAttempt } from "./types";

/** Enough of the real CS chain to exercise prerequisite expansion. */
const CATALOG: Catalog = {
  generatedAt: "2026-08-22",
  termsSampled: ["1269"],
  courses: [
    {
      subject: "CS",
      catalogNumber: "135",
      title: "Designing Functional Programs",
      requirements: null,
      seasons: ["F", "W", "S"],
    },
    {
      subject: "CS",
      catalogNumber: "136",
      title: "Elementary Algorithm Design and Data Abstraction",
      requirements: "Prereq: One of CS 145, at least 60% in CS 135. Coreq: CS 136L",
      seasons: ["F", "W", "S"],
    },
    {
      subject: "CS",
      catalogNumber: "136L",
      title: "Tools and Techniques for Software Development",
      requirements: null,
      seasons: ["F", "W", "S"],
    },
    {
      subject: "CS",
      catalogNumber: "146",
      title: "Elementary Algorithm Design (Advanced)",
      requirements: "Prereq: CS 145",
      seasons: ["W"],
    },
  ],
};

function attempt(subject: string, catalogNumber: string, value = 80): CourseAttempt {
  return {
    course: { subject, catalogNumber },
    termCode: "1249",
    units: 0.5,
    grade: { kind: "numeric", value },
  };
}

function profileOf(attempts: CourseAttempt[], terms = 1): AcademicProfile {
  return {
    currentProgram: "MATH-UNDECLARED",
    calendarYear: "2026-2027",
    attempts,
    terms: Array.from({ length: terms }, (_, i) => ({ termCode: `124${i}`, kind: "study" as const })),
    currentStanding: "good",
  };
}

function pathFor(profile: AcademicProfile) {
  const gaps = findGaps([checkEligibility(csDeclaration, profile)], profile);
  const needed = neededCourses(gaps, CATALOG, profile);
  return { gaps, needed, plan: planPath(needed, profile, "F") };
}

describe("gaps are limited to declaration criteria", () => {
  const { gaps } = pathFor(profileOf([]));

  it("reports the courses the declaration rule names", () => {
    const courseGaps = gaps.filter((g) => g.kind === "course").map((g) => g.requirement);
    expect(courseGaps.some((g) => g.includes("CS 136 or CS 146"))).toBe(true);
    expect(courseGaps.some((g) => g.includes("CS 136L"))).toBe(true);
  });

  it("reports the two major averages as average gaps, not course gaps", () => {
    const averages = gaps.filter((g) => g.kind === "average").map((g) => g.requirement);
    expect(averages.some((g) => g.includes("math major average"))).toBe(true);
    expect(averages.some((g) => g.includes("CS major average"))).toBe(true);
  });

  it("does not invent graduation requirements", () => {
    // Nothing about upper-year CS, elective bands, degree units, or co-op
    // belongs in a declaration check.
    const text = gaps.map((g) => g.requirement).join(" ");
    expect(text).not.toMatch(/CS 34[01]|elective|20\.0 units|co-?op|PD ?\d/i);
  });
});

describe("earliest path pulls in prerequisites", () => {
  it("adds CS 135 even though the rule never names it", () => {
    // CS 136 is required; CS 135 is only a prerequisite, but a student with
    // neither cannot reach CS 136 without it.
    const { needed } = pathFor(profileOf([]));
    const keys = needed.map((n) => courseKey(n.course));
    expect(keys).toContain("CS 136");
    expect(keys).toContain("CS 135");
  });

  it("marks a pulled-in course as a prerequisite and says what it unlocks", () => {
    const { needed } = pathFor(profileOf([]));
    const cs135 = needed.find((n) => courseKey(n.course) === "CS 135");
    expect(cs135?.isPrerequisite).toBe(true);
    expect(cs135?.reason).toContain("CS 136");
  });

  it("schedules the prerequisite strictly before the course it unlocks", () => {
    const { plan } = pathFor(profileOf([]));
    const termOf = (key: string) =>
      plan.terms.findIndex((t) => t.courses.some((c) => courseKey(c.course) === key));
    expect(termOf("CS 135")).toBeGreaterThanOrEqual(0);
    expect(termOf("CS 135")).toBeLessThan(termOf("CS 136"));
  });

  it("does not pull in a prerequisite the student already holds", () => {
    const { needed } = pathFor(profileOf([attempt("CS", "135")]));
    expect(needed.map((n) => courseKey(n.course))).not.toContain("CS 135");
  });

  it("shortens the path as the student completes more of it", () => {
    const fromScratch = pathFor(profileOf([])).plan.terms.length;
    const withCs135 = pathFor(profileOf([attempt("CS", "135")])).plan.terms.length;
    expect(withCs135).toBeLessThan(fromScratch);
  });
});

describe("a satisfied requirement produces no work", () => {
  it("stops asking for CS 136L once it is held", () => {
    const { gaps } = pathFor(profileOf([attempt("CS", "136L")]));
    const courseGaps = gaps.filter((g) => g.kind === "course").map((g) => g.requirement);
    expect(courseGaps.some((g) => g.includes("CS 136L"))).toBe(false);
  });

  it("needs no courses at all once both are held", () => {
    const { needed } = pathFor(profileOf([attempt("CS", "136"), attempt("CS", "136L")]));
    expect(needed).toEqual([]);
  });
});

describe("each gap is reported once", () => {
  it("does not repeat a requirement or phrase it two ways", () => {
    const { gaps } = pathFor(profileOf([]));
    const keys = gaps.map((g) => `${g.stage}::${g.requirement}`);
    expect(keys).toHaveLength(new Set(keys).size);
  });

  it("skips the untaken alternatives of a satisfied either/or", () => {
    // Holding CS 136 settles "CS 136 or CS 146"; CS 146 is not a gap.
    const { gaps } = pathFor(profileOf([attempt("CS", "136")]));
    expect(gaps.map((g) => g.requirement).join(" ")).not.toContain("CS 146");
  });
});

describe("an either/or prerequisite costs one course, not all of them", () => {
  it("does not schedule every alternative of a one-of prerequisite", () => {
    // CS 136 accepts "one of CS 145, CS 115, CS 116, CS 135". Taking all four
    // is what a flattened missing-list produces, and it is wrong.
    const { needed } = pathFor(profileOf([]));
    const intro = needed
      .map((n) => courseKey(n.course))
      .filter((k) => ["CS 115", "CS 116", "CS 135", "CS 145"].includes(k));
    expect(intro).toHaveLength(1);
  });

  it("prefers the alternative offered in more terms", () => {
    // CS 135 runs every term in the fixture; CS 145 is not offered at all.
    const { needed } = pathFor(profileOf([]));
    expect(needed.map((n) => courseKey(n.course))).toContain("CS 135");
  });

  it("adds nothing when the student already satisfies one alternative", () => {
    const { needed } = pathFor(profileOf([attempt("CS", "135")]));
    const intro = needed
      .map((n) => courseKey(n.course))
      .filter((k) => ["CS 115", "CS 116", "CS 135", "CS 145"].includes(k));
    expect(intro).toEqual([]);
  });
});

describe("requirements that do not name courses are offered, not decided", () => {
  it("keeps an open requirement out of the scheduled terms", () => {
    // "3 math courses" matches hundreds of entries; committing three of them
    // into a term plan would present an arbitrary pick as advice.
    const gaps = findGaps([checkEligibility(mathInternalTransfer, profileOf([]))], profileOf([]));
    const needed = neededCourses(gaps, CATALOG, profileOf([]));
    expect(needed.map((n) => courseKey(n.course))).toEqual([]);
  });

  it("offers a ranked shortlist for it instead", () => {
    const profile = profileOf([]);
    const gaps = findGaps([checkEligibility(mathInternalTransfer, profile)], profile);
    const choices = openChoices(gaps, CATALOG, profile);
    expect(choices.length).toBeGreaterThan(0);
    expect(choices[0].gap.count).toBeGreaterThan(0);
  });
});

describe("choosing between prerequisite alternatives", () => {
  it("prefers the alternative with the lower grade gate", () => {
    // CS 136 accepts CS 135 at 60% or CS 115 at 90%. Sending a student down
    // the 90% route when a 60% route exists is bad advice.
    const catalog: Catalog = {
      ...CATALOG,
      courses: [
        ...CATALOG.courses,
        {
          subject: "CS",
          catalogNumber: "115",
          title: "Introduction to Computer Science 1",
          requirements: null,
          seasons: ["F", "W", "S"],
        } satisfies CatalogCourse,
      ].map((c): CatalogCourse =>
        c.catalogNumber === "136"
          ? { ...c, requirements: "Prereq: at least 90% in CS 115, at least 60% in CS 135" }
          : c,
      ),
    };
    const profile = profileOf([]);
    const gaps = findGaps([checkEligibility(csDeclaration, profile)], profile);
    const needed = neededCourses(gaps, catalog, profile).map((n) => courseKey(n.course));

    expect(needed).toContain("CS 135");
    expect(needed).not.toContain("CS 115");
  });
});

describe("alternatives are shown rather than hidden", () => {
  it("records the other courses a one-of prerequisite would accept", () => {
    const { needed } = pathFor(profileOf([]));
    const intro = needed.find((n) => n.isPrerequisite);
    expect(intro).toBeDefined();
    // CS 136 accepts several intro courses; the plan commits to one but must
    // not pretend the others do not exist.
    expect(intro!.alternatives.length).toBeGreaterThan(0);
  });

  it("does not list a course the student already holds as an alternative", () => {
    const { needed } = pathFor(profileOf([attempt("CS", "135")]));
    for (const course of needed) {
      expect(course.alternatives.map(courseKey)).not.toContain("CS 135");
    }
  });
});
