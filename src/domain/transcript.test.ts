import { describe, expect, it } from "vitest";
import { editRow, importableRows, mergeAttempts, parseTranscript, toAttempt } from "./transcript";
import { courseKey } from "./grades";
import type { CourseAttempt } from "./types";

/** The tabular shape Quest produces when the course table is copied out. */
const QUEST = `
University of Waterloo
Unofficial Transcript

Program: Honours Science

Fall 2024
Course      Description                            Attempted  Earned  Grade
MATH 137    Calculus 1 for Honours Mathematics     0.50       0.50    82
CS 135      Designing Functional Programs          0.50       0.50    88
BIOL 130    Cell Biology                           0.50       0.50    76
Term Average: 82.00    Term Units: 1.50

Winter 2025
MATH 138    Calculus 2 for Honours Mathematics     0.50       0.50    71
CS 136      Elementary Algorithm Design            0.50       0.50    CR
ENGL 109    Introduction to Academic Writing       0.50       0.00    NCR
`;

describe("parsing a Quest transcript", () => {
  const parsed = parseTranscript(QUEST);

  it("reads every course row", () => {
    expect(parsed.rows.map((r) => courseKey(r.course))).toEqual([
      "MATH 137",
      "CS 135",
      "BIOL 130",
      "MATH 138",
      "CS 136",
      "ENGL 109",
    ]);
  });

  it("assigns each course to the term heading above it", () => {
    const byCourse = new Map(parsed.rows.map((r) => [courseKey(r.course), r.termCode]));
    expect(byCourse.get("MATH 137")).toBe("1249"); // Fall 2024
    expect(byCourse.get("MATH 138")).toBe("1251"); // Winter 2025
  });

  it("reads numeric grades without confusing them with the units columns", () => {
    const math137 = parsed.rows.find((r) => courseKey(r.course) === "MATH 137");
    expect(math137?.grade).toEqual({ kind: "numeric", value: 82 });
    expect(math137?.units).toBe(0.5);
  });

  it("keeps non-numeric grades as symbols rather than dropping them", () => {
    const cs136 = parsed.rows.find((r) => courseKey(r.course) === "CS 136");
    expect(cs136?.grade).toEqual({ kind: "symbol", value: "CR" });
    const engl = parsed.rows.find((r) => courseKey(r.course) === "ENGL 109");
    expect(engl?.grade).toEqual({ kind: "symbol", value: "NCR" });
  });

  it("does not mistake a number inside a course title for a grade", () => {
    // "Calculus 1 for Honours Mathematics" ends in text, and the title itself
    // contains a 1 that must not be read as a 1% grade.
    const math137 = parsed.rows.find((r) => courseKey(r.course) === "MATH 137");
    expect(math137?.grade).toEqual({ kind: "numeric", value: 82 });
    expect(math137?.title).toContain("Calculus 1");
  });

  it("picks up the program name", () => {
    expect(parsed.program).toBe("Honours Science");
  });

  it("records the terms it saw", () => {
    expect(parsed.terms.map((t) => t.termCode)).toEqual(["1249", "1251"]);
    expect(parsed.terms.every((t) => t.kind === "study")).toBe(true);
  });

  it("ignores summary and header lines", () => {
    expect(parsed.rows.some((r) => /Term Average/i.test(r.raw))).toBe(false);
    expect(parsed.unreadable).toEqual([]);
  });

  it("marks clean rows as high confidence", () => {
    expect(parsed.rows.every((r) => r.confidence === "high")).toBe(true);
  });
});

describe("transcript shapes that go wrong", () => {
  it("flags a course that appears before any term heading", () => {
    const parsed = parseTranscript("MATH 137 Calculus 1  0.50  0.50  82");
    expect(parsed.rows[0].termCode).toBeNull();
    expect(parsed.rows[0].confidence).toBe("low");
    expect(parsed.warnings.join(" ")).toContain("no term heading");
  });

  it("does not silently invent a grade for an in-progress course", () => {
    const parsed = parseTranscript("Fall 2026\nCS 341 Algorithms  0.50  0.00  IP");
    expect(parsed.rows[0].grade).toEqual({ kind: "symbol", value: "IP" });
    expect(parsed.warnings.join(" ")).toContain("in progress");
  });

  it("rejects an out-of-range percentage instead of importing it", () => {
    const parsed = parseTranscript("Fall 2024\nMATH 137 Calculus  0.50  0.50  820");
    expect(parsed.rows[0].grade).toBeNull();
    expect(parsed.rows[0].issues.join(" ")).toContain("not a percentage");
  });

  it("keeps a row with no grade out of the importable set", () => {
    const parsed = parseTranscript("Fall 2024\nMATH 137 Calculus 1 for Honours Mathematics");
    expect(importableRows(parsed.rows)).toEqual([]);
  });

  it("does not turn description prose into a course code", () => {
    const parsed = parseTranscript("Fall 2024\nTotal transfer credits 2.50 granted");
    expect(parsed.rows).toEqual([]);
  });

  it("handles a work term heading without treating it as a study term", () => {
    const parsed = parseTranscript("Winter 2025 - Co-op Work Term\n");
    expect(parsed.terms[0]).toEqual({ termCode: "1251", kind: "work" });
  });

  it("warns rather than failing when nothing parses", () => {
    const parsed = parseTranscript("this is not a transcript");
    expect(parsed.rows).toEqual([]);
    expect(parsed.warnings.join(" ")).toContain("No courses were recognised");
  });

  it("assumes half a unit but says so when the units column is missing", () => {
    const parsed = parseTranscript("Fall 2024\nMATH 137 Calculus 82");
    expect(parsed.rows[0].units).toBe(0.5);
    expect(parsed.rows[0].issues.join(" ")).toContain("assuming 0.5");
    expect(parsed.rows[0].confidence).toBe("low");
  });
});

