import type { EvaluationStatus } from "@/domain/types";

export function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-black/10 bg-white p-5 dark:border-white/15 dark:bg-white/5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle && <p className="mt-1 text-sm opacity-70">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const STATUS_STYLE: Record<EvaluationStatus, string> = {
  met: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  unmet: "bg-red-500/15 text-red-700 dark:text-red-300",
  unknown: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

const STATUS_LABEL: Record<EvaluationStatus, string> = {
  met: "Met",
  unmet: "Not met",
  unknown: "Needs input",
};

export function StatusPill({ status }: { status: EvaluationStatus }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
      {children}
    </p>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium opacity-80">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-white/20";
