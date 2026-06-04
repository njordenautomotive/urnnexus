import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  note?: string;
  tone?: "neutral" | "accent" | "warning" | "success";
}

export function StatCard({ label, value, note, tone = "neutral" }: StatCardProps) {
  return (
    <article className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{value}</div>
      {note ? <div className="stat-card__note">{note}</div> : null}
    </article>
  );
}