describe("merging an import into an existing profile", () => {
  const existing: CourseAttempt[] = [
    {
      course: { subject: "MATH", catalogNumber: "137" },
      termCode: "1249",
      units: 0.5,
      grade: { kind: "numeric", value: 60 },
    },
  ];

  it("replaces the same course in the same term rather than duplicating it", () => {
    const parsed = parseTranscript(QUEST);
    const incoming = importableRows(parsed.rows).map(toAttempt).filter((a) => a !== null);
    const { attempts, added, replaced } = mergeAttempts(existing, incoming);

    expect(replaced).toBe(1);
    expect(added).toBe(5);
    expect(attempts.filter((a) => courseKey(a.course) === "MATH 137")).toHaveLength(1);
    // The imported grade wins over the placeholder that was already there.
    expect(attempts.find((a) => courseKey(a.course) === "MATH 137")?.grade).toEqual({
      kind: "numeric",
      value: 82,
    });
  });

  it("keeps a repeat of the same course in a different term", () => {
    const retake: CourseAttempt = { ...existing[0], termCode: "1251", grade: { kind: "numeric", value: 75 } };
    const { attempts } = mergeAttempts(existing, [retake]);
    expect(attempts).toHaveLength(2);
  });

  it("is a no-op when there is nothing to import", () => {
    const { attempts, added, replaced } = mergeAttempts(existing, []);
    expect(attempts).toEqual(existing);
    expect(added).toBe(0);
    expect(replaced).toBe(0);
  });
});

describe("correcting a parsed row by hand", () => {
  const original = parseTranscript("Fall 2024\nMATH 137 Calculus  0.50  0.50  82").rows[0];

  it("applies a corrected subject and number", () => {
    const fixed = editRow(original, { subject: "cs", catalogNumber: "136l" });
    expect(fixed.course).toEqual({ subject: "CS", catalogNumber: "136L" });
  });

  it("re-parses a corrected grade rather than storing raw text", () => {
    expect(editRow(original, { gradeText: "91" }).grade).toEqual({ kind: "numeric", value: 91 });
    expect(editRow(original, { gradeText: "CR" }).grade).toEqual({ kind: "symbol", value: "CR" });
  });

  it("rescues a row the parser could not read", () => {
    // No grade on the line, so the parse marked it unusable.
    const broken = parseTranscript("Fall 2024\nMATH 137 Calculus 1 for Honours Mathematics").rows[0];
    expect(broken.grade).toBeNull();
    expect(importableRows([broken])).toEqual([]);

    const fixed = editRow(broken, { gradeText: "78" });
    expect(fixed.confidence).toBe("high");
    expect(importableRows([fixed])).toHaveLength(1);
  });

  it("rejects an edit that is still not a grade", () => {
    const fixed = editRow(original, { gradeText: "banana" });
    expect(fixed.grade).toBeNull();
    expect(fixed.confidence).toBe("low");
    expect(importableRows([fixed])).toEqual([]);
  });

  it("refuses an out-of-range percentage typed by hand", () => {
    expect(editRow(original, { gradeText: "820" }).grade).toBeNull();
  });

  it("treats a cleared grade as missing rather than zero", () => {
    const cleared = editRow(original, { gradeText: "" });
    expect(cleared.grade).toBeNull();
    expect(cleared.issues.join(" ")).toContain("no grade");
  });

  it("marks the row as edited so the UI can say so", () => {
    expect(editRow(original, { gradeText: "91" }).edited).toBe(true);
  });

  it("carries the correction through to the imported attempt", () => {
    const fixed = editRow(original, { subject: "STAT", catalogNumber: "230", gradeText: "88" });
    const attempt = toAttempt(fixed);
    expect(attempt?.course).toEqual({ subject: "STAT", catalogNumber: "230" });
    expect(attempt?.grade).toEqual({ kind: "numeric", value: 88 });
  });
});
