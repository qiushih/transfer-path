import { describe, expect, it } from "vitest";
import {
  currentTerm,
  isLikelyPublished,
  nextTermCode,
  scheduleUrl,
  termsFromNow,
} from "./schedule";

/**
 * Dates are built from local components throughout: `new Date("2026-09-01")`
 * parses as UTC and lands on 31 August in a western timezone, which is exactly
 * the boundary these tests exercise.
 */
const at = (y: number, monthIndex: number, day: number) => new Date(y, monthIndex, day);

describe("which term a date falls in", () => {
  it("treats January to April as Winter", () => {
    expect(currentTerm(at(2026, 0, 15))).toEqual({ season: "W", year: 2026 });
    expect(currentTerm(at(2026, 3, 30))).toEqual({ season: "W", year: 2026 });
  });

  it("treats May to August as Spring", () => {
    expect(currentTerm(at(2026, 4, 1))).toEqual({ season: "S", year: 2026 });
    expect(currentTerm(at(2026, 7, 31))).toEqual({ season: "S", year: 2026 });
  });

  it("treats September to December as Fall", () => {
    expect(currentTerm(at(2026, 8, 1))).toEqual({ season: "F", year: 2026 });
    expect(currentTerm(at(2026, 11, 31))).toEqual({ season: "F", year: 2026 });
  });
});

describe("counting terms from now", () => {
  const now = at(2026, 7, 22); // Spring 2026

  it("reports the current term as zero", () => {
    expect(termsFromNow("1265", now)).toBe(0); // Spring 2026
  });

  it("counts forward across a year boundary", () => {
    expect(termsFromNow("1269", now)).toBe(1); // Fall 2026
    expect(termsFromNow("1271", now)).toBe(2); // Winter 2027
    expect(termsFromNow("1275", now)).toBe(3); // Spring 2027
  });

  it("counts backward for past terms", () => {
    expect(termsFromNow("1261", now)).toBe(-1); // Winter 2026
    expect(termsFromNow("1259", now)).toBe(-2); // Fall 2025
  });

  it("returns null for a code it cannot read", () => {
    expect(termsFromNow("nonsense", now)).toBeNull();
  });
});

describe("whether the timetable is likely published", () => {
  const now = at(2026, 7, 22);

  it("covers the window the site actually offered when checked", () => {
    // On 2026-08-22 the schedule listed 1261, 1265, 1269 and 1271.
    for (const code of ["1261", "1265", "1269", "1271"]) {
      expect(isLikelyPublished(code, now)).toBe(true);
    }
  });

  it("excludes a term further out than the site publishes", () => {
    expect(isLikelyPublished("1275", now)).toBe(false); // Spring 2027
    expect(isLikelyPublished("1279", now)).toBe(false); // Fall 2027
  });

  it("excludes a term long past", () => {
    expect(isLikelyPublished("1245", now)).toBe(false); // Spring 2024
  });
});

describe("the soonest enrollable term", () => {
  it("moves to the next season within a year", () => {
    expect(nextTermCode(at(2026, 0, 10))).toBe("1265"); // Winter -> Spring 2026
    expect(nextTermCode(at(2026, 5, 10))).toBe("1269"); // Spring -> Fall 2026
  });

  it("rolls Fall into Winter of the following year", () => {
    expect(nextTermCode(at(2026, 9, 10))).toBe("1271"); // Fall 2026 -> Winter 2027
  });
});

describe("the schedule link", () => {
  const cs136 = { subject: "CS", catalogNumber: "136" };

  it("points at the undergraduate schedule CGI", () => {
    const url = new URL(scheduleUrl(cs136, "1269"));
    expect(url.hostname).toBe("classes.uwaterloo.ca");
    expect(url.pathname).toBe("/cgi-bin/cgiwrap/infocour/salook.pl");
    expect(url.searchParams.get("level")).toBe("under");
  });

  it("carries the course and term the plan is asking about", () => {
    const url = new URL(scheduleUrl(cs136, "1269"));
    expect(url.searchParams.get("subject")).toBe("CS");
    expect(url.searchParams.get("cournum")).toBe("136");
    expect(url.searchParams.get("sess")).toBe("1269");
  });

  it("keeps a letter suffix intact", () => {
    // CS 136L is a real course; dropping the L would query the wrong one.
    const url = new URL(scheduleUrl({ subject: "CS", catalogNumber: "136L" }, "1269"));
    expect(url.searchParams.get("cournum")).toBe("136L");
  });

  it("encodes parameters rather than concatenating them raw", () => {
    const url = scheduleUrl({ subject: "CS", catalogNumber: "136 " }, "1269");
    expect(url).not.toContain("136 ");
  });
});
