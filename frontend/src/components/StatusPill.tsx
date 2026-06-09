import { projectStatusMeta, type ProjectStatusLevel, type StatusTone } from "../lib/projects";

interface StatusPillProps {
  status: string;
  label?: string;
  tone?: StatusTone;
}

export function StatusPill({ status, label, tone }: StatusPillProps) {
  const resolvedTone = tone ?? toneForStatus(status);
  return (
    <span className={`status-pill status-pill--${resolvedTone}`}>
      <span className="status-pill__dot" aria-hidden="true" />
      <span className="status-pill__label">{label ?? humanizeStatus(status)}</span>
    </span>
  );
}

function humanizeStatus(status: string): string {
  if (isProjectStatusLevel(status)) {
    return projectStatusMeta(status).label;
  }
  const lowered = status.toLowerCase();
  if (lowered === "online") {
    return "Online";
  }
  if (lowered === "offline") {
    return "Offline";
  }
  if (lowered === "loading") {
    return "Laster";
  }
  if (lowered === "latest") {
    return "Nyeste";
  }
  if (lowered === "archived") {
    return "Arkiv";
  }
  if (lowered === "configured") {
    return "Konfigurert";
  }
  if (lowered === "not_configured") {
    return "Mangler config";
  }
  if (lowered === "available") {
    return "Tilgjengelig";
  }
  if (lowered === "unavailable") {
    return "Utilgjengelig";
  }
  if (lowered === "warning") {
    return "Varsel";
  }
  if (lowered === "failed") {
    return "Feilet";
  }
  return status.replaceAll("_", " ");
}

function toneForStatus(status: string): StatusPillProps["tone"] {
  if (isProjectStatusLevel(status)) {
    return projectStatusMeta(status).tone;
  }
  const lowered = status.toLowerCase();
  if (lowered.includes("warning")) {
    return "warning";
  }
  if (lowered.includes("failed") || lowered.includes("error")) {
    return "danger";
  }
  if (lowered.includes("not_configured") || lowered.includes("unavailable")) {
    return "warning";
  }
  if (lowered.includes("completed") || lowered.includes("online") || lowered.includes("available") || lowered.includes("configured")) {
    return "success";
  }
  if (lowered.includes("skipped") || lowered.includes("loading")) {
    return "info";
  }
  return "neutral";
}

function isProjectStatusLevel(status: string): status is ProjectStatusLevel {
  return ["PENDING", "RUNNING", "SUCCESS", "SUCCESS_WITH_WARNINGS", "FAILED", "NO_REPORT"].includes(status);
}
