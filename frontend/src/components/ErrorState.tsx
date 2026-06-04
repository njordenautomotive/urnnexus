import type { ReactNode } from "react";

interface ErrorStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function ErrorState({ title, description, action }: ErrorStateProps) {
  return (
    <div className="error-state">
      <div className="error-state__title">{title}</div>
      <div className="error-state__description">{description}</div>
      {action ? <div className="error-state__action">{action}</div> : null}
    </div>
  );
}

