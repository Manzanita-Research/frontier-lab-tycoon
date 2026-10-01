// FLT-91: the garage's front yard. A fresh lab used to start with five tiles of path, most of them hidden behind the
// gate's arch, and Jem saw "two path tiles". Now the gate opens onto a little paved plaza along the fence, and a short
// walk runs up from it to the Cluster. The camera looks in from the gate's right, so that is where the plaza spreads:
// beside the gate on the fence row, where nothing ever stood, and one row in. It keeps off row 21 and those behind it,
// where the first Hall and Gateway go, and the coach still asks for the path to the Hall.

/** The entrance plaza, as rects: the row inside the gate, and the fence row beside it. */
export const PLAZA = [
  { x: 10, z: 22, w: 7, d: 1 },
  { x: 13, z: 23, w: 4, d: 1 },
] as const;
/** The walk up from the plaza to the Cluster, ending where the coach's suggested path begins. */
export const WALK = { x: 11, z0: 19, z1: 21 } as const;

/** Is (x, z) on the entrance plaza (the renderer paves it differently)? */
export const onPlaza = (x: number, z: number) => PLAZA.some((r) => x >= r.x && x < r.x + r.w && z >= r.z && z < r.z + r.d);

/** Every tile a garage starts paved, plaza first. */
export function openingPaths(): [number, number][] {
  const out: [number, number][] = [];
  for (const r of PLAZA) for (let z = r.z; z < r.z + r.d; z++) for (let x = r.x; x < r.x + r.w; x++) out.push([x, z]);
  for (let z = WALK.z0; z <= WALK.z1; z++) out.push([WALK.x, z]);
  return out;
}

/**
 * The garage's old front yard: five tiles from the gate. The test campus (`createTestCampus`) lays its own paths over a
 * fresh garage but keeps the garage's walkers and dice, so it starts from this stub: a new front yard never moves
 * the hundreds of pack tests built on it.
 */
export const STUB: readonly (readonly [number, number])[] = [[11, 19], [11, 20], [11, 21], [11, 22], [12, 22]];

/** How many tiles that is: the coach counts the player's own path on top of it. */
export const OPENING_TILES = openingPaths().length;
