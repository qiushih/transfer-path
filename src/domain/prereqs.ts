import { courseKey, isPassed, sameCourse } from "./grades";
import type { AcademicProfile, CourseRef } from "./types";

/**
 * UW publishes prerequisites as prose, e.g.
 *   "Prereq: (MATH 135 or 145) and (MATH 137 or 147); Level at least 2A"
 * There is no structured field, so this parses the shape it recognises and
 * marks anything else as an opaque condition. An opaque condition is never
 * silently dropped - dropping it would make a course look available when it
 * is not.
 */
export type PrereqExpr =
  /** `minGrade` carries UW's very common "with a grade of at least 60%" gate. */
  | { kind: "course"; course: CourseRef; minGrade?: number }
  | { kind: "and"; of: PrereqExpr[] }
  | { kind: "or"; of: PrereqExpr[] }
  /** A clause the parser could not interpret, preserved verbatim. */
  | { kind: "opaque"; text: string };

export type ParsedRequirements = {
  prerequisite: PrereqExpr | null;
  corequisite: PrereqExpr | null;
  antirequisite: CourseRef[];
  /** True when every clause parsed into structure. */
  fullyParsed: boolean;
  raw: string;
};

type Token =
  | { type: "course"; course: CourseRef }
  | { type: "and" }
  | { type: "or" }
  | { type: "lparen" }
  | { type: "rparen" }
  /** A grade gate written before its course: "at least 90% in CS 115". */
  | { type: "gradePre"; value: number }
  /** A grade gate written after its course or group: "... with at least 60%". */
  | { type: "gradePost"; value: number }
  | { type: "opaque"; text: string };

/**
 * Grade gates are lifted out before tokenizing. Matching them word-by-word is
 * what previously desynchronized the grammar: the stray words ended a boolean
 * expression early and every course after them was silently dropped, so
 * "MATH 116 or 117 or 127 with a grade of at least 70% or MATH 137" parsed as
 * just the first three courses.
 */
function markGrades(text: string): string {
  return (
    text
      // "with a grade of at least 60%", "with a minimum grade of 80%", "with at least 60%"
      .replace(/\bwith\s+(?:a\s+)?(?:min(?:imum)?\s+)?grade\s+of\s+at\s+least\s+(\d{1,3})\s*%/gi, " @POST:$1@ ")
      .replace(/\bwith\s+(?:a\s+)?min(?:imum)?\s+grade\s+of\s+(\d{1,3})\s*%/gi, " @POST:$1@ ")
      .replace(/\bwith\s+(?:a\s+)?grade\s+of\s+(\d{1,3})\s*%/gi, " @POST:$1@ ")
      .replace(/\bwith\s+at\s+least\s+(\d{1,3})\s*%/gi, " @POST:$1@ ")
      // "at least 90% in CS 115", "a grade of at least 70% in MATH 106"
      .replace(/\b(?:a\s+)?(?:min(?:imum)?\s+)?grade\s+of\s+at\s+least\s+(\d{1,3})\s*%\s+in\b/gi, " @PRE:$1@ ")
      .replace(/\bat\s+least\s+(\d{1,3})\s*%\s+in\b/gi, " @PRE:$1@ ")
      .replace(/\bmin(?:imum)?\s+(\d{1,3})\s*%\s+in\b/gi, " @PRE:$1@ ")
  );
}

/**
 * Deliberately case-SENSITIVE. UW subject codes are uppercase, and an `i` flag
 * would let `[A-Z]{2,8}` match ordinary prose: "Level at least 2A" parsed as a
 * course in a subject called "LEAST". Keywords therefore spell out both cases.
 */
const TOKEN_PATTERN = new RegExp(
  [
    "@(PRE|POST):(\\d{1,3})@", // 1,2 grade marker
    "(\\()", // 3
    "(\\))", // 4
    "\\b([Oo]ne\\s+[Oo]f)\\b", // 5 - a plain list header, contributes no structure
    "\\b([Aa][Nn][Dd])\\b", // 6
    "\\b([Oo][Rr])\\b", // 7
    "([,;])", // 8
    "\\b([A-Z]{2,8})\\s?(\\d{1,3}[A-Z]?)\\b", // 9,10 subject + number
    "\\b(\\d{1,3}[A-Z]?)\\b", // 11 bare number, inherits the last subject
    "(\\S+)", // 12 anything else
  ].join("|"),
  "g",
);

