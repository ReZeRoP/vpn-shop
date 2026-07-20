"use client";
import { useState } from "react";

export default function CopyButton({
  text,
  label = "کپی",
  className = "",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // fallback for non-secure contexts
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={`rounded-lg border border-line bg-panel-2 px-3 py-1.5 text-xs text-muted transition hover:text-fg ${className}`}
    >
      {copied ? "✓ کپی شد" : label}
    </button>
  );
}
