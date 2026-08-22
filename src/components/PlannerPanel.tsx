"use client";

import type { AuditResult } from "@/domain/audit";
import { courseKey } from "@/domain/grades";
import { buildPlan, findCandidates, type Catalog } from "@/domain/planner";
import type { AcademicProfile, TermSeason } from "@/domain/types";
import { Section, Warning } from "./ui";

const SEASON_NAME: Record<TermSeason, string> = { F: "Fall", W: "Winter", S: "Spring" };

export function PlannerPanel({
  audit,
  catalog,
  profile,
  startSeason,
}: {
  audit: AuditResult;
  catalog: Catalog & { placeholder?: boolean };
  profile: AcademicProfile;
  startSeason: TermSeason;
}) {
  const candidates = findCandidates(audit, catalog, profile);
  const { terms, unschedulable } = buildPlan(candidates, profile, startSeason);

  return (
    <Section
      title="Course plan"
      subtitle="Courses that would close the gaps above, ordered so prerequisites come first."
    >
      {catalog.placeholder && (
        <div className="mb-4">
          <Warning>
            The course catalog is a placeholder with seven sample courses. Run{" "}
            <code className="font-mono">UW_API_KEY=… npm run sync</code> to pull the real catalog from UW
            Open Data.
          </Warning>
        </div>
      )}

      {terms.length === 0 ? (
        <p className="text-sm opacity-60">
          Nothing to schedule — either every requirement is satisfied or no catalog course matches.
        </p>
      ) : (
        <div className="space-y-4">
          {terms.map((term) => (
            <div key={term.index}>
              <p className="text-sm font-semibold">
                Term {term.index + 1} · {SEASON_NAME[term.season]}
              </p>
              <ul className="mt-1 divide-y divide-black/5 dark:divide-white/10">
                {term.courses.map((candidate) => (
                  <li key={courseKey(candidate.course)} className="py-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-mono text-sm">{courseKey(candidate.course)}</span>
                      <span className="text-xs opacity-70">{candidate.forRequirement}</span>
                    </div>
                    <p className="text-xs opacity-70">{candidate.title}</p>
                    {candidate.unverifiedPrereqs.length > 0 && (
                      <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
                        Check yourself: {candidate.unverifiedPrereqs.join("; ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {unschedulable.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold">Could not place</p>
          <ul className="mt-1 space-y-1 text-xs opacity-70">
            {unschedulable.map((candidate) => (
              <li key={courseKey(candidate.course)}>
                <span className="font-mono">{courseKey(candidate.course)}</span> — missing{" "}
                {candidate.missingPrereqs.map(courseKey).join(", ") || "an unmet prerequisite"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}
