// The printed art (FLT-70's art pass: generated on Fal, baked by scripts/art-bake.mjs) as three textures. One loader
// call for the lot, so the stage suspends once and every component gets the same cached textures. They live as long
// as the page: the cache owns them, so nobody disposes them.
import { useLoader, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import boxBack from "../assets/box-back.webp";
import boxFrontOrm from "../assets/box-front.orm.webp";
import boxFront from "../assets/box-front.webp";
import coaFoilHrm from "../assets/coa-foil.hrm.webp";
import coaFoil from "../assets/coa-foil.webp";
import coaPaper from "../assets/coa-paper.webp";
import insertBird from "../assets/insert-bird.webp";
import insertCircus from "../assets/insert-circus.webp";
import insertDrama from "../assets/insert-drama.webp";
import insertModules from "../assets/insert-modules.webp";
import insertRebate from "../assets/insert-rebate.webp";
import manualCover from "../assets/manual-cover.webp";
import shrinkwrapNormal from "../assets/shrinkwrap.normal.webp";

/** The other boxes' covers (FLT-89), `shelf-<box id>.webp`: a box with no cover keeps its painted front. */
const SHELF_COVERS = Object.fromEntries(
  Object.entries(import.meta.glob<string>("../assets/shelf-*.webp", { eager: true, import: "default" })).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1, -5), url]),
) as Record<`shelf-${string}`, string>;

/** Colour art (sRGB) first, then data maps (linear: packed channels and normals). */
const COLOUR = { boxFront, boxBack, manualCover, coaPaper, coaFoil, insertCircus, insertBird, insertDrama, insertModules, insertRebate, ...SHELF_COVERS };
const DATA = { boxFrontOrm, coaFoilHrm, shrinkwrapNormal };
export type ArtKey = Exclude<keyof typeof COLOUR, `shelf-${string}`> | keyof typeof DATA;
type Art = Record<ArtKey, THREE.Texture> & Partial<Record<`shelf-${string}`, THREE.Texture>>;

const ALL: Record<string, string> = { ...COLOUR, ...DATA };
const KEYS = Object.keys(ALL) as (keyof Art)[];
const URLS = KEYS.map((key) => ALL[key]!);

/** The expansion pack inserts, top of the fan first. */
export const INSERT_ART = ["insertCircus", "insertBird", "insertDrama", "insertModules", "insertRebate"] as const;

/** Start the downloads as soon as the stage's chunk loads, before React gets to the first `useArt`. */
export const preloadArt = () => useLoader.preload(THREE.TextureLoader, URLS);

/** Every art texture, by name (suspends until they're all in). */
export function useArt(): Art {
  const textures = useLoader(THREE.TextureLoader, URLS);
  const gl = useThree((s) => s.gl);
  return useMemo(() => {
    const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
    const out = {} as Art;
    KEYS.forEach((key, i) => {
      const t = textures[i]!;
      // Runs before the first upload (or again on the same values), so no needsUpdate.
      t.colorSpace = key in COLOUR ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = key === "shrinkwrapNormal" ? 2 : aniso;
      if (key === "shrinkwrapNormal") t.wrapS = t.wrapT = THREE.RepeatWrapping;
      out[key] = t;
    });
    return out;
  }, [textures, gl]);
}

const envs = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();
/**
 * A soft studio room, prefiltered for reflections. Given to the few glossy things (the box's print, the shrinkwrap)
 * as their own envMap rather than the scene's, so the store's greybox keeps its flat look.
 */
export function useRoomEnv(): THREE.Texture {
  const gl = useThree((s) => s.gl);
  return useMemo(() => {
    let env = envs.get(gl);
    if (!env) {
      const pmrem = new THREE.PMREMGenerator(gl);
      const room = new RoomEnvironment();
      env = pmrem.fromScene(room, 0.04).texture;
      room.dispose();
      pmrem.dispose();
      envs.set(gl, env);
    }
    return env;
  }, [gl]);
}
