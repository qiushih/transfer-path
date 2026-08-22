import type { TransferRule } from "@/domain/eligibility";
import type { DegreeProgram } from "@/domain/requirements";
import { cfmInternalTransfer } from "./rules/cfm-internal-transfer";
import { mathInternalTransfer } from "./rules/math-internal-transfer";
import { scienceInternalTransfer } from "./rules/science-internal-transfer";
import { mathCsTemplate } from "./programs/math-cs";

/**
 * A transfer target pairs the eligibility rule for getting in with the degree
 * programs whose requirements can then be audited. `programs` is allowed to be
 * empty: eligibility is useful on its own, and inventing degree requirements
 * to fill the gap would be worse than offering none.
 */
export type TransferTarget = {
  rule: TransferRule;
  programs: DegreeProgram[];
};

export const TARGETS: TransferTarget[] = [
  { rule: mathInternalTransfer, programs: [mathCsTemplate] },
  { rule: scienceInternalTransfer, programs: [] },
  { rule: cfmInternalTransfer, programs: [] },
];

export function findTarget(id: string): TransferTarget {
  return TARGETS.find((t) => t.rule.id === id) ?? TARGETS[0];
}
