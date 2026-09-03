"use client";

import { useState } from "react";
import {
  editRow,
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

/** The editable text for a grade: the number or symbol, with no "%" to retype. */
function gradeText(row: ParsedRow): string {
  if (!row.grade) return "";
  return row.grade.kind === "numeric" ? String(row.grade.value) : row.grade.value;
}

const cellClass =
  "rounded border border-black/20 bg-transparent px-1 py-0.5 text-xs dark:border-white/25";

export function TranscriptImport({
  profile,
  onChange,
}: {
  profile: AcademicProfile;
  onChange: (next: AcademicProfile) => void;
}) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedTranscript | null>(null);
  /**
   * The rows the student sees and edits. Kept separate from `parsed` so the
   * original parse stays available for the warnings and the unreadable list,
   * and so a correction is never confused with something the parser produced.
   */
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Position only. Keying on the course code would change identity the moment a
   * student corrected a subject or number, silently dropping their selection.
   */
  const rowId = (_row: ParsedRow, index: number) => `row-${index}`;

  function updateRow(index: number, edit: Parameters<typeof editRow>[1]) {
    setRows((current) => current.map((row, i) => (i === index ? editRow(row, edit) : row)));
  }

  function analyse(source: string) {
    const result = parseTranscript(source);
    setParsed(result);
    setRows(result.rows);
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

    const chosen = rows.filter((row, i) => selected.has(rowId(row, i)));
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

  const importable = importableRows(rows).length;

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

      {parsed && rows.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs opacity-70">
            Found {rows.length} course row(s), {importable} ready to import. Anything the parser
            got wrong can be corrected here - edit the subject, number, or grade and the row
            re-checks itself.
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
                {rows.map((row, i) => {
                  const id = rowId(row, i);
                  const usable = row.grade !== null && row.termCode !== null;
                  return (
                    <tr key={id} className="border-t border-black/5 dark:border-white/10">
                      <td className="py-1 pr-2 align-top">
                        <input
                          type="checkbox"
                          className="mt-1"
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
                      <td className="py-1 pr-2 align-top">
                        <div className="flex gap-1">
                          <input
                            aria-label={`Subject for row ${i + 1}`}
                            className={`${cellClass} w-16 uppercase`}
                            value={row.course.subject}
                            onChange={(e) => updateRow(i, { subject: e.target.value })}
                          />
                          <input
                            aria-label={`Course number for row ${i + 1}`}
                            className={`${cellClass} w-14 uppercase`}
                            value={row.course.catalogNumber}
                            onChange={(e) => updateRow(i, { catalogNumber: e.target.value })}
                          />
                        </div>
                      </td>
                      <td className="py-1 pr-2 align-top">
                        {row.termCode ? describeTerm(row.termCode) : "-"}
                      </td>
                      <td className="py-1 pr-2 align-top">{row.units.toFixed(2)}</td>
                      <td className="py-1 pr-2 align-top">
                        <input
                          aria-label={`Grade for row ${i + 1}`}
                          className={`${cellClass} w-16`}
                          placeholder="82 or CR"
                          value={gradeText(row)}
                          onChange={(e) => updateRow(i, { gradeText: e.target.value })}
                        />
                      </td>
                      <td className="py-1 align-top text-xs opacity-70">
                        {row.issues.join("; ")}
                        {row.edited && row.issues.length === 0 && (
                          <span className="text-emerald-700 dark:text-emerald-300">edited</span>
                        )}
                      </td>
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
