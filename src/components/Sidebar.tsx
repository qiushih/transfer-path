"use client";

/**
 * Section navigation.
 *
 * The page had grown long enough that the profile, the transfer check and the
 * declaration check all lived in one scroll, and a student had to know which
 * part applied to them. Splitting them means each view answers one question,
 * and the profile is reachable from either check without losing your place.
 *
 * Major Declaration carries a nested child because declaring is Faculty of
 * Mathematics only. Showing that in the tree is more honest than a flat item
 * that silently turns out to be Math-specific once clicked.
 */

export type View = "profile" | "transfer" | "declare";

type Item = {
  view: View;
  label: string;
  hint: string;
  children?: { label: string; hint: string }[];
};

const ITEMS: Item[] = [
  {
    view: "profile",
    label: "Academic Profile",
    hint: "Your courses, grades, and term",
  },
  {
    view: "transfer",
    label: "Internal Transfer",
    hint: "Move into another faculty",
  },
  {
    view: "declare",
    label: "Major Declaration",
    hint: "Declare a major you are eligible for",
    children: [{ label: "Math Program", hint: "Faculty of Mathematics majors" }],
  },
];

export function Sidebar({
  view,
  onChange,
}: {
  view: View;
  onChange: (next: View) => void;
}) {
  return (
    <nav
      aria-label="Sections"
      className="shrink-0 md:w-56"
    >
      <ul className="flex gap-2 overflow-x-auto md:flex-col md:gap-1 md:overflow-visible">
        {ITEMS.map((item) => {
          const active = view === item.view;
          return (
            <li key={item.view} className="shrink-0 md:shrink">
              <button
                aria-current={active ? "page" : undefined}
                className={`w-full whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition md:whitespace-normal ${
                  active
                    ? "bg-blue-600 font-medium text-white"
                    : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
                onClick={() => onChange(item.view)}
              >
                {item.label}
                <span
                  className={`hidden text-xs md:block ${active ? "opacity-80" : "opacity-60"}`}
                >
                  {item.hint}
                </span>
              </button>

              {item.children && (
                <ul className="ml-3 hidden border-l border-black/10 md:block dark:border-white/15">
                  {item.children.map((child) => (
                    <li key={child.label}>
                      <button
                        className={`w-full rounded-r-lg px-3 py-1.5 text-left text-xs transition ${
                          active
                            ? "font-medium text-blue-700 dark:text-blue-300"
                            : "opacity-60 hover:bg-black/5 dark:hover:bg-white/10"
                        }`}
                        onClick={() => onChange(item.view)}
                      >
                        {child.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
