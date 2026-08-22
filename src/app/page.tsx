"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import catalogData from "@/data/catalog.json";
import { TARGETS, findTarget } from "@/data/targets";
import { auditDegree } from "@/domain/audit";
import { buildEquivalenceIndex } from "@/domain/equivalence";
import type { Catalog } from "@/domain/planner";
import type { AcademicProfile } from "@/domain/types";
import { AuditPanel } from "@/components/AuditPanel";
import { EligibilityPanel } from "@/components/EligibilityPanel";
import { PlannerPanel } from "@/components/PlannerPanel";
import { ProfilePanel } from "@/components/ProfilePanel";
import { Section, inputClass } from "@/components/ui";
import { EMPTY_PROFILE, clearProfile, loadProfile, mountedStore, saveProfile } from "@/lib/storage";

const catalog = catalogData as Catalog & { placeholder?: boolean };

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
  const [targetId, setTargetId] = useState(TARGETS[0].rule.id);
  const [programCode, setProgramCode] = useState<string>(TARGETS[0].programs[0]?.code ?? "");

  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  // Derived from the catalog alone, so it is built once rather than on every
  // profile keystroke.
  const equivalence = useMemo(() => buildEquivalenceIndex(catalog.courses), []);

  const target = findTarget(targetId);
  const program = target.programs.find((p) => p.code === programCode) ?? target.programs[0];

  // Cheap enough to recompute: the matching runs over a few dozen courses.
  // React Compiler memoizes it, and a manual useMemo here trips its analysis
  // because `program` is derived inline.
  const audit = program ? auditDegree(program, profile, equivalence) : null;

  return (
    <Shell>
      <ProfilePanel profile={profile} onChange={setProfile} />

      <Section title="Transfer target" subtitle="Which program are you trying to transfer into?">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium opacity-80">Faculty or program</span>
            <select
              className={inputClass}
              value={targetId}
              onChange={(e) => {
                const next = findTarget(e.target.value);
                setTargetId(next.rule.id);
                setProgramCode(next.programs[0]?.code ?? "");
              }}
            >
              {TARGETS.map((t) => (
                <option key={t.rule.id} value={t.rule.id}>
                  {t.rule.targetProgram}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium opacity-80">Degree program to audit</span>
            <select
              className={inputClass}
              value={program?.code ?? ""}
              disabled={target.programs.length === 0}
              onChange={(e) => setProgramCode(e.target.value)}
            >
              {target.programs.length === 0 ? (
                <option value="">No degree requirements transcribed yet</option>
              ) : (
                target.programs.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
      </Section>

      <EligibilityPanel rule={target.rule} profile={profile} />

      {audit ? (
        <>
          <AuditPanel audit={audit} equivalence={equivalence} />
          <PlannerPanel audit={audit} catalog={catalog} profile={profile} startSeason="F" />
        </>
      ) : (
        <Section
          title="Degree audit"
          subtitle={`No degree requirements have been transcribed for ${target.rule.targetProgram} yet.`}
        >
          <p className="text-sm opacity-70">
            Eligibility above still applies. Adding a program means transcribing its requirements
            from the undergraduate calendar into <code className="font-mono">src/data/programs/</code>.
          </p>
        </Section>
      )}

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
          Check whether you meet the requirements to transfer between Waterloo programs, see how your
          completed courses would carry over, and plan what is left.
        </p>
      </header>
      {children}
    </main>
  );
}
