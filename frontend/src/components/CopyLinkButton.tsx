import { useState } from "react";

interface CopyLinkButtonProps {
  href: string;
  label?: string;
}

export function CopyLinkButton({ href, label = "Kopier lenke" }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const absoluteUrl = typeof window === "undefined" ? href : new URL(href, window.location.origin).toString();
    await navigator.clipboard.writeText(absoluteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button type="button" className="button button--subtle" onClick={copyLink}>
      {copied ? "Kopiert" : label}
    </button>
  );
}
