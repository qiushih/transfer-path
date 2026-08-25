"use client";

import { useState } from "react";
import { courseKey } from "@/domain/grades";
import {
  importableRows,
  mergeAttempts,
  parseTranscript,
  toAttempt,
  type ParsedRow,
  type ParsedTranscript,
} from "@/domain/transcript";
import { describeTerm } from "@/domain/terms";
import type { AcademicProfile } from "@/domain/types";
import { Section, Warning, inputClass } from "./ui";

function describeGrade(row: ParsedRow): string {
  if (!row.grade) return "-";
  return row.grade.kind === "numeric" ? `${row.grade.value}%` : row.grade.value;
}

export function TranscriptImport({
  profile,
  onChange,
}: {
  profile: AcademicProfile;
  onChange: (next: AcademicProfile) => void;
}) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedTranscript | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rowId = (row: ParsedRow, index: number) => `${index}:${courseKey(row.course)}`;

  function analyse(source: string) {
    const result = parseTranscript(source);
    setParsed(result);
    // Pre-select only rows that parsed cleanly. A low-confidence row has to be
    // ticked deliberately, so a misread grade cannot slip into the profile.
    setSelected(
      new Set(
        result.rows
          .map((row, i) => ({ row, id: rowId(row, i) }))
          .filter(({ row }) => row.confidence === "high" && row.grade && row.termCode)
          .map(({ id }) => id),
      ),
    );
    setStatus(null);
  }

  async function onFile(file: File) {
    setBusy(true);
    setStatus(null);
    try {
      if (file.name.toLowerCase().endsWith(".pdf")) {
        const { extractPdfText } = await import("@/lib/pdf-text");
        const extracted = await extractPdfText(file);
        if (extracted.imageOnly) {
          setStatus(
            "That PDF has no text layer, so it is a scan or photo. Reading those needs OCR, which this tool does not do yet - open the transcript in Quest and copy the text instead.",
          );
          return;
        }
        setText(extracted.text);
        analyse(extracted.text);
      } else {
        const content = await file.text();
        setText(content);
        analyse(content);
      }
    } catch (error) {
      setStatus(`Could not read that file: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function applyImport() {
    if (!parsed) return;

    const chosen = parsed.rows.filter((row, i) => selected.has(rowId(row, i)));
    const attempts = importableRows(chosen)
      .map(toAttempt)
      .filter((a): a is NonNullable<typeof a> => a !== null);

    const { attempts: merged, added, replaced } = mergeAttempts(profile.attempts, attempts);

    // Terms seen on the transcript are added, but a term already recorded keeps
    // whatever the student set: they may have corrected a work term by hand.
    const known = new Set(profile.terms.map((t) => t.termCode));
    const terms = [...profile.terms, ...parsed.terms.filter((t) => !known.has(t.termCode))];

    onChange({ ...profile, attempts: merged, terms });
    setStatus(`Imported ${added} course(s), updated ${replaced}.`);
  }

  const importable = parsed ? importableRows(parsed.rows).length : 0;

  return (
    <Section
      title="Import from transcript"
      subtitle="Paste your Quest transcript text, or open a PDF of it, to fill in courses and grades."
    >
      <p className="mb-3 rounded border border-emerald-600/40 bg-emerald-600/10 px-2 py-1 text-xs">
        Your transcript is read in this browser and never uploaded. Nothing is sent anywhere, and
        only the rows you tick are added to your profile.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          <span className="mr-2 opacity-80">Transcript file</span>
          <input
            type="file"
            accept=".pdf,.txt,text/plain,application/pdf"
            className="text-xs"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
        </label>
        {busy && <span className="text-xs opacity-70">Reading…</span>}
      </div>

      <textarea
        className={`${inputClass} mt-3 h-32 font-mono text-xs`}
        placeholder={"Or paste the course table here, including term headings:\n\nFall 2024\nMATH 137  Calculus 1  0.50  0.50  82"}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          className="rounded border border-black/20 px-3 py-1 text-sm disabled:opacity-40 dark:border-white/25"
          disabled={text.trim().length === 0}
          onClick={() => analyse(text)}
        >
          Read transcript
        </button>
        {parsed && (
          <button
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-40"
            disabled={selected.size === 0}
            onClick={applyImport}
          >
            Import {selected.size} selected
          </button>
        )}
      </div>

      {status && <p className="mt-2 text-sm">{status}</p>}

      {parsed?.warnings.map((warning) => (
        <Warning key={warning}>{warning}</Warning>
      ))}

      {parsed && parsed.rows.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs opacity-70">
            Found {parsed.rows.length} course row(s), {importable} ready to import. Check each grade
            against your transcript before importing.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="opacity-60">
                <tr>
                  <th className="py-1 pr-2"></th>
                  <th className="py-1 pr-2">Course</th>
                  <th className="py-1 pr-2">Term</th>
                  <th className="py-1 pr-2">Units</th>
                  <th className="py-1 pr-2">Grade</th>
                  <th className="py-1">Notes</th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.map((row, i) => {
                  const id = rowId(row, i);
                  const usable = row.grade !== null && row.termCode !== null;
                  return (
                    <tr key={id} className="border-t border-black/5 dark:border-white/10">
                      <td className="py-1 pr-2">
                        <input
                          type="checkbox"
                          disabled={!usable}
                          checked={selected.has(id)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(id);
                            else next.delete(id);
                            setSelected(next);
                          }}
                        />
                      </td>
                      <td className="py-1 pr-2 font-mono">{courseKey(row.course)}</td>
                      <td className="py-1 pr-2">
                        {row.termCode ? describeTerm(row.termCode) : "-"}
                      </td>
                      <td className="py-1 pr-2">{row.units.toFixed(2)}</td>
                      <td className="py-1 pr-2">{describeGrade(row)}</td>
                      <td className="py-1 opacity-70">{row.issues.join("; ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {parsed && parsed.unreadable.length > 0 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer opacity-70">
            {parsed.unreadable.length} line(s) looked like courses but could not be read
          </summary>
          <ul className="mt-1 font-mono opacity-70">
            {parsed.unreadable.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      )}
    </Section>
  );
}
