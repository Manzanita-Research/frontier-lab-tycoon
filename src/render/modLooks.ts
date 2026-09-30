// Walker looks from mods (FLT-55): a recipe of primitives, a billboard sprite, a bundled .glb, or a tint. Presentation
// only: a look reads a walker's kind, role, id and position and never changes the World. Every look is instanced (one
// InstancedMesh per part, per sprite, per model mesh and per sign), so a crowd of golden retrievers costs what a crowd
// of people does.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ResolvedLook } from "../mods/services/looks";
import type { LookPartData } from "../mods/schema";
import type { Walker } from "../sim/types";
import { SIGN_COLORS } from "../content/protest";
import { signTexture } from "./signs";

const CAP = 512;
const SIGN_CAP = 64;
/** A model's meshes beyond this are dropped: a look is a walker, not a level. */
const MAX_MODEL_MESHES = 16;
/** How tall a sprite or a model stands when the look does not say: about a person. */
const PERSON = 1.2;
/** The top of a base walker's head (1.6x life size): the height a placard is sized for. */
const PERSON_TOP = 1.25;

/** Where and how a walker is this frame (the same numbers the base looks use). */
export interface Pose {
  x: number;
  z: number;
  /** The way they face, smoothed, plus any look-around or turn to the camera. */
  yaw: number;
  t: number;
  phase: number;
  walking: boolean;
  /** Cheer hop height, landing squash, and the cheer's strength (0 when nobody is cheering). */
  hop: number;
  land: number;
  env: number;
  /** The yaw that faces the camera (signs and sprites turn to it). */
  signYaw: number;
}

export interface LookDrawer {
  readonly group: THREE.Group;
  begin(): void;
  /** Draw one walker. False when the look cannot draw yet (a model still loading): draw the base look instead. */
  draw(w: Walker, p: Pose): boolean;
  end(): void;
  dispose(): void;
}

/** The recipe language, and the tint, as the renderer resolves them. */
export interface Tint {
  body: THREE.Color | null;
  head: THREE.Color | null;
}

const m4 = new THREE.Matrix4();
const base = new THREE.Matrix4();
const local = new THREE.Matrix4();
const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const scl = new THREE.Vector3();
const euler = new THREE.Euler(0, 0, 0, "YXZ");
const ONE = new THREE.Vector3(1, 1, 1);
const DEG = Math.PI / 180;

/** A colour, lighter (shade > 0) or darker (shade < 0). */
export function shaded(hex: string, shade = 0): THREE.Color {
  const c = new THREE.Color(hex);
  return shade === 0 ? c : c.offsetHSL(0, 0, shade * 0.35);
}

/** A part's geometry with its size and rotation baked in, and its origin moved to the pivot the motion turns about. */
export function partGeometry(part: LookPartData): THREE.BufferGeometry {
  const [w, h, d] = part.size;
  let geo: THREE.BufferGeometry;
  switch (part.shape) {
    case "box":
      geo = new THREE.BoxGeometry(w, h, d);
      break;
    case "sphere":
      geo = new THREE.SphereGeometry(0.5, 14, 10).scale(w, h, d);
      break;
    case "capsule": {
      const r = Math.min(w, d) / 2;
      geo = new THREE.CapsuleGeometry(r, Math.max(0, h - 2 * r), 4, 10).scale(w / (2 * r), 1, d / (2 * r));
      break;
    }
    case "cone":
      geo = new THREE.ConeGeometry(0.5, 1, 12).scale(w, h, d);
      break;
    default:
      geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 12).scale(w, h, d);
  }
  if (part.rotate) geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(part.rotate[0] * DEG, part.rotate[1] * DEG, part.rotate[2] * DEG, "YXZ")));
  if (part.pivot) geo.translate(-part.pivot[0], -part.pivot[1], -part.pivot[2]);
  return geo;
}

/** How a part moves, as a rotation about its pivot. */
function motionOf(motion: LookPartData["motion"], p: Pose): [number, number, number] {
  const { t, phase, walking, env } = p;
  switch (motion) {
    case "wag":
      return [0, Math.sin(t * (env > 0 ? 24 : 15) + phase) * 0.75, 0];
    case "nod":
      return [Math.sin(t * 4 + phase) * 0.18, 0, 0];
    case "flop":
      return [0, 0, Math.sin(t * (walking ? 14 : 5) + phase) * (walking ? 0.35 : 0.14)];
    case "sway":
      return [0, 0, Math.sin(t * 2 + phase) * 0.12];
    case "step":
    case "step-alt":
      return [walking ? Math.sin(t * 14 + phase) * (motion === "step" ? 0.55 : -0.55) : 0, 0, 0];
    default:
      return [0, 0, 0];
  }
}

