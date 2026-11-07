/**
 * Eigenschafts-Tests ("property-based"): Statt einzelner Beispiele werden
 * mathematische Gesetze an vielen zufälligen Matrizen geprüft, z. B.
 * Rangsatz, det(AB) = det(A)·det(B) oder A·x = b für die gefundene Lösung.
 * Der Zufallsgenerator ist fest initialisiert (Seed) → Tests sind reproduzierbar.
 */
import { describe, it, expect } from 'vitest';
import {
  rank, nullspace, matMul, matVec, det3, transpose, inverse3, identity, rref, solveLgs, gaussSteps,
  gramSchmidt, eigen, cubicRoots, spanInfo, dot, norm, trace, fromColumns, toFraction, type Matrix, type Vec3,
} from './linalg';
import { forwardSteps, applyOp, isEchelon, backSubstitute } from '../modules/gauss/math';

/** Reproduzierbarer Zufallsgenerator (mulberry32) */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261107);
const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const randMat = (r = 3, c = 3, lo = -5, hi = 5): Matrix => Array.from({ length: r }, () => Array.from({ length: c }, () => int(lo, hi)));
const randVec = (lo = -5, hi = 5): Vec3 => [int(lo, hi), int(lo, hi), int(lo, hi)];
/** Matrix mit vorgegebenem Rang (0–3) aus ganzzahligen Faktoren */
function matOfRank(r: number): Matrix {
  if (r === 0) return [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (;;) {
    const M = matMul(randMat(3, r, -3, 3), randMat(r, 3, -3, 3));
    if (rank(M) === r) return M;
  }
}
const N = 200;
const close = (a: number, b: number, tol = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(tol * Math.max(1, Math.abs(a), Math.abs(b)));

describe('Invarianten: Rang, Kern, Determinante', () => {
  it('Rangsatz rank(A) + dim ker(A) = 3 und A·k = 0 für jeden Kernvektor', () => {
    for (let i = 0; i < N; i++) {
      const A = matOfRank(i % 4);
      const ker = nullspace(A);
      expect(rank(A) + ker.length).toBe(3);
      for (const k of ker) matVec(A, k as Vec3).forEach((x) => close(x, 0));
    }
  });
  it('det(AB) = det(A)·det(B) und det(Aᵀ) = det(A)', () => {
    for (let i = 0; i < N; i++) {
      const A = randMat(), B = randMat();
      close(det3(matMul(A, B)), det3(A) * det3(B));
      close(det3(transpose(A)), det3(A));
    }
  });
  it('A·A⁻¹ = E, falls det(A) ≠ 0 – sonst keine Inverse', () => {
    for (let i = 0; i < N; i++) {
      const A = randMat();
      const inv = inverse3(A);
      if (det3(A) === 0) { expect(inv).toBeNull(); continue; }
      matMul(A, inv!).forEach((r, a) => r.forEach((x, b) => close(x, identity()[a][b])));
    }
  });
  it('rref ist idempotent: rref(rref(A)) = rref(A)', () => {
    for (let i = 0; i < N; i++) {
      const R = rref(randMat(3, 4)).R;
      rref(R).R.forEach((r, a) => r.forEach((x, b) => close(x, R[a][b])));
    }
  });
});

describe('Invarianten: Gleichungssysteme', () => {
  it('Lösung erfüllt A·x = b (auch bei unendlich vielen Lösungen)', () => {
    for (let i = 0; i < N; i++) {
      const A = matOfRank(1 + (i % 3));
      const b = matVec(A, randVec()); // garantiert lösbar
      const s = solveLgs(A, b);
      expect(s.type).not.toBe('empty');
      matVec(A, s.point!).forEach((x, k) => close(x, b[k]));
      for (const d of s.dirs) matVec(A, d).forEach((x) => close(x, 0));
    }
  });
  it('Gauß-Jordan-Schritte enden in der reduzierten Zeilenstufenform', () => {
    // Die rechte Seite wird nie Pivot (Widerspruchszeilen bleiben "0 = c" stehen),
    // daher: Koeffiziententeil = rref(A); bei lösbaren Systemen ganze Matrix = rref(A|b).
    for (let i = 0; i < N; i++) {
      const M = randMat(3, 4);
      const steps = gaussSteps(M);
      const last = steps[steps.length - 1].matrix;
      const RA = rref(M.map((r) => r.slice(0, 3))).R;
      last.forEach((r, a) => r.slice(0, 3).forEach((x, b) => close(x, RA[a][b])));
      if (rank(M) === rank(M.map((r) => r.slice(0, 3)))) {
        const R = rref(M).R;
        last.forEach((r, a) => r.forEach((x, b) => close(x, R[a][b])));
      }
    }
  });
  it('Gauß-Trainer: Zeilenstufenform + Rückwärtseinsetzen löst das Originalsystem', () => {
    for (let i = 0; i < N; i++) {
      const A = matOfRank(1 + (i % 3));
      const x0 = randVec();
      const b = matVec(A, x0);
      const M = A.map((r, k) => [...r, b[k]]);
      const E = forwardSteps(M).reduce((m, s) => applyOp(m, s.op), M);
      expect(isEchelon(E)).toBe(true);
      const bs = backSubstitute(E);
      expect(bs.kind).not.toBe('none');
      // Lösung für einige Parameterwerte t, s prüfen
      for (const [t, s] of [[0, 0], [1, -2], [-3, 5]]) {
        const x = bs.solution!.map((a) => a.c + a.t * t + a.s * s) as Vec3;
        matVec(A, x).forEach((v, k) => close(v, b[k]));
      }
    }
  });
  it('Gauß-Trainer erkennt unlösbare Systeme', () => {
    for (let i = 0; i < 50; i++) {
      const A = matOfRank(2);
      // b außerhalb des Bildes: Normalenvektor des Bildes addieren
      const img = fromColumns(nullspace(transpose(A)));
      const n = img.map((r) => r[0]) as Vec3;
      const b = matVec(A, randVec()).map((x, k) => x + n[k]) as Vec3;
      const M = A.map((r, k) => [...r, b[k]]);
      const E = forwardSteps(M).reduce((m, s) => applyOp(m, s.op), M);
      expect(backSubstitute(E).kind).toBe('none');
    }
  });
});

describe('Invarianten: Gram-Schmidt, Span, Eigenwerte', () => {
  it('Gram-Schmidt liefert eine Orthonormalbasis desselben Spans', () => {
    for (let i = 0; i < N; i++) {
      const vs = [randVec(), randVec(), randVec()];
      const g = gramSchmidt(vs);
      if (rank(fromColumns(vs)) < 3) { expect(g.failAt).toBeGreaterThanOrEqual(0); continue; }
      g.es.forEach((e, a) => g.es.forEach((f, b) => close(dot(e, f), a === b ? 1 : 0)));
      // e_k liegt in span(v_1..v_k)
      g.es.forEach((e, k) => expect(rank(fromColumns([...vs.slice(0, k + 1), e]))).toBe(k + 1));
    }
  });
  it('Linearkombination bei Abhängigkeit ergibt wirklich den Nullvektor', () => {
    for (let i = 0; i < N; i++) {
      const v1 = randVec(), v2 = randVec();
      const a = int(-2, 2), b = int(-2, 2); // Faktoren einmal würfeln → v3 = a·v1 + b·v2
      const v3 = [0, 1, 2].map((k) => a * v1[k] + b * v2[k]) as Vec3;
      const s = spanInfo([v1, v2, v3]);
      expect(s.independent).toBe(false);
      const sum = [0, 1, 2].map((k) => s.combination!.reduce((acc, c, j) => acc + c * [v1, v2, v3][j][k], 0));
      sum.forEach((x) => close(x, 0));
      expect(norm(s.combination!)).toBeGreaterThan(0);
    }
  });
  it('kubische Nullstellen werden aus (λ-r₁)(λ-r₂)(λ-r₃) exakt zurückgewonnen', () => {
    for (let i = 0; i < N; i++) {
      const r = [int(-6, 6), int(-6, 6), int(-6, 6)].sort((a, b) => a - b);
      const b = -(r[0] + r[1] + r[2]), c = r[0] * r[1] + r[0] * r[2] + r[1] * r[2], d = -r[0] * r[1] * r[2];
      const got = cubicRoots(b, c, d).map((z) => z.re).sort((a, b) => a - b);
      got.forEach((x, k) => close(x, r[k], 1e-6));
    }
  });
  it('symmetrische Matrizen: A·v = λ·v, Σλ = Spur, Πλ = det, diagonalisierbar', () => {
    for (let i = 0; i < N; i++) {
      const B = randMat(3, 3, -3, 3);
      const A = matMul(B, transpose(B)).map((r, a) => r.map((x, b) => (a === b ? x - 4 : x))); // symmetrisch
      const e = eigen(A);
      expect(e.complex.length).toBe(0);
      const lambdas = e.real.flatMap((s) => Array(s.alg).fill(s.lambda) as number[]);
      expect(lambdas.length).toBe(3);
      close(lambdas.reduce((a, b) => a + b, 0), trace(A), 1e-5);
      close(lambdas.reduce((a, b) => a * b, 1), det3(A), 1e-4);
      for (const s of e.real) for (const v of s.basis) matVec(A, v).forEach((x, k) => close(x, s.lambda * v[k], 1e-5));
      expect(e.diagonalizable).toBe(true);
    }
  });
});

describe('Invarianten: Brüche', () => {
  it('toFraction erkennt jeden Bruch n/d mit d ≤ 50 exakt', () => {
    for (let i = 0; i < N; i++) {
      const d = int(1, 50), n = int(-200, 200);
      const f = toFraction(n / d)!;
      expect(f.n * d).toBe(n * f.d);
    }
  });
});
