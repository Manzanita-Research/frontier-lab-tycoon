import type { ReactNode } from "react";

/** A button that opens a file picker for a `.fltsave` (FLT-65) and hands the file to `onFile`. Bring your own class. */
export function ImportButton({ onFile, className = "", children, disabled }: { onFile: (file: File) => void; className?: string; children: ReactNode; disabled?: boolean }) {
  return (
    <label className={className} aria-disabled={disabled || undefined}>
      <input
        type="file"
        accept=".fltsave,application/json,application/x-fltsave+json"
        disabled={disabled}
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (file) onFile(file);
        }}
      />
      {children}
    </label>
  );
}
