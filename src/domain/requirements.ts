import type { CourseFilter } from "./grades";
import type { CourseRef } from "./types";

export type Requirement =
  /** A named course that must be completed, or one course from an equivalent set. */
  | { kind: "course"; id: string; label: string; anyOf: CourseRef[] }
  /** N courses drawn from a filter, e.g. "three 300-level CS courses". */
  | { kind: "courses"; id: string; label: string; count: number; filter: CourseFilter }
  /** A unit total drawn from a filter, e.g. "2.0 units of 300+ level CS". */
  | { kind: "units"; id: string; label: string; units: number; filter: CourseFilter }
  | { kind: "group"; id: string; label: string; of: Requirement[] };

export type ProgramSource = {
  url: string;
  retrieved: string;
  /**
   * False until a human has checked these requirements against the calendar.
   * The UI must warn on unverified programs — a plausible-looking audit built
   * from guessed requirements is worse than no audit at all.
   */
  verified: boolean;
};

export type DegreeProgram = {
  /** Plan code, e.g. "MAT-CS-BCS". */
  code: string;
  name: string;
  faculty: string;
  calendarYear: string;
  source: ProgramSource;
  /** Total units needed to graduate; the remainder becomes free electives. */
  totalUnits: number;
  requirements: Requirement[];
};

export function flattenRequirements(requirements: Requirement[]): Exclude<Requirement, { kind: "group" }>[] {
  return requirements.flatMap((r) => (r.kind === "group" ? flattenRequirements(r.of) : [r]));
}
