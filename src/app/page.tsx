"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import catalogData from "@/data/catalog.json";
import { findFaculty, findProgram, rulesFor } from "@/data/faculties";
import type { Catalog } from "@/domain/catalog";
import { checkEligibility } from "@/domain/eligibility";
import { buildEquivalenceIndex } from "@/domain/equivalence";
import { findGaps, neededCourses, openChoices } from "@/domain/gaps";
import { planPath } from "@/domain/planner";
import type { AcademicProfile } from "@/domain/types";
import { EligibilityPanel } from "@/components/EligibilityPanel";
import { FacultyStep, ProgramStep } from "@/components/GuidedSetup";
import { PlannerPanel } from "@/components/PlannerPanel";
import { ProfilePanel } from "@/components/ProfilePanel";
import { TranscriptImport } from "@/components/TranscriptImport";
import { Section } from "@/components/ui";
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
  const [facultyId, setFacultyId] = useState("math");
  const [programId, setProgramId] = useState("cs");

  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  // Derived from the catalog alone, so it is built once rather than on every
  // profile keystroke.
  const equivalence = useMemo(() => buildEquivalenceIndex(catalog.courses), []);

  const faculty = findFaculty(facultyId);
  const program = findProgram(faculty, programId);
  const rules = rulesFor(faculty, program);

  const facultyReport = program.requiresFacultyTransfer
    ? checkEligibility(faculty.transferRule, profile, equivalence)
    : null;
  const programReport = program.declarationRule
    ? checkEligibility(program.declarationRule, profile, equivalence)
    : null;

  // The plan spans every gate that applies, since a student has to clear them
  // all before they can end up in the program.
  const reports = rules.map((rule) => checkEligibility(rule, profile, equivalence));
  const gaps = findGaps(reports, profile);
  const needed = neededCourses(gaps, catalog, profile);
  const choices = openChoices(gaps, catalog, profile);
  const plan = planPath(needed, profile, "F");

  return (
    <Shell>
      <TranscriptImport profile={profile} onChange={setProfile} />

      <ProfilePanel profile={profile} onChange={setProfile} />

      <FacultyStep
        faculty={faculty}
        onFacultyChange={(id) => {
          setFacultyId(id);
          // The old program belonged to the old faculty.
          setProgramId(findFaculty(id).programs[0].id);
        }}
      />

      {facultyReport ? (
        <EligibilityPanel
          report={facultyReport}
          heading={`Requirements to enter the ${faculty.name}`}
        />
      ) : (
        <Section
          title="No separate faculty step"
          subtitle={`${program.name} admits directly.`}
        >
          <p className="text-sm opacity-70">
            {program.note ?? "This program admits directly, so there is no faculty transfer to clear first."}
          </p>
        </Section>
      )}

      <ProgramStep faculty={faculty} program={program} onProgramChange={setProgramId} />

      {programReport ? (
        <EligibilityPanel
          report={programReport}
          heading={`Requirements to get into ${program.name}`}
        />
      ) : (
        <Section title={`Requirements for ${program.name}`} subtitle="Nothing further to check.">
          <p className="text-sm opacity-70">
            No program-level requirements have been transcribed for this choice, so only the faculty
            requirements above apply. Individual majors usually set their own additional conditions —
            confirm with an advisor.
          </p>
        </Section>
      )}

      <PlannerPanel
        gaps={gaps}
        plan={plan}
        choices={choices}
        startSeason="F"
        startYear={new Date().getFullYear()}
      />

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
