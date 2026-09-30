// FLT-55: mod looks stay instanced (one draw per part, however many walkers) and pick the most specific look.
import * as THREE from "three";
import { buildModLooks, lookKey, type Pose } from "./modLooks";
import type { ResolvedLook } from "../mods/services/looks";
import type { Walker } from "../sim/types";

const pose: Pose = { x: 0, z: 0, yaw: 0, t: 1, phase: 0, walking: true, hop: 0, land: 0, env: 0, signYaw: 0 };
const walker = (id: number, kind: Walker["kind"], role = "") => ({ id, kind, role }) as Walker;
const dog: ResolvedLook = { mod: "m", coats: ["#d9a441", "#b8752a"], recipe: [
  { shape: "capsule", size: [0.4, 0.9, 0.4], at: [0, 0.5, 0], color: "coat", rotate: [90, 0, 0] },
  { shape: "capsule", size: [0.1, 0.4, 0.1], at: [0, 0.7, -0.5], color: "coat", pivot: [0, -0.2, 0], motion: "wag" },
] };

describe("FLT-55 mod looks", () => {
  it("prefers a kind-and-role look to a kind look", () => {
    const map = new Map([["visitor", "any"], ["visitor:Journalist", "press"]]);
    expect(lookKey(map, walker(1, "visitor", "Journalist"))).toBe("press");
    expect(lookKey(map, walker(2, "visitor", "Venture Capitalist"))).toBe("any");
    expect(lookKey(map, walker(3, "researcher"))).toBeUndefined();
  });

  it("draws a crowd with one instanced mesh per recipe part, coat colours per walker", () => {
    const looks = buildModLooks({ protester: dog, agent: { mod: "m", tint: { body: "#ff00ff" } } });
    const drawer = looks.drawers.get("protester")!;
    const meshes = drawer.group.children as THREE.InstancedMesh[];
    expect(meshes).toHaveLength(2);
    drawer.begin();
    for (let id = 0; id < 300; id++) expect(drawer.draw(walker(id, "protester"), { ...pose, x: id })).toBe(true);
    drawer.end();
    expect(meshes.map((m) => m.count)).toEqual([300, 300]);
    const c = new THREE.Color();
    meshes[0]!.getColorAt(1, c);
    expect(c.getHexString()).toBe("b8752a");
    expect(looks.tints.get("agent")?.body?.getHexString()).toBe("ff00ff");
    expect(looks.drawers.has("agent")).toBe(false);
    looks.dispose();
  });

  it("gives the base game nothing to draw", () => {
    const looks = buildModLooks({});
    expect(looks.drawers.size + looks.tints.size).toBe(0);
  });
});
