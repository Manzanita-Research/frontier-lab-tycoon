import { datan2, dcos, dexp, dexpm1, dhypot, dlog, dpow, dsin, dtanh } from "./dmath";
import { createRng } from "./rng";

// How far each helper may sit from the engine's Math (relative, or absolute near zero). The engines' own results are
// within an ulp or two of the truth, so this bounds the helpers' error too.
const close = (a: number, b: number, tol = 1e-14) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

describe("dmath", () => {
  const rng = createRng(106);
  const xs = Array.from({ length: 4000 }, () => rng.next());

  it("tracks Math to ~1e-14 over the ranges the sim uses", () => {
    for (const x of xs) {
      const a = (x - 0.5) * 200;
      expect(close(dsin(a), Math.sin(a)), `sin ${a}`).toBe(true);
      expect(close(dcos(a), Math.cos(a)), `cos ${a}`).toBe(true);
      expect(close(dsin(a * 50), Math.sin(a * 50), 1e-12), `sin ${a * 50}`).toBe(true);
      expect(close(datan2(x - 0.5, 0.3 - x), Math.atan2(x - 0.5, 0.3 - x)), `atan2 ${x}`).toBe(true);
      expect(close(datan2(a, -x), Math.atan2(a, -x)), `atan2 q2 ${a}`).toBe(true);
      expect(close(dexp(a), Math.exp(a)), `exp ${a}`).toBe(true);
      expect(close(dexpm1(x - 0.5), Math.expm1(x - 0.5)), `expm1 ${x}`).toBe(true);
      expect(close(dlog(x * 1e6 + 1e-9), Math.log(x * 1e6 + 1e-9)), `log ${x}`).toBe(true);
      expect(close(dpow(x, 1.4), Math.pow(x, 1.4)), `pow ${x}`).toBe(true);
      expect(close(dtanh(a / 20), Math.tanh(a / 20)), `tanh ${a}`).toBe(true);
      expect(close(dhypot(a, x * 7), Math.hypot(a, x * 7)), `hypot ${a}`).toBe(true);
    }
  });

  it("is exact where the answer is", () => {
    expect([dsin(0), dcos(0), dexp(0), dlog(1), dtanh(0), dpow(3, 4), dpow(2, -2), dpow(-2, 3), dpow(0, 1.4)]).toEqual([0, 1, 1, 0, 0, 81, 0.25, -8, 0]);
    expect([datan2(0, 1), datan2(1, 0), datan2(-1, 0), datan2(0, -1), datan2(-0, -1)]).toEqual([0, Math.PI / 2, -Math.PI / 2, Math.PI, -Math.PI]);
    expect([dtanh(30), dtanh(-30), dexp(-800), dexp(800), dlog(0)]).toEqual([1, -1, 0, Infinity, -Infinity]);
    expect([dsin(Infinity), dlog(-1), dpow(-2, 0.5)].every(Number.isNaN)).toBe(true);
  });

  // The point of the module: these bits are the same on every engine. FNV-1a over the raw doubles; if this moves,
  // the helpers changed (and so does every replay), not the engine.
  it("pins its own output bits", () => {
    const view = new DataView(new ArrayBuffer(8));
    let h = 0x811c9dc5;
    const eat = (v: number) => {
      view.setFloat64(0, v);
      for (let i = 0; i < 8; i++) h = Math.imul(h ^ view.getUint8(i), 0x01000193) >>> 0;
    };
    for (const x of xs) {
      const a = (x - 0.5) * 200;
      eat(dsin(a)); eat(dcos(a)); eat(datan2(x - 0.5, 0.3 - x)); eat(dexp(a)); eat(dlog(x + 1e-9)); eat(dpow(x, 1.4)); eat(dtanh(a / 20)); eat(dhypot(a, x));
    }
    expect(h.toString(16)).toMatchInlineSnapshot(`"e7082ee2"`);
  });
});
