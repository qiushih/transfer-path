"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import catalogData from "@/data/catalog.json";
import { TARGETS, findTarget, stagesOf } from "@/data/targets";
import type { Catalog } from "@/domain/catalog";
import { checkEligibility } from "@/domain/eligibility";
import { buildEquivalenceIndex } from "@/domain/equivalence";
import { findGaps, neededCourses, openChoices } from "@/domain/gaps";
import { planPath } from "@/domain/planner";
import type { AcademicProfile } from "@/domain/types";
import { EligibilityPanel } from "@/components/EligibilityPanel";
import { PlannerPanel } from "@/components/PlannerPanel";
import { ProfilePanel } from "@/components/ProfilePanel";
import { TranscriptImport } from "@/components/TranscriptImport";
import { Section, inputClass } from "@/components/ui";
import { EMPTY_PROFILE, clearProfile, loadProfile, mountedStore, saveProfile } from "@/lib/storage";

const catalog = catalogData as Catalog;

export default function Home() {
  const mounted = useSyncExternalStore(
    mountedStore.subscribe,
    mountedStore.getSnapshot,
    mountedStore.getServerSnapshot,
  );

  // The planner reads localStorage in a state initializer, which is only safe
  // once the server-rendered markup has been replaced.
  return mounted ? <Planner /> : <Shell>{null}</Shell>;
}

function Planner() {
  const [profile, setProfile] = useState<AcademicProfile>(loadProfile);
  const [targetId, setTargetId] = useState(TARGETS[0].id);

  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  // Derived from the catalog alone, so it is built once rather than on every
  // profile keystroke.
  const equivalence = useMemo(() => buildEquivalenceIndex(catalog.courses), []);

  const target = findTarget(targetId);
  const stages = stagesOf(target);

  const reports = stages.map((rule) => checkEligibility(rule, profile, equivalence));
  const gaps = findGaps(reports, profile);
  const needed = neededCourses(gaps, catalog, profile);
  const choices = openChoices(gaps, catalog, profile);
  const plan = planPath(needed, profile, "F");

  return (
    <Shell>
      <TranscriptImport profile={profile} onChange={setProfile} />

      <ProfilePanel profile={profile} onChange={setProfile} />

      <Section
        title="Where do you want to go?"
        subtitle="Some majors take two steps: getting into the faculty, then declaring the major."
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium opacity-80">Target</span>
          <select
            className={inputClass}
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          >
            {TARGETS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        {stages.length > 1 && (
          <p className="mt-2 text-xs opacity-70">
            This target has {stages.length} stages: {stages.map((s) => s.targetProgram).join(" → ")}.
            Both must be satisfied.
          </p>
        )}
      </Section>

      {reports.map((report) => (
        <EligibilityPanel key={report.rule.id} report={report} />
      ))}

      <PlannerPanel gaps={gaps} plan={plan} choices={choices} startSeason="F" startYear={new Date().getFullYear()} />

      <footer className="flex items-center justify-between border-t border-black/10 pt-4 text-xs opacity-60 dark:border-white/15">
        <span>Unofficial. Always confirm with an academic advisor.</span>
        <button
          className="underline"
          onClick={() => {
            clearProfile();
            setProfile(EMPTY_PROFILE);
          }}
        >
          Clear my data
        </button>
      </footer>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold">UW Internal Transfer Planner</h1>
        <p className="mt-1 text-sm opacity-70">
          Find out what you still need before you can apply to transfer or declare a major at
          Waterloo, and the earliest term you could be eligible.
        </p>
      </header>
      {children}
    </main>
  );
}
