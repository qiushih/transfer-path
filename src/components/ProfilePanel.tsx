"use client";

import { useState } from "react";
import { courseKey } from "@/domain/grades";
import {
  ACADEMIC_LEVELS,
  type AcademicLevel,
  type AcademicProfile,
  type AcademicStanding,
  type CourseAttempt,
  type SystemOfStudy,
  type TermRecord,
} from "@/domain/types";
import { Field, Section, inputClass } from "./ui";

const STANDINGS: AcademicStanding[] = [
  "good",
  "satisfactory",
  "conditional",
  "probation",
  "failed",
  "required-to-withdraw",
];

export function ProfilePanel({
  profile,
  onChange,
}: {
  profile: AcademicProfile;
  onChange: (next: AcademicProfile) => void;
}) {
  const [subject, setSubject] = useState("");
  const [catalogNumber, setCatalogNumber] = useState("");
  const [grade, setGrade] = useState("");
  const [units, setUnits] = useState("0.5");
  const [termCode, setTermCode] = useState("1249");

  const addCourse = () => {
    if (!subject.trim() || !catalogNumber.trim()) return;
    const numeric = Number.parseFloat(grade);
    const attempt: CourseAttempt = {
      course: { subject: subject.trim().toUpperCase(), catalogNumber: catalogNumber.trim().toUpperCase() },
      termCode: termCode.trim(),
      units: Number.parseFloat(units) || 0.5,
      grade: Number.isFinite(numeric)
        ? { kind: "numeric", value: numeric }
        : { kind: "symbol", value: "IP" },
    };
    onChange({ ...profile, attempts: [...profile.attempts, attempt] });
    setSubject("");
    setCatalogNumber("");
    setGrade("");
  };

  const removeCourse = (index: number) => {
    onChange({ ...profile, attempts: profile.attempts.filter((_, i) => i !== index) });
  };

  const addTerm = (kind: TermRecord["kind"]) => {
    onChange({
      ...profile,
      terms: [...profile.terms, { termCode: `t${profile.terms.length + 1}`, kind }],
    });
  };

  return (
    <Section
      title="Academic profile"
      subtitle="Stored only in this browser. Nothing is uploaded to a server."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Current program">
          <input
            className={inputClass}
            placeholder="SCI-BIO"
            value={profile.currentProgram}
            onChange={(e) => onChange({ ...profile, currentProgram: e.target.value })}
          />
        </Field>
        <Field label="Calendar year">
          <input
            className={inputClass}
            value={profile.calendarYear}
            onChange={(e) => onChange({ ...profile, calendarYear: e.target.value })}
          />
        </Field>
        <Field label="Academic standing">
          <select
            className={inputClass}
            value={profile.currentStanding ?? ""}
            onChange={(e) =>
              onChange({
                ...profile,
                currentStanding: e.target.value === "" ? undefined : (e.target.value as AcademicStanding),
              })
            }
          >
            <option value="">Not specified</option>
            {STANDINGS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="System of study">
          <div className="flex gap-2">
            {(["co-op", "regular"] as SystemOfStudy[]).map((option) => (
              <button
                key={option}
                className={`rounded border px-3 py-1 text-sm ${
                  profile.systemOfStudy === option
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-black/20 dark:border-white/25"
                }`}
                onClick={() => onChange({ ...profile, systemOfStudy: option })}
              >
                {option === "co-op" ? "Co-op" : "Regular"}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Term you are in now">
          <div className="flex flex-wrap gap-1">
            {ACADEMIC_LEVELS.map((level) => (
              <button
                key={level}
                className={`rounded border px-2 py-1 font-mono text-sm ${
                  profile.currentLevel === level
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-black/20 dark:border-white/25"
                }`}
                onClick={() => onChange({ ...profile, currentLevel: level as AcademicLevel })}
              >
                {level}
              </button>
            ))}
          </div>
        </Field>
      </div>

      {(profile.systemOfStudy === undefined || profile.currentLevel === undefined) && (
        <p className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs">
          System of study and current term are rule inputs — CFM is co-op only, and Computer Science
          will not consider an applicant past 2B. Until both are set, some requirements below show
          as &ldquo;needs input&rdquo; rather than a yes or no.
        </p>
      )}

      <div className="mt-5">
        <h3 className="text-sm font-semibold">Completed terms</h3>
        <p className="mt-1 text-sm opacity-70">
          Study terms count toward transfer eligibility; work terms do not.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {profile.terms.map((term, index) => (
            <span key={index} className="rounded bg-black/5 px-2 py-1 text-xs dark:bg-white/10">
              {term.kind}
            </span>
          ))}
          <button className="text-sm underline" onClick={() => addTerm("study")}>
            + study term
          </button>
          <button className="text-sm underline" onClick={() => addTerm("work")}>
            + work term
          </button>
          {profile.terms.length > 0 && (
            <button className="text-sm underline opacity-70" onClick={() => onChange({ ...profile, terms: [] })}>
              clear
            </button>
          )}
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold">Courses</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-6">
          <input
            className={inputClass}
            placeholder="MATH"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="137"
            value={catalogNumber}
            onChange={(e) => setCatalogNumber(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Grade %"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Units"
            value={units}
            onChange={(e) => setUnits(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Term"
            value={termCode}
            onChange={(e) => setTermCode(e.target.value)}
          />
          <button
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
            onClick={addCourse}
          >
            Add
          </button>
        </div>

        {profile.attempts.length === 0 ? (
          <p className="mt-3 text-sm opacity-60">No courses entered yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-black/5 dark:divide-white/10">
            {profile.attempts.map((attempt, index) => (
              <li key={index} className="flex items-center justify-between py-1.5 text-sm">
                <span className="font-mono">{courseKey(attempt.course)}</span>
                <span className="flex items-center gap-3 opacity-70">
                  <span>
                    {attempt.grade.kind === "numeric" ? `${attempt.grade.value}%` : attempt.grade.value}
                  </span>
                  <span>{attempt.units.toFixed(2)} units</span>
                  <button className="underline" onClick={() => removeCourse(index)}>
                    remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
