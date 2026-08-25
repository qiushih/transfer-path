"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import catalogData from "@/data/catalog.json";
import {
  DECLARING_FACULTY_ID,
  declarableProgramsOf,
  findFaculty,
  findProgram,
  rulesFor,
} from "@/data/faculties";
import type { Catalog } from "@/domain/catalog";
import { checkEligibility, type EligibilityReport, type TransferRule } from "@/domain/eligibility";
import { buildEquivalenceIndex, type EquivalenceIndex } from "@/domain/equivalence";
import { findGaps, neededCourses, openChoices } from "@/domain/gaps";
import { planPath } from "@/domain/planner";
import type { AcademicProfile } from "@/domain/types";
import { EligibilityPanel } from "@/components/EligibilityPanel";
import { FacultyStep, ProgramStep } from "@/components/GuidedSetup";
import { ModeTabs, type AppMode } from "@/components/ModeTabs";
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
  const [mode, setMode] = useState<AppMode>("transfer");
  const [facultyId, setFacultyId] = useState("math");
  const [transferProgramId, setTransferProgramId] = useState("cs");
  const [declareProgramId, setDeclareProgramId] = useState("cs");

  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  // Derived from the catalog alone, so it is built once rather than on every
  // profile keystroke.
  const equivalence = useMemo(() => buildEquivalenceIndex(catalog.courses), []);

  return (
    <Shell>
      <TranscriptImport profile={profile} onChange={setProfile} />

      <ProfilePanel profile={profile} onChange={setProfile} />

      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "transfer" ? (
        <TransferDashboard
          profile={profile}
          equivalence={equivalence}
          facultyId={facultyId}
          programId={transferProgramId}
          onFacultyChange={(id) => {
            setFacultyId(id);
            // The old program belonged to the old faculty.
            setTransferProgramId(findFaculty(id).programs[0].id);
          }}
          onProgramChange={setTransferProgramId}
        />
      ) : (
        <DeclareDashboard
          profile={profile}
          equivalence={equivalence}
          programId={declareProgramId}
          onProgramChange={setDeclareProgramId}
        />
      )}

      <footer className="flex items-center justify-between border-t border-black/10 pt-4 text-xs opacity-60 dark:border-white/15">
        <span>Unofficial — for quick reference only. Confirm with your academic advisor.</span>
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

/** Shared tail: what still blocks the student, and the earliest route through it. */
function Outcome({
  rules,
  profile,
  equivalence,
}: {
  rules: TransferRule[];
  profile: AcademicProfile;
  equivalence: EquivalenceIndex;
}) {
  const reports = rules.map((rule) => checkEligibility(rule, profile, equivalence));
  const gaps = findGaps(reports, profile);
  const needed = neededCourses(gaps, catalog, profile);
  const choices = openChoices(gaps, catalog, profile);
  const plan = planPath(needed, profile, "F");

  return (
    <PlannerPanel
      gaps={gaps}
      plan={plan}
      choices={choices}
      startSeason="F"
      startYear={new Date().getFullYear()}
    />
  );
}

function TransferDashboard({
  profile,
  equivalence,
  facultyId,
  programId,
  onFacultyChange,
  onProgramChange,
}: {
  profile: AcademicProfile;
  equivalence: EquivalenceIndex;
  facultyId: string;
  programId: string;
  onFacultyChange: (id: string) => void;
  onProgramChange: (id: string) => void;
}) {
  const faculty = findFaculty(facultyId);
  const program = findProgram(faculty, programId);

  const facultyReport: EligibilityReport | null = program.requiresFacultyTransfer
    ? checkEligibility(faculty.transferRule, profile, equivalence)
    : null;
  const programReport = program.declarationRule
    ? checkEligibility(program.declarationRule, profile, equivalence)
    : null;

  return (
    <>
      <FacultyStep faculty={faculty} onFacultyChange={onFacultyChange} />

      {facultyReport ? (
        <EligibilityPanel
          report={facultyReport}
          heading={`Requirements to enter the ${faculty.name}`}
        />
      ) : (
        <Section title="No separate faculty step" subtitle={`${program.name} admits directly.`}>
          <p className="text-sm opacity-70">
            {program.note ??
              "This program admits directly, so there is no faculty transfer to clear first."}
          </p>
        </Section>
      )}

      <ProgramStep faculty={faculty} program={program} onProgramChange={onProgramChange} />

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

      <Outcome rules={rulesFor(faculty, program)} profile={profile} equivalence={equivalence} />
    </>
  );
}

/**
 * For students already inside the Faculty of Mathematics. The faculty transfer
 * is deliberately absent: they have already cleared it, and repeating it here
 * would bury the conditions that still apply.
 */
function DeclareDashboard({
  profile,
  equivalence,
  programId,
  onProgramChange,
}: {
  profile: AcademicProfile;
  equivalence: EquivalenceIndex;
  programId: string;
  onProgramChange: (id: string) => void;
}) {
  const faculty = findFaculty(DECLARING_FACULTY_ID);
  const options = declarableProgramsOf(faculty);
  const program = options.find((p) => p.id === programId) ?? options[0];
  const rule = program.declarationRule;

  return (
    <>
      <Section
        title="Which major do you want to declare?"
        subtitle={`Assumes you are already in the ${faculty.name}. If you are not, use the transfer tab instead.`}
      >
        <select
          className={inputClass}
          value={program.id}
          onChange={(e) => onProgramChange(e.target.value)}
        >
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {program.note && <p className="mt-1 text-xs opacity-70">{program.note}</p>}
      </Section>

      {rule && (
        <EligibilityPanel
          report={checkEligibility(rule, profile, equivalence)}
          heading={`Requirements to declare ${program.name}`}
        />
      )}

      <Outcome rules={rule ? [rule] : []} profile={profile} equivalence={equivalence} />
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold">UWaterloo Transfer &amp; Major Planner</h1>
        <p className="mt-1 text-sm opacity-70">
          Find out what you still need before you can transfer into a faculty or declare a major at
          Waterloo, and the earliest term you could be eligible.
        </p>

        {/*
          Above the results rather than in the footer: a student who acts on a
          "Met" row without reading this could apply for a program they do not
          qualify for, and a disclaimer reachable only by scrolling past the
          answer is one most people never see.
        */}
        <p
          role="note"
          className="mt-4 rounded-lg border-2 border-amber-500/60 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
        >
          <strong className="font-semibold">Unofficial — for quick reference only.</strong> Please
          consult your academic advisor before trusting this information. Requirements change, and
          some conditions here cannot be checked automatically.
        </p>
      </header>
      {children}
    </main>
  );
}
