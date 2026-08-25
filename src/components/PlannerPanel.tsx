"use client";

import { courseKey } from "@/domain/grades";
import type { Gap, OpenChoice } from "@/domain/gaps";
import type { EligibilityPlan } from "@/domain/planner";
import { describeTerm, termCodeFor } from "@/domain/terms";
import type { TermSeason } from "@/domain/types";
import { Section, StatusPill } from "./ui";

const SEASON_LABEL: Record<TermSeason, string> = { F: "Fall", W: "Winter", S: "Spring" };

function GapList({ gaps }: { gaps: Gap[] }) {
  if (gaps.length === 0) {
    return (
      <p className="text-sm">
        Nothing is blocking an application based on what you have entered. Confirm with an advisor
        before relying on this.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-black/5 dark:divide-white/10">
      {gaps.map((gap, i) => (
        <li key={`${gap.stage}-${gap.requirement}-${i}`} className="py-2">
          <div className="flex items-start justify-between gap-3">
            <span className="text-sm">{gap.requirement}</span>
            <StatusPill status={gap.kind === "other" && gap.needsInput ? "unknown" : "unmet"} />
          </div>
          <p className="mt-0.5 text-xs opacity-60">{gap.stage}</p>

          {gap.kind === "course" && (
            <p className="mt-0.5 text-xs text-red-700 dark:text-red-300">
              Need {gap.count} more
              {gap.minGrade !== undefined && ` at ${gap.minGrade}% or higher`}
            </p>
          )}
          {gap.kind === "average" && (
            <p className="mt-0.5 text-xs text-red-700 dark:text-red-300">
              Need {gap.required}%
              {gap.actual === null
                ? " - no graded courses on file yet"
                : ` - currently ${gap.actual.toFixed(1)}%`}
            </p>
          )}
          {gap.kind === "other" && gap.detail && (
            <p className="mt-0.5 text-xs opacity-70">{gap.detail}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function PlannerPanel({
  gaps,
  plan,
  choices,
  startSeason,
  startYear,
}: {
  gaps: Gap[];
  plan: EligibilityPlan;
  choices: OpenChoice[];
  startSeason: TermSeason;
  startYear: number;
}) {
  const courseGaps = gaps.filter((g) => g.kind === "course").length;
  const averageGaps = gaps.filter((g) => g.kind === "average").length;

  return (
    <>
      <Section
        title="What is missing before you can apply"
        subtitle="Only the conditions for applying or declaring. Requirements that begin after you are admitted are out of scope."
      >
        <GapList gaps={gaps} />
      </Section>

      <Section
        title="Earliest path to eligibility"
        subtitle={
          plan.terms.length === 0
            ? "No courses are needed to become eligible."
            : `${plan.terms.length} term(s) of courses, ordered so prerequisites come first.`
        }
      >
        {averageGaps > 0 && (
          <p className="mb-3 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs">
            {averageGaps} average requirement(s) are not met. Courses cannot fix an average on their
            own - the grades you earn in them decide it, so this plan shows the earliest term you
            could apply, not a guarantee that you will qualify.
          </p>
        )}

        {plan.terms.map((term) => {
          const code = termCodeFor(term.season, startYear + Math.floor((term.index + seasonOffset(startSeason)) / 3));
          return (
            <div key={term.index} className="mb-4">
              <h4 className="text-sm font-semibold">
                {SEASON_LABEL[term.season]} · term {term.index + 1}
                <span className="ml-2 font-normal opacity-60">{describeTerm(code)}</span>
              </h4>
              <ul className="mt-1 space-y-1">
                {term.courses.map((course) => (
                  <li key={courseKey(course.course)} className="text-sm">
                    <span className="font-mono">{courseKey(course.course)}</span>
                    <span className="ml-2 opacity-70">{course.title}</span>
                    <span className="ml-2 text-xs opacity-60">
                      {course.isPrerequisite ? `- ${course.reason}` : `- for ${course.reason}`}
                    </span>
                    {course.alternatives.length > 0 && (
                      <span className="block text-xs opacity-60">
                        or {course.alternatives.map(courseKey).join(", ")} - the rule accepts any of
                        these, and this one was chosen only to give the plan a concrete shape
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        {plan.unschedulable.length > 0 && (
          <div className="mt-2">
            <h4 className="text-sm font-semibold text-red-700 dark:text-red-300">Could not place</h4>
            <ul className="mt-1 space-y-0.5 text-xs">
              {plan.unschedulable.map(({ course, reason }) => (
                <li key={courseKey(course.course)}>
                  <span className="font-mono">{courseKey(course.course)}</span> - {reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {choices.length > 0 && (
          <div className="mt-2 border-t border-black/10 pt-3 dark:border-white/15">
            <h4 className="text-sm font-semibold">Plus courses you choose yourself</h4>
            <p className="mt-0.5 text-xs opacity-70">
              These requirements do not name specific courses, so they are not slotted into terms
              above. Suggestions are ranked by what you could take soonest - confirm with an advisor
              that a course counts.
            </p>
            {choices.map((choice) => (
              <div key={choice.gap.requirement} className="mt-2">
                <p className="text-sm">
                  Choose {choice.gap.count} - {choice.gap.requirement}
                </p>
                <ul className="mt-0.5 text-xs opacity-80">
                  {choice.suggestions.map((s) => (
                    <li key={courseKey(s.course)}>
                      <span className="font-mono">{courseKey(s.course)}</span>
                      <span className="ml-2">{s.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {plan.terms.length === 0 && courseGaps === 0 && choices.length === 0 && (
          <p className="text-sm opacity-70">
            Any remaining items are averages, standing, or checks a person has to confirm.
          </p>
        )}
      </Section>
    </>
  );
}

/** Fall starts a calendar year, so a Fall start rolls the year over sooner. */
function seasonOffset(season: TermSeason): number {
  return season === "F" ? 2 : season === "S" ? 1 : 0;
}
