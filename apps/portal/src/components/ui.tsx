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

export function Mark() {
  return (
    <span className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-on-primary" aria-hidden="true">
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <circle cx="12" cy="12" r="7" />
        <path d="M12 8v8" />
      </svg>
    </span>
  );
}