/**
 * "MATH 137 or 147" omits the subject on later alternatives, so a bare
 * catalog number inherits the most recent subject seen.
 */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let lastSubject: string | null = null;
  let opaque: string[] = [];
  /**
   * A bare number only continues a course list ("MATH 137 or 147"). Without
   * this guard, prose swallows the number too: "level at least 2A" became a
   * phantom "MATH 2A" inherited from earlier in the same sentence.
   */
  let inCourseList = false;

  const flushOpaque = () => {
    const joined = opaque.join(" ").replace(/\s+/g, " ").trim();
    if (joined) tokens.push({ type: "opaque", text: joined });
    opaque = [];
  };

  for (const m of markGrades(text).matchAll(TOKEN_PATTERN)) {
    const [, gradeKind, gradeValue, lparen, rparen, oneOf, and, or, punct, subject, number, bare, other] =
      m;

    if (gradeKind) {
      flushOpaque();
      tokens.push(
        gradeKind.toUpperCase() === "PRE"
          ? { type: "gradePre", value: Number(gradeValue) }
          : { type: "gradePost", value: Number(gradeValue) },
      );
    } else if (lparen) {
      flushOpaque();
      tokens.push({ type: "lparen" });
    } else if (rparen) {
      flushOpaque();
      tokens.push({ type: "rparen" });
    } else if (oneOf) {
      flushOpaque();
    } else if (and) {
      flushOpaque();
      tokens.push({ type: "and" });
    } else if (or || punct === ",") {
      flushOpaque();
      tokens.push({ type: "or" });
    } else if (subject && number) {
      flushOpaque();
      lastSubject = subject.toUpperCase();
      inCourseList = true;
      tokens.push({ type: "course", course: { subject: lastSubject, catalogNumber: number.toUpperCase() } });
    } else if (bare && lastSubject && inCourseList) {
      flushOpaque();
      tokens.push({ type: "course", course: { subject: lastSubject, catalogNumber: bare.toUpperCase() } });
    } else if (bare || other) {
      // Prose breaks the list, so a later bare number is not a course.
      inCourseList = false;
      opaque.push(bare ?? other);
    }
  }

  flushOpaque();
  return tokens;
}

/** Applies a trailing grade gate to every course it governs. */
function applyGrade(expr: PrereqExpr, minGrade: number): PrereqExpr {
  switch (expr.kind) {
    case "course":
      return { ...expr, minGrade };
    case "and":
    case "or":
      return { ...expr, of: expr.of.map((child) => applyGrade(child, minGrade)) };
    case "opaque":
      return expr;
  }
}

function parseExpr(tokens: Token[], pos = { i: 0 }): PrereqExpr | null {
  const alternatives: PrereqExpr[] = [];

  for (;;) {
    const term = parseTerm(tokens, pos);
    if (term) alternatives.push(term);
    if (tokens[pos.i]?.type === "or") {
      pos.i += 1;
      continue;
    }
    break;
  }

  if (alternatives.length === 0) return null;
  return alternatives.length === 1 ? alternatives[0] : { kind: "or", of: alternatives };
}

function parseTerm(tokens: Token[], pos: { i: number }): PrereqExpr | null {
  const factors: PrereqExpr[] = [];

  for (;;) {
    const factor = parseFactor(tokens, pos);
    if (factor) factors.push(factor);
    if (tokens[pos.i]?.type === "and") {
      pos.i += 1;
      continue;
    }
    break;
  }

  if (factors.length === 0) return null;
  return factors.length === 1 ? factors[0] : { kind: "and", of: factors };
}

function parseFactor(tokens: Token[], pos: { i: number }): PrereqExpr | null {
  const token = tokens[pos.i];
  if (!token) return null;

  // "at least 90% in CS 115" - the gate precedes whatever it governs.
  if (token.type === "gradePre") {
    pos.i += 1;
    const governed = parseFactor(tokens, pos);
    return governed ? applyGrade(governed, token.value) : null;
  }

  let base: PrereqExpr | null = null;

  if (token.type === "lparen") {
    pos.i += 1;
    base = parseExpr(tokens, pos);
    // Resynchronize: consume anything the grammar could not absorb so a stray
    // token inside the parentheses cannot truncate the rest of the expression.
    while (pos.i < tokens.length && tokens[pos.i].type !== "rparen") pos.i += 1;
    if (tokens[pos.i]?.type === "rparen") pos.i += 1;
  } else if (token.type === "course") {
    pos.i += 1;
    base = { kind: "course", course: token.course };
  } else if (token.type === "opaque") {
    pos.i += 1;
    base = { kind: "opaque", text: token.text };
  } else {
    return null;
  }

  // "... with a grade of at least 60%" trails the course or group it gates.
  if (base && tokens[pos.i]?.type === "gradePost") {
    const gate = tokens[pos.i] as { type: "gradePost"; value: number };
    pos.i += 1;
    base = applyGrade(base, gate.value);
  }

  return base;
}

function hasOpaque(expr: PrereqExpr | null): boolean {
  if (!expr) return false;
  if (expr.kind === "opaque") return true;
  if (expr.kind === "and" || expr.kind === "or") return expr.of.some(hasOpaque);
  return false;
}

