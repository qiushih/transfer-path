import type { TransferRule } from "@/domain/eligibility";
import { artsInternalTransfer } from "./rules/arts-internal-transfer";
import { cfmInternalTransfer } from "./rules/cfm-internal-transfer";
import { environmentInternalTransfer, ersTransfer } from "./rules/environment-internal-transfer";
import { engineeringInternalTransfer } from "./rules/engineering-internal-transfer";
import { softwareEngineeringTransfer } from "./rules/se-internal-transfer";
import { csDeclaration } from "./rules/cs-declaration";
import {
  actuarialScienceDeclaration,
  appliedMathDeclaration,
  coDeclaration,
  computationalMathDeclaration,
  dataScienceDeclaration,
  farmDeclaration,
  mathEconDeclaration,
  pureMathDeclaration,
  statisticsDeclaration,
} from "./rules/math-majors";
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
        id: "datasci",
        name: "Data Science (BMath)",
        declarationRule: dataScienceDeclaration,
        requiresFacultyTransfer: true,
      },
      {
        id: "actsc",
        name: "Actuarial Science",
        declarationRule: actuarialScienceDeclaration,
        requiresFacultyTransfer: true,
      },
      {
        id: "co",
        name: "Combinatorics and Optimization",
        declarationRule: coDeclaration,
        requiresFacultyTransfer: true,
      },
      {
        id: "stat",
        name: "Statistics",
        declarationRule: statisticsDeclaration,
        requiresFacultyTransfer: true,
      },
      {
        id: "amath",
        name: "Applied Mathematics",
        declarationRule: appliedMathDeclaration,
        requiresFacultyTransfer: true,
      },
      {
        id: "pmath",
        name: "Pure Mathematics",
        declarationRule: pureMathDeclaration,
        requiresFacultyTransfer: true,
      },
      {
        id: "cm",
        name: "Computational Mathematics",
        declarationRule: computationalMathDeclaration,
        requiresFacultyTransfer: true,
      },
      {
        id: "mathec",
        name: "Mathematical Economics",
        declarationRule: mathEconDeclaration,
        requiresFacultyTransfer: true,
      },
      {
        id: "farm",
        name: "Financial Analysis and Risk Management (FARM)",
        declarationRule: farmDeclaration,
        requiresFacultyTransfer: true,
        note: "Most FARM students are admitted at Year One directly. Transferring in later is not the usual route.",
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
    id: "engineering",
    name: "Faculty of Engineering",
    transferRule: engineeringInternalTransfer,
    programs: [
      {
        id: "se",
        name: "Software Engineering",
        declarationRule: softwareEngineeringTransfer,
        // 1B, 2A and 2B entry is a direct application to the SE Director and
        // does not go through Engineering Admissions, so requiring the faculty
        // transfer would impose the 1A restart on a route that avoids it.
        requiresFacultyTransfer: false,
        note: "Entry at 1B, 2A or 2B is a direct application to the SE Director. Only 1A entry goes through Engineering Admissions, which carries the faculty requirements and the 1A restart.",
      },
      {
        id: "undecided",
        name: "Not decided yet",
        requiresFacultyTransfer: true,
        note: "Engineering programs other than Software Engineering are entered through the faculty transfer process above, which starts every student in 1A.",
      },
    ],
  },
  {
    id: "arts",
    name: "Faculty of Arts",
    transferRule: artsInternalTransfer,
    programs: [
      {
        id: "undecided",
        name: "Not decided yet",
        requiresFacultyTransfer: true,
        note: "Majors set their own bar on top of the faculty transfer: 70% major average for an Honours major, 65% for a general major.",
      },
    ],
  },
  {
    id: "environment",
    name: "Faculty of Environment",
    transferRule: environmentInternalTransfer,
    programs: [
      {
        id: "ers",
        name: "Environment, Resources and Sustainability (ERS)",
        declarationRule: ersTransfer,
        // The faculty publishes no criteria of its own, so the school's rule
        // is the whole requirement rather than an extra layer on top of one.
        requiresFacultyTransfer: false,
        note: "ERS sets its own bar and admits directly. The Faculty of Environment publishes no faculty-wide transfer criteria.",
      },
      {
        id: "undecided",
        name: "Not decided yet",
        requiresFacultyTransfer: true,
        note: "Geography and Environmental Management, Planning, and Environment, Enterprise and Development each publish their own requirements; contact the school's academic advisor.",
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

/**
 * Programs a student already inside the faculty could declare.
 *
 * "Not decided yet" is excluded: it exists so someone transferring can see the
 * faculty requirements alone, but there is nothing to declare. Programs with
 * no transcribed rule are excluded too, since offering them would imply the
 * tool knows requirements it does not have.
 */
export function declarableProgramsOf(faculty: FacultyTarget): ProgramTarget[] {
  return faculty.programs.filter((p) => p.declarationRule !== undefined);
}

/** The faculty whose students can use the declaration dashboard. */
export const DECLARING_FACULTY_ID = "math";

/** The rules that actually apply, in the order a student would clear them. */
export function rulesFor(faculty: FacultyTarget, program: ProgramTarget): TransferRule[] {
  const rules: TransferRule[] = [];
  if (program.requiresFacultyTransfer) rules.push(faculty.transferRule);
  if (program.declarationRule) rules.push(program.declarationRule);
  return rules;
}
