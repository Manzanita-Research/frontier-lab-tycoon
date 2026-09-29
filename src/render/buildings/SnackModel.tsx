import { CREAM, CREAM_DARK } from "../materials";
import { B, Cyl } from "./Parts";

const SNACKS = ["#ff6b4a", "#ffd24a", "#4fc36b", "#4f8ff0", "#b06cf0", "#ff8fb0"];

/** A wall of cubbies stocked with brightly coloured snacks, under a striped awning, behind a little counter. */
export function SnackModel({ color }: { color: string }) {
  return (
    <group>
      <B s={[0.92, 0.08, 0.92]} c={CREAM_DARK} />
      <B p={[0, 0.08, -0.34]} s={[0.86, 1.02, 0.16]} c={CREAM} />
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => (
          <B
            key={`${row}${col}`}
            p={[-0.27 + col * 0.27, 0.2 + row * 0.3, -0.24]}
            s={[0.2, 0.2, 0.08]}
            c={SNACKS[(row * 3 + col * 2) % SNACKS.length]!}
          />
        )),
      )}
      {[0.28, 0.58, 0.88].map((y) => (
        <B key={y} p={[0, y, -0.25]} s={[0.84, 0.03, 0.14]} c={CREAM_DARK} />
      ))}
      <B p={[0, 1.12, -0.2]} s={[0.94, 0.06, 0.62]} c={color} />
      {[-0.36, -0.12, 0.12, 0.36].map((x, i) => (
        <B key={x} p={[x, 1.08, 0.12]} s={[0.24, 0.05, 0.12]} c={i % 2 ? "#fff8e6" : color} />
      ))}
      <B p={[0, 0.08, 0.22]} s={[0.78, 0.38, 0.3]} c={CREAM} />
      <B p={[0, 0.46, 0.22]} s={[0.84, 0.05, 0.36]} c={color} />
      <Cyl p={[0.24, 0.51, 0.22]} r={0.07} h={0.13} c="#fff8e6" />
      <Cyl p={[-0.2, 0.51, 0.2]} r={0.045} h={0.1} c={SNACKS[0]} />
    </group>
  );
}
