import type { TransferRule } from "@/domain/eligibility";
import { cfmInternalTransfer } from "./rules/cfm-internal-transfer";
import { csDeclaration } from "./rules/cs-declaration";
import { mathInternalTransfer } from "./rules/math-internal-transfer";
import { scienceInternalTransfer } from "./rules/science-internal-transfer";

/**
 * Faculty and program are separate gates and are modelled separately.
 *
 * Getting into the Faculty of Mathematics is not the same as being admitted to
 * the Computer Science major: the faculty sets one bar, and the major sets a
 * higher one on top of it. Collapsing the two understates what a transfer
 * applicant has to do, which is the mistake this structure exists to prevent.
 */

export type ProgramTarget = {
  id: string;
  name: string;
  /** Absent when no program-level rule has been transcribed yet. */
  declarationRule?: TransferRule;
  /**
   * False for a plan that admits directly rather than through its faculty.
   * CFM's published route is a direct application from any Waterloo program,
   * so requiring the Mathematics transfer first would invent a step.
   */
  requiresFacultyTransfer: boolean;
  note?: string;
};

export type FacultyTarget = {
  id: string;
  name: string;
  transferRule: TransferRule;
  programs: ProgramTarget[];
};

export const FACULTIES: FacultyTarget[] = [
  {
    id: "math",
    name: "Faculty of Mathematics",
    transferRule: mathInternalTransfer,
    programs: [
      {
        id: "cs",
        name: "Computer Science (BCS)",
        declarationRule: csDeclaration,
        requiresFacultyTransfer: true,
      },
      {
        id: "cfm",
        name: "Computing and Financial Management (CFM)",
        declarationRule: cfmInternalTransfer,
        requiresFacultyTransfer: false,
        note: "CFM admits directly from any Waterloo program, so the Faculty of Mathematics transfer is not a separate step.",
      },
      {
        id: "undecided",
        name: "Not decided yet",
        requiresFacultyTransfer: true,
        note: "Shows only what is needed to enter the faculty. Individual majors set their own additional requirements.",
      },
    ],
  },
  {
    id: "science",
    name: "Faculty of Science",
    transferRule: scienceInternalTransfer,
    programs: [
      {
        id: "undecided",
        name: "Not decided yet",
        requiresFacultyTransfer: true,
        note: "No Science program-level declaration rules have been transcribed yet.",
      },
    ],
  },
];

export function findFaculty(id: string): FacultyTarget {
  return FACULTIES.find((f) => f.id === id) ?? FACULTIES[0];
}

export function findProgram(faculty: FacultyTarget, id: string): ProgramTarget {
  return faculty.programs.find((p) => p.id === id) ?? faculty.programs[0];
}

/** The rules that actually apply, in the order a student would clear them. */
export function rulesFor(faculty: FacultyTarget, program: ProgramTarget): TransferRule[] {
  const rules: TransferRule[] = [];
  if (program.requiresFacultyTransfer) rules.push(faculty.transferRule);
  if (program.declarationRule) rules.push(program.declarationRule);
  return rules;
}
