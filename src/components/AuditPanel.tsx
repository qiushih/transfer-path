"use client";

import type { AuditResult, CreditCategory } from "@/domain/audit";
import { EMPTY_EQUIVALENCE, type EquivalenceIndex } from "@/domain/equivalence";
import { courseKey } from "@/domain/grades";
import { Section, StatusPill, Warning } from "./ui";

const CATEGORY_LABEL: Record<CreditCategory, string> = {
  direct: "Direct match",
  equivalent: "Equivalent course accepted",
  requirement: "Counts toward a requirement",
  elective: "Elective credit",
  unused: "No credit in this program",
};

const CATEGORY_ORDER: CreditCategory[] = [
  "direct",
  "equivalent",
  "requirement",
  "elective",
  "unused",
];

/**
 * Lists the courses UW treats as interchangeable with a required one, so a
 * student who took MATH 118 can see it covers a MATH 138 requirement.
 */
function AlsoAccepts({
  requirement,
  equivalence,
}: {
  requirement: { anyOf: { subject: string; catalogNumber: string }[] };
  equivalence: EquivalenceIndex;
}) {
  const named = new Set(requirement.anyOf.map(courseKey));
  const substitutes = new Map<string, string>();

  for (const course of requirement.anyOf) {
    for (const link of equivalence.equivalentsOf(course)) {
      const key = courseKey(link.course);
      if (!named.has(key)) substitutes.set(key, link.source);
    }
  }

  if (substitutes.size === 0) return null;

  return (
    <p className="mt-0.5 text-xs opacity-70">
      Also accepted: <span className="font-mono">{[...substitutes.keys()].join(", ")}</span>
      <span className="ml-1 opacity-70">(equivalent per UW antirequisites)</span>
    </p>
  );
}

export function AuditPanel({
  audit,
  equivalence = EMPTY_EQUIVALENCE,
}: {
  audit: AuditResult;
  equivalence?: EquivalenceIndex;
}) {
  const met = audit.requirements.filter((r) => r.satisfied).length;

  return (
    <Section
      title={`Degree audit — ${audit.program.name}`}
      subtitle={`${met} of ${audit.requirements.length} requirements satisfied · ${audit.unitsApplied.toFixed(1)} of ${audit.program.totalUnits.toFixed(1)} units applied`}
    >
      {!audit.program.source.verified && (
        <div className="mb-4">
          <Warning>
            These requirements have not been verified against the undergraduate calendar. Treat this
            audit as a demonstration of the engine, not as advice.
          </Warning>
        </div>
      )}

      <ul className="divide-y divide-black/5 dark:divide-white/10">
        {audit.requirements.map((result) => (
          <li key={result.requirement.id} className="py-2">
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm">{result.requirement.label}</span>
              <StatusPill status={result.satisfied ? "met" : "unmet"} />
            </div>
            {result.appliedCourses.length > 0 && (
              <p className="mt-0.5 font-mono text-xs opacity-70">
                {result.appliedCourses.map((a) => courseKey(a.course)).join(", ")}
              </p>
            )}
            {result.remaining && (
              <p className="mt-0.5 text-xs text-red-700 dark:text-red-300">Still needed: {result.remaining}</p>
            )}
            {!result.satisfied && result.requirement.kind === "course" && (
              <AlsoAccepts requirement={result.requirement} equivalence={equivalence} />
            )}
          </li>
        ))}
      </ul>

      <h3 className="mt-6 text-sm font-semibold">Credit mapping</h3>
      {audit.mapping.length === 0 ? (
        <p className="mt-2 text-sm opacity-60">Add completed courses to see how they would transfer.</p>
      ) : (
        <div className="mt-2 space-y-3">
          {CATEGORY_ORDER.map((category) => {
            const items = audit.mapping.filter((m) => m.category === category);
            if (items.length === 0) return null;
            return (
              <div key={category}>
                <p className="text-xs font-medium uppercase tracking-wide opacity-60">
                  {CATEGORY_LABEL[category]} ({items.length})
                </p>
                <ul className="mt-1 space-y-0.5">
                  {items.map((item, index) => (
                    <li key={index} className="flex justify-between text-sm">
                      <span className="font-mono">{courseKey(item.attempt.course)}</span>
                      <span className="text-xs opacity-70">{item.appliedTo ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