/** Bob (up), pitch (a rocking trot) and roll, by gait. Protesters chant-hop in place; everyone else breathes. */
function gaitOf(look: ResolvedLook, w: Walker, p: Pose): [number, number, number] {
  const { t, phase, walking, hop } = p;
  const chant = w.kind === "protester";
  switch (look.gait ?? "walk") {
    case "trot":
      return walking ? [Math.abs(Math.sin(t * 14 + phase)) * 0.07 + hop, Math.sin(t * 14 + phase) * 0.06, 0] : [(chant ? Math.abs(Math.sin(t * 5 + phase)) * 0.06 : 0) + hop, 0, 0];
    case "hop":
      return [(walking ? Math.abs(Math.sin(t * 6 + phase)) * 0.3 : chant ? Math.abs(Math.sin(t * 3 + phase)) * 0.1 : 0) + hop, 0, 0];
    case "float":
      return [0.15 + Math.sin(t * 2 + phase) * 0.08 + hop, 0, Math.sin(t * 1.3 + phase) * 0.05];
    default:
      return [(walking ? Math.abs(Math.sin(t * 10 + phase)) * 0.07 : chant ? Math.abs(Math.sin(t * 5 + phase)) * 0.08 : Math.sin(t * 1.3 + phase) * 0.013) + hop, 0, 0];
  }
}

function instanced(geo: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], cap = CAP, shadow = true): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geo, material, cap);
  mesh.castShadow = shadow;
  mesh.frustumCulled = false;
  mesh.count = 0;
  return mesh;
}

const finish = (mesh: THREE.InstancedMesh, n: number) => {
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
};

/** Placards a look carries (protesters only): one instanced board per line, and the poles. */
class Signs {
  readonly boards: THREE.InstancedMesh[];
  readonly pole: THREE.InstancedMesh;
  private readonly counts: number[];
  private readonly textures: THREE.Texture[];
  private np = 0;
  private readonly height: number;
  private readonly boardGeo = new THREE.PlaneGeometry(1.3, 0.73);
  private readonly poleGeo = new THREE.BoxGeometry(0.045, 1, 0.045);
  /** A placard is sized for a person; a smaller walker carries a smaller one. */
  private readonly k: number;
  constructor(
    group: THREE.Group,
    lines: readonly string[],
    top: number,
    height?: number,
  ) {
    this.k = Math.min(1, Math.max(0.6, top / PERSON_TOP));
    this.height = height ?? top + 0.85 * this.k;
    this.textures = lines.map((text, i) => signTexture(text, SIGN_COLORS[i % SIGN_COLORS.length]!));
    this.boards = this.textures.map((map) => instanced(this.boardGeo, new THREE.MeshBasicMaterial({ map, toneMapped: false, side: THREE.DoubleSide }), SIGN_CAP, false));
    this.pole = instanced(this.poleGeo, new THREE.MeshStandardMaterial({ color: "#8a5a3a", roughness: 0.9 }));
    this.counts = lines.map(() => 0);
    group.add(this.pole, ...this.boards);
  }
  begin() {
    this.counts.fill(0);
    this.np = 0;
  }
  draw(w: Walker, p: Pose, bob: number) {
    if (w.kind !== "protester") return; // a faction look also dresses the visitors who took its side, sign-free
    const wave = Math.sin(p.t * 5 + p.phase) * 0.14;
    m4.compose(pos.set(p.x, this.height - 0.85 * this.k + bob, p.z), quat.identity(), scl.set(1, this.k, 1));
    this.pole.setMatrixAt(this.np++, m4);
    const which = w.id % this.boards.length;
    const k = this.counts[which]!;
    if (k >= SIGN_CAP) return;
    this.counts[which] = k + 1;
    euler.set(0, p.signYaw, wave);
    m4.compose(pos.set(p.x, this.height + bob + Math.abs(wave) * 0.15 * this.k, p.z), quat.setFromEuler(euler), scl.setScalar(this.k));
    this.boards[which]!.setMatrixAt(k, m4);
  }
  end() {
    finish(this.pole, this.np);
    this.boards.forEach((b, i) => finish(b, this.counts[i]!));
  }
  dispose() {
    this.textures.forEach((t) => t.dispose());
    this.boardGeo.dispose();
    this.poleGeo.dispose();
    for (const m of [this.pole, ...this.boards]) (m.material as THREE.Material).dispose();
  }
}

