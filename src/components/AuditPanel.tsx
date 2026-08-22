"use client";

import type { AuditResult, CreditCategory, PossibleSubstitute } from "@/domain/audit";
import { courseKey } from "@/domain/grades";
import { Section, StatusPill, Warning } from "./ui";

const CATEGORY_LABEL: Record<CreditCategory, string> = {
  exact: "Exact match",
  alternative: "Accepted alternative",
  "verified-equivalent": "Verified equivalent",
  requirement: "Counts toward a requirement",
  elective: "Elective credit",
  unused: "No credit in this program",
};

const CATEGORY_ORDER: CreditCategory[] = [
  "exact",
  "alternative",
  "verified-equivalent",
  "requirement",
  "elective",
  "unused",
];

/**
 * Courses the student already has that overlap a required course. These do not
 * satisfy anything — an antirequisite proves overlapping content, not that the
 * department accepts the swap — so the wording asks the student to confirm
 * rather than implying the requirement is handled.
 */
function PossibleSubstitutes({ found }: { found: PossibleSubstitute[] }) {
  if (found.length === 0) return null;

  // One passed course can overlap several of the accepted courses; say it once.
  const byCandidate = new Map<string, string[]>();
  for (const f of found) {
    const key = courseKey(f.attempt.course);
    byCandidate.set(key, [...(byCandidate.get(key) ?? []), courseKey(f.forCourse)]);
  }

  return (
    <p className="mt-1 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs">
      <span className="font-medium">Possible substitute — needs verification: </span>
      {[...byCandidate.entries()].map(([candidate, targets], i) => (
        <span key={candidate}>
          {i > 0 && "; "}
          <span className="font-mono">{candidate}</span> overlaps{" "}
          <span className="font-mono">{targets.join(", ")}</span>
        </span>
      ))}
      <span className="block opacity-80">
        UW lists these as mutual antirequisites, which shows overlapping content but does not mean
        the program accepts the substitution. Ask an advisor before relying on it.
      </span>
    </p>
  );
}

export function AuditPanel({ audit }: { audit: AuditResult }) {
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
            <PossibleSubstitutes found={result.possibleSubstitutes} />
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
