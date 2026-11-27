import type { ReactNode } from "react";

const tones = {
  success: "bg-success-soft text-success",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-inactive-soft text-inactive",
} as const;

export function Badge({
  tone,
  children,
}: {
  tone: keyof typeof tones;
  children: ReactNode;
}) {
  return (
    <span className={`inline-flex items-center px-md py-xs rounded-full font-caption text-caption ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Metric({ label, value, tone = "ink" }: { label: string; value: string; tone?: "ink" | "info" | "warning" | "success" }) {
  const color = {
    ink: "text-ink",
    info: "text-info",
    warning: "text-warning",
    success: "text-success",
  }[tone];
  return (
    <article className="bg-surface border border-border rounded-lg p-lg flex flex-col gap-xs">
      <span className="font-body text-body-sm text-muted">{label}</span>
      <span className={`font-metric text-metric tabular-nums ${color}`}>{value}</span>
    </article>
  );
}

const statusTone = {
  confirmed: "success",
  waiting: "warning",
  called: "info",
  in_consultation: "info",
  completed: "success",
  cancelled: "neutral",
  skipped: "warning",
  no_show: "danger",
  left: "neutral",
  draft: "warning",
  finalized: "success",
} as const;

export function StatusBadge({ status }: { status: string }) {
  const tone = statusTone[status as keyof typeof statusTone] ?? "neutral";
  return <Badge tone={tone}>{status.replaceAll("_", " ")}</Badge>;
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="font-body text-body-sm text-danger">
      {children}
    </p>
  );
}

export const controlClass =
  "h-[44px] px-md rounded-md bg-surface text-text border border-control-border font-body text-body-sm";

export const primaryButtonClass =
  "inline-flex items-center justify-center gap-xs h-[44px] px-lg rounded-md bg-primary text-on-primary font-label text-label-md hover:bg-primary-hover disabled:opacity-60";

export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-xs h-[44px] px-lg rounded-md bg-surface text-primary border border-control-border font-label text-label-md hover:bg-primary-soft disabled:opacity-60";

export function Mark() {
  return (
    <span className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-on-primary" aria-hidden="true">
      <svg className="w-5 h-5" viewBox="0 0 26 18" fill="none">
        <path d="M1 9s4.5-7.5 12-7.5S25 9 25 9s-4.5 7.5-12 7.5S1 9 1 9Z" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="13" cy="9" r="3.7" fill="currentColor" />
        <circle cx="15.3" cy="6.7" r="1.4" className="fill-primary" />
      </svg>
    </span>
  );
}
