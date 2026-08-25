import type { TransferRule } from "@/domain/eligibility";
import { cfmInternalTransfer } from "./rules/cfm-internal-transfer";
import { csDeclaration } from "./rules/cs-declaration";
import { mathInternalTransfer } from "./rules/math-internal-transfer";
import { scienceInternalTransfer } from "./rules/science-internal-transfer";

/**
 * Getting into a major is often two steps, and the tool is wrong if it shows
 * only one. A Science student who wants Computer Science must be admitted to
 * the Faculty of Mathematics *and* then meet the CS major's declaration
 * requirements, which are stricter than the faculty transfer alone.
 *
 * Scope note: a target is the set of conditions to *apply or declare*. What a
 * student must do after being admitted - required upper-year courses, elective
 * bands, degree unit totals, co-op and PD - is out of scope and deliberately
 * not modelled anywhere in this app.
 */
export type TransferTarget = {
  id: string;
  label: string;
  /** Admission to the faculty, where that is a separate gate. */
  facultyRule: TransferRule;
  /** Declaring the major once inside the faculty, where the plan requires it. */
  declarationRule?: TransferRule;
};

export const TARGETS: TransferTarget[] = [
  {
    id: "math-cs",
    label: "Computer Science (Faculty of Mathematics)",
    facultyRule: mathInternalTransfer,
    declarationRule: csDeclaration,
  },
  {
    id: "math",
    label: "Faculty of Mathematics (no specific major yet)",
    facultyRule: mathInternalTransfer,
  },
  {
    id: "science",
    label: "Faculty of Science",
    facultyRule: scienceInternalTransfer,
  },
  {
    id: "cfm",
    label: "Computing and Financial Management (CFM)",
    facultyRule: cfmInternalTransfer,
  },
];

export function findTarget(id: string): TransferTarget {
  return TARGETS.find((t) => t.id === id) ?? TARGETS[0];
}

/** Every rule a student must satisfy for this target, in the order they apply. */
export function stagesOf(target: TransferTarget): TransferRule[] {
  return target.declarationRule ? [target.facultyRule, target.declarationRule] : [target.facultyRule];
}
