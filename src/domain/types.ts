/**
 * UW records a numeric percentage plus a set of non-numeric outcomes.
 * Non-numeric grades are excluded from averages but still affect
 * completion and failure counts, so they must survive as distinct values.
 */
export type NonNumericGrade =
  | "CR" // credit granted, no numeric grade
  | "NCR" // no credit granted — counts as a failure
  | "WD" // withdrew, no penalty
  | "WF" // withdrew failing — counts as a failure
  | "INC" // incomplete
  | "IP" // in progress
  | "AEG" // aegrotat standing
  | "DNW"; // did not write

export type Grade = { kind: "numeric"; value: number } | { kind: "symbol"; value: NonNumericGrade };

export type AcademicStanding =
  | "good"
  | "satisfactory"
  | "conditional"
  | "probation"
  | "failed"
  | "required-to-withdraw";

export type TermSeason = "F" | "W" | "S";

/** UW term codes are 4 digits: 1 + (year - 1900) + season digit. 1249 = Fall 2024. */
export type TermCode = string;

export type CourseRef = {
  subject: string; // "MATH"
  catalogNumber: string; // "137"
};

export type CourseAttempt = {
  course: CourseRef;
  termCode: TermCode;
  units: number; // most UW courses are 0.5
  grade: Grade;
  /** Set when a later attempt supersedes this one for averaging purposes. */
  supersededBy?: TermCode;
};

export type TermRecord = {
  termCode: TermCode;
  /** Co-op work terms carry no course load and do not count as study terms. */
  kind: "study" | "work" | "off";
  standing?: AcademicStanding;
};

export type AcademicProfile = {
  /** Plan code of the program the student is currently in, e.g. "SCI-BIO". */
  currentProgram: string;
  /** Calendar year governing the student's requirements, e.g. "2024-2025". */
  calendarYear: string;
  attempts: CourseAttempt[];
  terms: TermRecord[];
  /**
   * Present only when the student supplied it. Absent means "unknown" —
   * never assume good standing, since that would silently pass a rule.
   */
  currentStanding?: AcademicStanding;
};

/**
 * Tri-state is load-bearing: a missing input must never render as a
 * failed requirement, or the tool tells students they are ineligible
 * when it simply lacks data.
 */
export type EvaluationStatus = "met" | "unmet" | "unknown";

export type Evaluation = {
  status: EvaluationStatus;
  /** Human-readable statement of what was required. */
  requirement: string;
  /** What the profile actually shows, when computable. */
  actual?: string;
  /** Why the status is `unknown`, and what the student should supply. */
  missingInput?: string;
  children?: Evaluation[];
};
