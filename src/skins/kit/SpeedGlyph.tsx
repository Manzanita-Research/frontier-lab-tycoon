/**
 * A speed button's face: one, two or three play triangles for 1×, 3× and 10×, the way Frontier 95 draws them. The coach
 * says "Press ▶▶", so every skin's 3× button shows ▶▶ (drawn, not a font glyph: some faces lack it, some make it an emoji).
 */
export function SpeedGlyph({ value, className = "speed-glyph" }: { value: number; className?: string }) {
  const count = value >= 10 ? 3 : value >= 3 ? 2 : 1;
  return (
    <svg className={className} viewBox={`0 0 ${count * 9 + 1} 12`} height="0.8em" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <polygon key={i} points={`${1 + i * 9},1 ${9 + i * 9},6 ${1 + i * 9},11`} fill="currentColor" />
      ))}
    </svg>
  );
}