interface Part {
  mesh: THREE.InstancedMesh;
  origin: THREE.Vector3;
  motion: LookPartData["motion"];
  /** Per coat, when the part is "coat" coloured. */
  coats: THREE.Color[] | null;
}

/** The whole look: the body's matrix this frame (position, facing, gait, the landing squash), times each part's. */
function bodyMatrix(p: Pose, bob: number, pitch: number, roll: number, k: number): THREE.Matrix4 {
  euler.set(pitch, p.yaw, roll);
  const wide = 1 + p.land * 0.6;
  return base.compose(pos.set(p.x, bob, p.z), quat.setFromEuler(euler), scl.set(k * wide, k * (1 - p.land), k * wide));
}

function recipeDrawer(look: ResolvedLook): LookDrawer {
  const group = new THREE.Group();
  const k = look.scale ?? 1;
  const coats = look.coats ?? [];
  const parts: Part[] = (look.recipe ?? []).map((part) => {
    const coat = part.color === "coat";
    const material = new THREE.MeshStandardMaterial({ color: coat ? "#ffffff" : shaded(part.color, part.shade), roughness: 0.8 });
    const mesh = instanced(partGeometry(part), material);
    group.add(mesh);
    const [px, py, pz] = part.pivot ?? [0, 0, 0];
    return { mesh, origin: new THREE.Vector3(part.at[0] + px, part.at[1] + py, part.at[2] + pz), motion: part.motion, coats: coat ? coats.map((c) => shaded(c, part.shade)) : null };
  });
  const top = Math.max(0, ...(look.recipe ?? []).map((part) => part.at[1] + part.size[1] / 2)) * k;
  const signs = look.signs ? new Signs(group, look.signs, top, look.signHeight) : null;
  let n = 0;
  return {
    group,
    begin() {
      n = 0;
      signs?.begin();
    },
    draw(w, p) {
      if (n >= CAP) return true;
      const [bob, pitch, roll] = gaitOf(look, w, p);
      bodyMatrix(p, bob, pitch, roll, k);
      for (const part of parts) {
        const [rx, ry, rz] = motionOf(part.motion, p);
        euler.set(rx, ry, rz);
        local.compose(part.origin, quat.setFromEuler(euler), ONE);
        part.mesh.setMatrixAt(n, m4.multiplyMatrices(base, local));
        if (part.coats) part.mesh.setColorAt(n, part.coats[w.id % part.coats.length]!);
      }
      signs?.draw(w, p, bob);
      n++;
      return true;
    },
    end() {
      for (const part of parts) finish(part.mesh, n);
      signs?.end();
    },
    dispose() {
      for (const part of parts) {
        part.mesh.geometry.dispose();
        (part.mesh.material as THREE.Material).dispose();
      }
      signs?.dispose();
    },
  };
}

/** Only the look's own bundled bytes: anything a model or image tries to reach beyond its `blob:` URL gets nothing. */
function sealedManager(): THREE.LoadingManager {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => (url.startsWith("blob:") || url.startsWith("data:") ? url : "data:,"));
  return manager;
}

function spriteDrawer(look: ResolvedLook): LookDrawer {
  const group = new THREE.Group();
  const [w, h] = look.size ?? [PERSON * 0.75, PERSON];
  const coats = look.coats?.map((c) => new THREE.Color(c)) ?? null;
  const k = look.scale ?? 1;
  const geo = new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0);
  const material = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, toneMapped: false });
  const texture = new THREE.TextureLoader(sealedManager()).load(look.src ?? "", (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    material.needsUpdate = true;
  });
  material.map = texture;
  const mesh = instanced(geo, material);
  group.add(mesh);
  const signs = look.signs ? new Signs(group, look.signs, h * k, look.signHeight) : null;
  let n = 0;
  return {
    group,
    begin() {
      n = 0;
      signs?.begin();
    },
    draw(walker, p) {
      if (n >= CAP) return true;
      const [bob, , roll] = gaitOf(look, walker, p);
      // A billboard faces the camera, and flips to face the way the walker is heading.
      const flip = Math.sin(p.yaw - p.signYaw) < 0 ? -1 : 1;
      euler.set(0, p.signYaw, roll);
      m4.compose(pos.set(p.x, bob, p.z), quat.setFromEuler(euler), scl.set(k * flip * (1 + p.land * 0.4), k * (1 - p.land), k));
      if (coats) mesh.setColorAt(n, coats[walker.id % coats.length]!);
      mesh.setMatrixAt(n++, m4);
      signs?.draw(walker, p, bob);
      return true;
    },
    end() {
      finish(mesh, n);
      signs?.end();
    },
    dispose() {
      geo.dispose();
      texture.dispose();
      material.dispose();
      signs?.dispose();
    },
  };
}

