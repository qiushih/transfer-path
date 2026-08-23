"use client";

import type { EligibilityReport } from "@/domain/eligibility";
import type { Evaluation } from "@/domain/types";
import { Section, StatusPill } from "./ui";

function EvaluationRow({ evaluation }: { evaluation: Evaluation }) {
  return (
    <li className="py-2">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm">{evaluation.requirement}</span>
        <StatusPill status={evaluation.status} />
      </div>
      {evaluation.actual && <p className="mt-0.5 text-xs opacity-70">You have: {evaluation.actual}</p>}
      {evaluation.missingInput && (
        <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">{evaluation.missingInput}</p>
      )}
      {evaluation.children && (
        <ul className="mt-1 divide-y divide-black/5 pl-4 dark:divide-white/10">
          {evaluation.children.map((child, index) => (
            <EvaluationRow key={index} evaluation={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** The report is computed by the page so equivalence is threaded in once. */
export function EligibilityPanel({
  report,
  heading,
}: {
  report: EligibilityReport;
  heading?: string;
}) {
  const rule = report.rule;

  const summary =
    report.blockers.length > 0
      ? `${report.blockers.length} requirement(s) not met`
      : report.unknowns.length > 0
        ? `No blockers found, but ${report.unknowns.length} item(s) need your input`
        : "All requirements met";

  return (
    <Section
      title={heading ?? `Requirements — ${rule.targetProgram}`}
      subtitle={`${summary}. Source: ${rule.source.url} (retrieved ${rule.source.retrieved}).`}
    >
      <ul className="divide-y divide-black/5 dark:divide-white/10">
        {(report.evaluation.children ?? [report.evaluation]).map((child, index) => (
          <EvaluationRow key={index} evaluation={child} />
        ))}
      </ul>

      {rule.notes && rule.notes.length > 0 && (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-xs opacity-70">
          {rule.notes.map((note, index) => (
            <li key={index}>{note}</li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs opacity-60">
        Requirements change. Confirm anything here with the faculty advisor before you apply.
      </p>
    </Section>
  );
}
