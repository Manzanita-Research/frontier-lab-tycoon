// FLT-91: the garage's front yard. A fresh lab used to start with five tiles of path, most of them hidden behind the
// gate's arch, and Jem saw "two path tiles". Now the gate opens onto a little paved plaza that runs along the fence and
// spreads out in front of the Cluster, and a short walk runs up from it. The coach still asks for the path to the Hall.
// The plaza stays off the tiles right of the walk (x 12+, z 21 and up): that's where the first Hall and Gateway go.

/** The entrance plaza, as rects: the front row along the fence, and a second row in front of the Cluster. */
export const PLAZA = [
  { x: 8, z: 22, w: 7, d: 1 },
  { x: 8, z: 21, w: 4, d: 1 },
] as const;
/** The walk up from the plaza, past the Cluster, ending where the coach's suggested path begins. */
export const WALK = { x: 11, z0: 19, z1: 20 } as const;

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