function modelDrawer(look: ResolvedLook): LookDrawer {
  const group = new THREE.Group();
  const k = look.scale ?? 1;
  const height = (look.size?.[1] ?? PERSON) * k;
  const meshes: THREE.InstancedMesh[] = [];
  let ready = false;
  let disposed = false;
  const signs = look.signs ? new Signs(group, look.signs, height, look.signHeight) : null;
  new GLTFLoader(sealedManager()).load(
    look.src ?? "",
    (gltf) => {
      if (disposed) return;
      const scene = gltf.scene;
      scene.updateMatrixWorld(true);
      // Stand it on the ground, centred, as tall as the look says: authors do not have to get the units right.
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      const fit = size.y > 0 ? height / size.y : 1;
      const place = new THREE.Matrix4().makeScale(fit, fit, fit).multiply(new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2));
      scene.traverse((o) => {
        if (!(o instanceof THREE.Mesh) || meshes.length >= MAX_MODEL_MESHES) return;
        const geo = (o.geometry as THREE.BufferGeometry).clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(place, o.matrixWorld));
        const mesh = instanced(geo, o.material as THREE.Material);
        meshes.push(mesh);
        group.add(mesh);
      });
      ready = meshes.length > 0;
    },
    undefined,
    (error) => console.warn(`[mods] ${look.mod}: the .glb look did not load`, error),
  );
  let n = 0;
  return {
    group,
    begin() {
      n = 0;
      signs?.begin();
    },
    draw(w, p) {
      if (!ready) return false;
      if (n >= CAP) return true;
      const [bob, pitch, roll] = gaitOf(look, w, p);
      bodyMatrix(p, bob, pitch, roll, 1);
      for (const mesh of meshes) mesh.setMatrixAt(n, base);
      signs?.draw(w, p, bob);
      n++;
      return true;
    },
    end() {
      for (const mesh of meshes) finish(mesh, n);
      signs?.end();
    },
    dispose() {
      disposed = true;
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        for (const m of [mesh.material].flat()) m.dispose();
      }
      signs?.dispose();
    },
  };
}

/** The drawers and tints for a session's looks, by target ("protester", "visitor:Journalist"). */
export interface ModLooks {
  readonly drawers: Map<string, LookDrawer>;
  readonly tints: Map<string, Tint>;
  /** Signs a tint look adds to the base protesters. */
  readonly group: THREE.Group;
  dispose(): void;
}

export function buildModLooks(looks: Readonly<Record<string, ResolvedLook>>): ModLooks {
  const drawers = new Map<string, LookDrawer>();
  const tints = new Map<string, Tint>();
  const group = new THREE.Group();
  for (const [target, look] of Object.entries(looks)) {
    if (look.tint) {
      tints.set(target, { body: look.tint.body ? new THREE.Color(look.tint.body) : null, head: look.tint.head ? new THREE.Color(look.tint.head) : null });
      continue;
    }
    const drawer = look.recipe ? recipeDrawer(look) : look.sprite ? spriteDrawer(look) : look.glb ? modelDrawer(look) : null;
    if (!drawer) continue;
    drawers.set(target, drawer);
    group.add(drawer.group);
  }
  return {
    drawers,
    tints,
    group,
    dispose() {
      drawers.forEach((d) => d.dispose());
    },
  };
}

/** A walker's look: its kind and role's, else its faction crowd's (FLT-33), else its kind's. */
export function lookKey<T>(map: Map<string, T>, w: Walker): T | undefined {
  const side = w.crowd || w.faction;
  return map.get(`${w.kind}:${w.role}`) ?? (side ? map.get(`faction:${side}`) : undefined) ?? map.get(w.kind);
}
