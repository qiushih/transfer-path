import { parseTermLabel } from "./terms";
import type { CourseAttempt, Grade, NonNumericGrade, TermCode, TermRecord } from "./types";

/**
 * Parses the text of a Waterloo Quest transcript into course attempts.
 *
 * Everything here runs on text the student already has. Nothing is uploaded:
 * a transcript is among the most sensitive documents a student holds, and the
 * rest of this app keeps the profile in the browser, so extraction has to stay
 * there too.
 *
 * Transcript layouts vary by faculty and by how the text was copied out of the
 * PDF, so the parser is deliberately tolerant and reports what it could not
 * read instead of guessing. Every row is shown to the student for confirmation
 * before it reaches the profile — an import that silently mis-reads a grade is
 * worse than one that asks.
 */

export type ParsedRow = {
  /** The line this came from, so the student can check it against the page. */
  raw: string;
  course: { subject: string; catalogNumber: string };
  title: string;
  termCode: TermCode | null;
  units: number;
  grade: Grade | null;
  /** Low confidence rows are still shown, but not pre-selected for import. */
  confidence: "high" | "low";
  issues: string[];
};

export type ParsedTranscript = {
  rows: ParsedRow[];
  terms: TermRecord[];
  /** Program name if the transcript states one, e.g. "Honours Mathematics". */
  program: string | null;
  /** Lines that looked like courses but could not be read. */
  unreadable: string[];
  warnings: string[];
};

const NON_NUMERIC: Record<string, NonNumericGrade> = {
  CR: "CR",
  NCR: "NCR",
  WD: "WD",
  WF: "WF",
  INC: "INC",
  IP: "IP",
  AEG: "AEG",
  DNW: "DNW",
};

/**
 * Case-sensitive on the subject, for the same reason the prerequisite parser
 * is: `[A-Z]{2,8}` under an `i` flag matches ordinary prose, which turns
 * description text into imaginary course codes.
 */
const COURSE_LINE = /^\s*([A-Z]{2,8})\s*(\d{1,3}[A-Z]?)\s+(.*)$/;

/** Units are always written with two decimals on a Quest transcript. */
const UNITS = /\b\d+\.\d{2}\b/g;

const WORK_TERM = /\b(co-?op\s+work\s+term|work\s+term|WKRPT|work\s+report)\b/i;

function parseGrade(text: string): { grade: Grade | null; issues: string[] } {
  const token = text.trim().split(/\s+/)[0] ?? "";
  if (!token) return { grade: null, issues: ["no grade on this line"] };

  const upper = token.toUpperCase();
  if (upper in NON_NUMERIC) {
    return { grade: { kind: "symbol", value: NON_NUMERIC[upper] }, issues: [] };
  }

  if (/^\d{1,3}$/.test(token)) {
    const value = Number(token);
    // Percentages above 100 are a misread column, not a real grade.
    if (value > 100) return { grade: null, issues: [`"${token}" is not a percentage`] };
    return { grade: { kind: "numeric", value }, issues: [] };
  }

  return { grade: null, issues: [`could not read the grade "${token}"`] };
}

function parseCourseLine(line: string, termCode: TermCode | null): ParsedRow | null {
  const match = COURSE_LINE.exec(line);
  if (!match) return null;

  const [, subject, catalogNumber, tail] = match;
  const issues: string[] = [];

  const unitMatches = [...tail.matchAll(UNITS)];
  let units = 0.5;
  let gradeRegion = "";
  let title = tail.trim();

  if (unitMatches.length > 0) {
    // The first decimal is units attempted; the grade sits after the last one,
    // which skips over the "earned" column without needing to know the layout.
    units = Number(unitMatches[0][0]);
    title = tail.slice(0, unitMatches[0].index).trim();
    const last = unitMatches[unitMatches.length - 1];
    gradeRegion = tail.slice(last.index + last[0].length);
  } else {
    // No units column. Fall back to a trailing grade token, but say so.
    issues.push("no units column found; assuming 0.5");
    const trailing = /\s([A-Z]{2,3}|\d{1,3})\s*$/.exec(tail);
    if (trailing) {
      gradeRegion = trailing[1];
      title = tail.slice(0, trailing.index).trim();
    }
  }

  const { grade, issues: gradeIssues } = parseGrade(gradeRegion);
  issues.push(...gradeIssues);

  if (units <= 0 || units > 3) {
    issues.push(`unit value ${units} looks wrong`);
    units = 0.5;
  }
  if (!termCode) issues.push("no term heading appeared before this course");

  return {
    raw: line.trim(),
    course: { subject, catalogNumber },
    title,
    termCode,
    units,
    grade,
    confidence: issues.length === 0 ? "high" : "low",
    issues,
  };
}

