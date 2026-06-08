import type { ProjectViewModel } from "../lib/projects";
import { EmptyState } from "./EmptyState";

interface ProjectIssuesPanelProps {
  project: ProjectViewModel;
}

export function ProjectIssuesPanel({ project }: ProjectIssuesPanelProps) {
  const technicalMessages = Array.from(new Set([...project.technicalWarnings, ...project.technicalErrors].filter((message) => message.trim().length > 0)));

  if (project.issues.length === 0) {
    return (
      <div className="notice-stack">
        <EmptyState title="Ingen varsler" description="Dette prosjektet har ingen synlige varsler eller feil akkurat nå." />
        {technicalMessages.length > 0 ? <TechnicalDetails messages={technicalMessages} /> : null}
      </div>
    );
  }

  return (
    <div className="notice-stack">
      {project.warnings.length > 0 ? <IssueGroup title="Varsler" tone="warning" issues={project.warnings} /> : null}
      {project.errors.length > 0 ? <IssueGroup title="Feil" tone="error" issues={project.errors} /> : null}
      {technicalMessages.length > 0 ? <TechnicalDetails messages={technicalMessages} /> : null}
    </div>
  );
}

function IssueGroup({
  title,
  tone,
  issues,
}: {
  title: string;
  tone: "warning" | "error";
  issues: ProjectViewModel["issues"];
}) {
  return (
    <div className={`notice notice--${tone}`}>
      <div className="notice__title">{title}</div>
      <ul className="notice__list">
        {issues.map((issue) => (
          <li key={`${issue.kind}:${issue.message}`}>
            {issue.message}
            {issue.technicalDetails.length > 0 ? (
              <details className="technical-details">
                <summary>Vis tekniske detaljer</summary>
                <ul>
                  {issue.technicalDetails.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TechnicalDetails({ messages }: { messages: string[] }) {
  return (
    <details className="technical-details technical-details--standalone">
      <summary>Vis tekniske detaljer</summary>
      <ul>
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </details>
  );
}
