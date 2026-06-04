interface StatusPillProps {
  status: string;
  label?: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}

export function StatusPill({ status, label, tone }: StatusPillProps) {
  const resolvedTone = tone ?? toneForStatus(status);
  return (
    <span className={`status-pill status-pill--${resolvedTone}`}>
      <span className="status-pill__dot" aria-hidden="true" />
      {label ?? humanizeStatus(status)}
    </span>
  );
}

function humanizeStatus(status: string): string {
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
  if (lowered === "skipped_no_changes") {
    return "Ingen endringer";
  }
  if (lowered === "completed_with_warnings") {
    return "Fullført med varsler";
  }
  if (lowered === "completed") {
    return "Fullført";
  }
  if (lowered === "failed") {
    return "Feilet";
  }
  return status.replaceAll("_", " ");
}

function toneForStatus(status: string): StatusPillProps["tone"] {
  const lowered = status.toLowerCase();
  if (lowered.includes("warning")) {
    return "warning";
  }
  if (lowered.includes("failed") || lowered.includes("error")) {
    return "danger";
  }
  if (lowered.includes("completed") || lowered.includes("online") || lowered.includes("available")) {
    return "success";
  }
  if (lowered.includes("skipped")) {
    return "info";
  }
  return "neutral";
}