/** Splits the published string into its Prereq / Coreq / Antireq clauses. */
export function parseRequirements(raw: string | null): ParsedRequirements {
  const empty: ParsedRequirements = {
    prerequisite: null,
    corequisite: null,
    antirequisite: [],
    fullyParsed: true,
    raw: raw ?? "",
  };
  if (!raw?.trim()) return empty;

  const clauses = raw.split(/(?=\b(?:Prereq|Coreq|Antireq)\b)/i);
  let prerequisite: PrereqExpr | null = null;
  let corequisite: PrereqExpr | null = null;
  const antirequisite: CourseRef[] = [];

  for (const clause of clauses) {
    const match = /^\s*(Prereq|Coreq|Antireq)\s*:?\s*([\s\S]*)$/i.exec(clause);
    if (!match) continue;
    const [, label, body] = match;
    const cleaned = body.replace(/\.$/, "").trim();
    if (!cleaned) continue;

    if (/^Antireq$/i.test(label)) {
      // Antirequisites are a flat list, but still elide the subject:
      // "MATH 118, 119, 128, 148". Reuse the tokenizer so they inherit it.
      for (const token of tokenize(cleaned)) {
        if (token.type === "course") antirequisite.push(token.course);
      }
      continue;
    }

    // A semicolon separates the course expression from enrolment restrictions
    // such as "Honours Mathematics students only". Those must be AND-ed with
    // the whole expression; leaving them inline let `and` bind tighter than
    // `or` and turned a restriction into just another alternative.
    const [courseText, ...restrictions] = cleaned.split(";");
    const expr = parseExpr(tokenize(courseText));
    const gates: PrereqExpr[] = restrictions
      .map((text) => text.trim().replace(/\.$/, ""))
      .filter((text) => text.length > 0)
      .map((text) => ({ kind: "opaque", text }));

    const combined =
      gates.length === 0 ? expr : expr ? { kind: "and" as const, of: [expr, ...gates] } : gates[0];

    if (/^Prereq$/i.test(label)) prerequisite = combined;
    else corequisite = combined;
  }

  return {
    prerequisite,
    corequisite,
    antirequisite,
    fullyParsed: !hasOpaque(prerequisite) && !hasOpaque(corequisite),
    raw,
  };
}

export type PrereqCheck = {
  status: "satisfied" | "not-satisfied" | "needs-review";
  /** Courses named in the expression that the student has not passed. */
  missing: CourseRef[];
  /** Clauses the parser could not evaluate; the student must judge these. */
  unverified: string[];
};

export function checkPrereq(expr: PrereqExpr | null, profile: AcademicProfile): PrereqCheck {
  if (!expr) return { status: "satisfied", missing: [], unverified: [] };

  const passed = profile.attempts.filter(isPassed);
  const missing: CourseRef[] = [];
  const unverified: string[] = [];

  const evaluate = (node: PrereqExpr): boolean | null => {
    switch (node.kind) {
      case "course": {
        const attempts = passed.filter((a) => sameCourse(a.course, node.course));
        if (attempts.length === 0) {
          missing.push(node.course);
          return false;
        }
        if (node.minGrade === undefined) return true;

        // A grade gate can only be judged against a numeric grade. CR/AEG
        // passes are indeterminate, so they defer to the student rather than
        // being read as either clearing or failing the bar.
        const numeric = attempts.filter((a) => a.grade.kind === "numeric");
        if (numeric.length === 0) {
          unverified.push(
            `${courseKey(node.course)} needs at least ${node.minGrade}%, but it has no numeric grade.`,
          );
          return null;
        }
        const best = Math.max(...numeric.map((a) => (a.grade.kind === "numeric" ? a.grade.value : 0)));
        if (best >= node.minGrade) return true;
        missing.push(node.course);
        return false;
      }
      case "and": {
        const results = node.of.map(evaluate);
        if (results.some((r) => r === false)) return false;
        return results.some((r) => r === null) ? null : true;
      }
      case "or": {
        const results = node.of.map(evaluate);
        if (results.some((r) => r === true)) return true;
        return results.some((r) => r === null) ? null : false;
      }
      case "opaque":
        unverified.push(node.text);
        return null;
    }
  };

  const result = evaluate(expr);
  return {
    status: result === true ? "satisfied" : result === false ? "not-satisfied" : "needs-review",
    // An `or` that succeeded elsewhere still recorded its unmet branches; those
    // are not actually missing, so they are dropped when the whole expr passed.
    missing: result === true ? [] : dedupe(missing),
    unverified,
  };
}

function dedupe(courses: CourseRef[]): CourseRef[] {
  const seen = new Map<string, CourseRef>();
  for (const course of courses) seen.set(courseKey(course), course);
  return [...seen.values()];
}
