"use client";

import { FACULTIES, type FacultyTarget, type ProgramTarget } from "@/data/faculties";
import { Section, inputClass } from "./ui";

/**
 * Faculty and program are asked separately, and the requirements for each are
 * shown between the two questions, because they are two different gates: the
 * faculty sets one bar and the major sets a higher one on top of it. Answering
 * the program first would hide the fact that a student outside Mathematics has
 * to clear the faculty before the major is even in reach.
 */

export function FacultyStep({
  faculty,
  onFacultyChange,
}: {
  faculty: FacultyTarget;
  onFacultyChange: (id: string) => void;
}) {
  return (
    <Section
      title="Which faculty do you want to transfer into?"
      subtitle="Entering the faculty and declaring a major are separate steps, with separate requirements."
    >
      <select
        className={inputClass}
        value={faculty.id}
        onChange={(e) => onFacultyChange(e.target.value)}
      >
        {FACULTIES.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
    </Section>
  );
}

export function ProgramStep({
  faculty,
  program,
  onProgramChange,
}: {
  faculty: FacultyTarget;
  program: ProgramTarget;
  onProgramChange: (id: string) => void;
}) {
  return (
    <Section
      title="Which program do you want to end up in?"
      subtitle={`Within the ${faculty.name}.`}
    >
      <select
        className={inputClass}
        value={program.id}
        onChange={(e) => onProgramChange(e.target.value)}
      >
        {faculty.programs.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {program.note && <p className="mt-1 text-xs opacity-70">{program.note}</p>}
    </Section>
  );
}
