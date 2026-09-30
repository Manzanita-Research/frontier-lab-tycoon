/** Today's Drama's megaphone, for any skin's button (stroke and fill follow `currentColor`). */
export function DramaIcon({ size = 18, stroke = 2.4 }: { size?: number; stroke?: number }) {
  return (
    <svg className="drama-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M3.5 10v4h3l9.5 5V5L6.5 10z" />
      <path d="M6.5 14l1.6 5h2.6l-1.2-4.6" />
      <path d="M19 9.2a3.6 3.6 0 0 1 0 5.6M21 7a7 7 0 0 1 0 10" />
    </svg>
  );
}
