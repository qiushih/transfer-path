"use client";

/**
 * The same engine answers two different questions, and conflating them makes
 * both worse.
 *
 * A student outside the Faculty of Mathematics has two gates: get into the
 * faculty, then declare the major. A student already inside it has only the
 * second, and showing them faculty transfer requirements they have already
 * cleared is noise that buries the conditions that still apply to them.
 */

export type AppMode = "transfer" | "declare";

export const MODES: { id: AppMode; label: string; blurb: string }[] = [
  {
    id: "transfer",
    label: "Transfer into a faculty",
    blurb:
      "You are in another faculty and want to move. Covers the faculty transfer and, if you have a major in mind, its declaration requirements.",
  },
  {
    id: "declare",
    label: "Declare a major",
    blurb:
      "You are already in the Faculty of Mathematics and want to declare a major. Covers only the major's requirements.",
  },
];

export function ModeTabs({ mode, onChange }: { mode: AppMode; onChange: (m: AppMode) => void }) {
  const active = MODES.find((m) => m.id === mode) ?? MODES[0];

  return (
    <div>
      <div
        role="tablist"
        aria-label="What do you want to do?"
        className="flex gap-1 rounded-lg border border-black/10 p-1 dark:border-white/15"
      >
        {MODES.map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={mode === m.id}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              mode === m.id
                ? "bg-blue-600 text-white"
                : "opacity-70 hover:bg-black/5 dark:hover:bg-white/10"
            }`}
            onClick={() => onChange(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs opacity-70">{active.blurb}</p>
    </div>
  );
}