export function parseTranscript(text: string): ParsedTranscript {
  const rows: ParsedRow[] = [];
  const unreadable: string[] = [];
  const warnings: string[] = [];
  const terms = new Map<TermCode, TermRecord>();

  let termCode: TermCode | null = null;
  let program: string | null = null;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const programMatch = /^\s*(?:Program|Plan)\s*:\s*(.+)$/i.exec(trimmed);
    if (programMatch && !program) {
      program = programMatch[1].trim();
      continue;
    }

    // A term heading resets the term every following course belongs to.
    const heading = parseTermLabel(trimmed);
    if (heading && !COURSE_LINE.test(trimmed)) {
      termCode = heading;
      const kind = WORK_TERM.test(trimmed) ? "work" : "study";
      terms.set(heading, { termCode: heading, kind });
      continue;
    }

    const row = parseCourseLine(trimmed, termCode);
    if (row) {
      rows.push(row);
      continue;
    }

    // Only complain about lines that genuinely look like a course row;
    // transcripts are full of headers, GPA lines, and addresses.
    if (/^[A-Z]{2,8}\s*\d{1,3}/.test(trimmed)) unreadable.push(trimmed);
  }

  if (rows.length === 0) {
    warnings.push(
      "No courses were recognised. Copy the course table out of your Quest transcript, including the term headings.",
    );
  }
  if (rows.some((r) => !r.termCode)) {
    warnings.push(
      "Some courses had no term heading above them. Set their term manually before importing.",
    );
  }

  const inProgress = rows.filter((r) => r.grade?.kind === "symbol" && r.grade.value === "IP").length;
  if (inProgress > 0) {
    warnings.push(`${inProgress} course(s) are still in progress and carry no final grade.`);
  }

  return { rows, terms: [...terms.values()], program, unreadable, warnings };
}

/** Rows that carry enough information to become a course attempt. */
export function importableRows(rows: ParsedRow[]): ParsedRow[] {
  return rows.filter((r) => r.grade !== null && r.termCode !== null);
}

export function toAttempt(row: ParsedRow): CourseAttempt | null {
  if (!row.grade || !row.termCode) return null;
  return {
    course: row.course,
    termCode: row.termCode,
    units: row.units,
    grade: row.grade,
  };
}

/**
 * Merges imported attempts into an existing list, replacing any attempt for
 * the same course in the same term. Re-importing a transcript after adding a
 * term should update the profile, not duplicate every course in it.
 */
export function mergeAttempts(
  existing: CourseAttempt[],
  incoming: CourseAttempt[],
): { attempts: CourseAttempt[]; added: number; replaced: number } {
  const keyOf = (a: CourseAttempt) =>
    `${a.course.subject} ${a.course.catalogNumber}@${a.termCode}`;

  const merged = new Map(existing.map((a) => [keyOf(a), a]));
  let added = 0;
  let replaced = 0;

  for (const attempt of incoming) {
    if (merged.has(keyOf(attempt))) replaced += 1;
    else added += 1;
    merged.set(keyOf(attempt), attempt);
  }

  return { attempts: [...merged.values()], added, replaced };
}
