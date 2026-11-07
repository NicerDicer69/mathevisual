/**
 * Reine Mathe-Logik für Lineare Algebra (keine Abhängigkeit zu Three.js oder DOM).
 * Alle Funktionen arbeiten mit einfachen Zahlen-Arrays und sind damit gut testbar.
 *
 * Konventionen:
 *  - Vec3   = [x, y, z]
 *  - Matrix = Zeilen-Array (row-major), z. B. A[i][j] = Zeile i, Spalte j
 */

export type Vec3 = [number, number, number];
export type Vec = number[];
export type Matrix = number[][];

/** Relative Toleranz für numerische Vergleiche. */
export const EPS = 1e-9;

// ---------------------------------------------------------------------------
// Vektoren
// ---------------------------------------------------------------------------

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec, b: Vec): number => a.reduce((s, x, i) => s + x * b[i], 0);
export const norm = (a: Vec): number => Math.sqrt(dot(a, a));
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export function isZero(a: Vec, eps = EPS): boolean {
  return a.every((x) => Math.abs(x) <= eps);
}

/** Einheitsvektor oder null, falls a der Nullvektor ist. */
export function normalize(a: Vec3): Vec3 | null {
  const n = norm(a);
  return n < EPS ? null : scale(a, 1 / n);
}

/** Winkel zwischen a und b in Bogenmaß (null, falls ein Vektor 0 ist). */
export function angle(a: Vec3, b: Vec3): number | null {
  const na = norm(a);
  const nb = norm(b);
  if (na < EPS || nb < EPS) return null;
  const c = Math.min(1, Math.max(-1, dot(a, b) / (na * nb)));
  return Math.acos(c);
}

/** Orthogonale Projektion von a auf die Richtung b. */
export function project(a: Vec3, b: Vec3): Vec3 {
  const bb = dot(b, b);
  if (bb < EPS) return [0, 0, 0];
  return scale(b, dot(a, b) / bb);
}

/** Kosmetik: sehr kleine Werte auf 0 setzen (vermeidet "-0" und 1e-17). */
export function clean(x: number, eps = 1e-12): number {
  return Math.abs(x) < eps ? 0 : x;
}
export const cleanVec = <T extends Vec>(v: T): T => v.map((x) => clean(x)) as T;

// ---------------------------------------------------------------------------
// Matrizen
// ---------------------------------------------------------------------------

export const identity = (n = 3): Matrix =>
  Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

export const cloneM = (A: Matrix): Matrix => A.map((r) => r.slice());

export function matMul(A: Matrix, B: Matrix): Matrix {
  const m = A.length;
  const n = B[0].length;
  const k = B.length;
  const C: Matrix = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let l = 0; l < k; l++) s += A[i][l] * B[l][j];
      C[i][j] = s;
    }
  return C;
}

export function matVec(A: Matrix, v: Vec3): Vec3 {
  return [0, 1, 2].map((i) => A[i][0] * v[0] + A[i][1] * v[1] + A[i][2] * v[2]) as Vec3;
}

export const transpose = (A: Matrix): Matrix => A[0].map((_, j) => A.map((r) => r[j]));

export function det3(A: Matrix): number {
  return (
    A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
    A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
    A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0])
  );
}

export const trace = (A: Matrix): number => A.reduce((s, r, i) => s + r[i], 0);

/** Lineare Interpolation (1-t)·A + t·B. */
export function lerpMat(A: Matrix, B: Matrix, t: number): Matrix {
  return A.map((r, i) => r.map((x, j) => (1 - t) * x + t * B[i][j]));
}

/** Spaltenvektoren einer 3×n-Matrix. */
export const columns = (A: Matrix): Vec3[] => A[0].map((_, j) => [A[0][j], A[1][j], A[2][j]] as Vec3);

/** Baut aus Spaltenvektoren eine Matrix. */
export const fromColumns = (cols: Vec[]): Matrix =>
  cols[0].map((_, i) => cols.map((c) => c[i]));

export function inverse3(A: Matrix): Matrix | null {
  const d = det3(A);
  if (Math.abs(d) < EPS) return null;
  const c = (i: number, j: number) => {
    const r = [0, 1, 2].filter((x) => x !== i);
    const s = [0, 1, 2].filter((x) => x !== j);
    return A[r[0]][s[0]] * A[r[1]][s[1]] - A[r[0]][s[1]] * A[r[1]][s[0]];
  };
  // Adjunkte / Determinante
  return [0, 1, 2].map((i) => [0, 1, 2].map((j) => (((i + j) % 2 ? -1 : 1) * c(j, i)) / d));
}

// ---------------------------------------------------------------------------
// Spezielle Matrizen (Voreinstellungen)
// ---------------------------------------------------------------------------

/** Drehmatrix um eine Achse (Rodrigues-Formel), Winkel in Bogenmaß. */
export function rotationMatrix(axis: Vec3, theta: number): Matrix {
  const u = normalize(axis) ?? [0, 0, 1];
  const [x, y, z] = u;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const C = 1 - c;
  return [
    [c + x * x * C, x * y * C - z * s, x * z * C + y * s],
    [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
    [z * x * C - y * s, z * y * C + x * s, c + z * z * C],
  ].map((r) => r.map((v) => clean(v)));
}

/** Spiegelung an der Ebene mit Normalenvektor n: I - 2·n·nᵀ. */
export function reflectionMatrix(n: Vec3): Matrix {
  const u = normalize(n) ?? [0, 0, 1];
  return identity().map((r, i) => r.map((v, j) => clean(v - 2 * u[i] * u[j])));
}

/** Orthogonale Projektion auf die Ebene mit Normale n: I - n·nᵀ. */
export function projectionPlaneMatrix(n: Vec3): Matrix {
  const u = normalize(n) ?? [0, 0, 1];
  return identity().map((r, i) => r.map((v, j) => clean(v - u[i] * u[j])));
}

/** Orthogonale Projektion auf die Gerade mit Richtung d: d·dᵀ. */
export function projectionLineMatrix(d: Vec3): Matrix {
  const u = normalize(d) ?? [1, 0, 0];
  return [0, 1, 2].map((i) => [0, 1, 2].map((j) => clean(u[i] * u[j])));
}

export const stretchMatrix = (sx: number, sy: number, sz: number): Matrix => [
  [sx, 0, 0],
  [0, sy, 0],
  [0, 0, sz],
];

/** Scherung: Eintrag (i, j) der Einheitsmatrix wird auf k gesetzt (i ≠ j). */
export function shearMatrix(i: number, j: number, k: number): Matrix {
  const M = identity();
  if (i !== j) M[i][j] = k;
  return M;
}

// ---------------------------------------------------------------------------
// Gauß / Rang / Kern / Bild
// ---------------------------------------------------------------------------

export interface RrefResult {
  R: Matrix;
  pivots: number[];
  rank: number;
}

function maxAbs(A: Matrix): number {
  let m = 0;
  for (const r of A) for (const x of r) m = Math.max(m, Math.abs(x));
  return m;
}

/** Reduzierte Zeilenstufenform (Gauß-Jordan) mit Spaltenpivotisierung. */
export function rref(M: Matrix, eps = EPS): RrefResult {
  const A = cloneM(M);
  const m = A.length;
  const n = A[0]?.length ?? 0;
  const tol = eps * Math.max(1, maxAbs(A));
  const pivots: number[] = [];
  let r = 0;
  for (let c = 0; c < n && r < m; c++) {
    let p = r;
    for (let i = r + 1; i < m; i++) if (Math.abs(A[i][c]) > Math.abs(A[p][c])) p = i;
    if (Math.abs(A[p][c]) <= tol) {
      for (let i = r; i < m; i++) A[i][c] = 0;
      continue;
    }
    [A[r], A[p]] = [A[p], A[r]];
    const piv = A[r][c];
    for (let j = 0; j < n; j++) A[r][j] /= piv;
    for (let i = 0; i < m; i++) {
      if (i === r) continue;
      const f = A[i][c];
      if (f !== 0) for (let j = 0; j < n; j++) A[i][j] -= f * A[r][j];
    }
    pivots.push(c);
    r++;
  }
  for (const row of A) for (let j = 0; j < n; j++) if (Math.abs(row[j]) <= tol) row[j] = 0;
  return { R: A, pivots, rank: pivots.length };
}

export const rank = (M: Matrix, eps = EPS): number => rref(M, eps).rank;

/** Basis des Kerns (Nullraums) von M. */
export function nullspace(M: Matrix, eps = EPS): Vec[] {
  const { R, pivots } = rref(M, eps);
  const n = M[0].length;
  const free = [...Array(n).keys()].filter((c) => !pivots.includes(c));
  return free.map((f) => {
    const x = new Array(n).fill(0);
    x[f] = 1;
    pivots.forEach((p, i) => (x[p] = clean(-R[i][f])));
    return x;
  });
}

/** Basis des Bildes (Spaltenraums): die Pivotspalten der Originalmatrix. */
export function columnSpace(M: Matrix, eps = EPS): Vec[] {
  const { pivots } = rref(M, eps);
  return pivots.map((j) => M.map((r) => r[j]));
}

/** Löst A x = b (A quadratisch, regulär). Gibt null zurück, falls nicht eindeutig. */
export function solve(A: Matrix, b: Vec): Vec | null {
  const n = A.length;
  const aug = A.map((r, i) => [...r, b[i]]);
  const { R, pivots } = rref(aug);
  if (pivots.length !== n || pivots.includes(n)) return null;
  return R.map((r) => clean(r[n]));
}

// ---------------------------------------------------------------------------
// Brüche
// ---------------------------------------------------------------------------

export interface Fraction {
  n: number;
  d: number;
}

/** Kettenbruch-Näherung; null, wenn x nicht (hinreichend genau) rational ist. */
export function toFraction(x: number, maxDen = 1000, tol = 1e-9): Fraction | null {
  if (!isFinite(x)) return null;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  let h1 = 1, h0 = 0, k1 = 0, k0 = 1;
  let b = ax;
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(b);
    const h2 = a * h1 + h0;
    const k2 = a * k1 + k0;
    if (k2 > maxDen) break;
    h0 = h1; h1 = h2; k0 = k1; k1 = k2;
    if (Math.abs(ax - h1 / k1) <= tol * Math.max(1, ax)) return { n: sign * h1, d: k1 };
    const frac = b - a;
    if (frac < 1e-15) break;
    b = 1 / frac;
  }
  if (k1 > 0 && Math.abs(ax - h1 / k1) <= tol * Math.max(1, ax)) return { n: sign * h1, d: k1 };
  return null;
}

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const lcm = (a: number, b: number): number => Math.abs(a * b) / gcd(a, b);

/**
 * Skaliert einen Vektor auf möglichst kleine ganze Zahlen (falls rational),
 * sonst auf maximalen Betrag 1. Beispiel: (0.5, -0.5, 1) → (1, -1, 2).
 */
export function integerize(v: Vec): Vec {
  const fr = v.map((x) => toFraction(x, 1000));
  if (fr.every((f) => f !== null)) {
    const L = (fr as Fraction[]).reduce((acc, f) => lcm(acc, f.d), 1);
    const ints = (fr as Fraction[]).map((f) => (f.n * L) / f.d);
    const g = ints.reduce((acc, x) => gcd(acc, Math.round(x)), 0) || 1;
    return ints.map((x) => clean(Math.round(x) / g));
  }
  const m = Math.max(...v.map(Math.abs)) || 1;
  return v.map((x) => clean(x / m));
}

// ---------------------------------------------------------------------------
// Lineare Unabhängigkeit / Span
// ---------------------------------------------------------------------------

export interface SpanInfo {
  rank: number;
  independent: boolean;
  /** Indizes der Vektoren, die eine Basis des Spans bilden. */
  basisIdx: number[];
  /** Nichttriviale Linearkombination, die 0 ergibt (nur bei Abhängigkeit). */
  combination: Vec | null;
  /** Normalenvektor (ganzzahlig, falls möglich) bei Span-Dimension 2. */
  planeNormal: Vec3 | null;
  /** Richtung bei Span-Dimension 1. */
  lineDir: Vec3 | null;
}

export function spanInfo(vs: Vec3[]): SpanInfo {
  if (vs.length === 0)
    return { rank: 0, independent: true, basisIdx: [], combination: null, planeNormal: null, lineDir: null };
  const M = fromColumns(vs);
  const { pivots, rank: r } = rref(M);
  const independent = r === vs.length;
  let combination: Vec | null = null;
  if (!independent) {
    const ns = nullspace(M);
    let c = integerize(ns[0]);
    // Vorzeichen so wählen, dass der letzte Koeffizient ≠ 0 positiv ist
    const last = [...c].reverse().find((x) => x !== 0) ?? 1;
    if (last < 0) c = c.map((x) => clean(-x));
    combination = c;
  }
  let planeNormal: Vec3 | null = null;
  let lineDir: Vec3 | null = null;
  if (r === 2) {
    let n = integerize(cross(vs[pivots[0]], vs[pivots[1]])) as Vec3;
    const first = n.find((x) => x !== 0) ?? 1;
    if (first < 0) n = n.map((x) => clean(-x)) as Vec3;
    planeNormal = n;
  } else if (r === 1) {
    lineDir = vs[pivots[0]];
  }
  return { rank: r, independent, basisIdx: pivots, combination, planeNormal, lineDir };
}

// ---------------------------------------------------------------------------
// Polynome & Eigenwerte
// ---------------------------------------------------------------------------

export interface Complex {
  re: number;
  im: number;
}

/**
 * Charakteristisches Polynom p(λ) = det(λI − A) = λ³ + c2·λ² + c1·λ + c0.
 * Rückgabe: [1, c2, c1, c0].
 */
export function charPoly(A: Matrix): number[] {
  const tr = trace(A);
  const m =
    A[0][0] * A[1][1] - A[0][1] * A[1][0] +
    A[0][0] * A[2][2] - A[0][2] * A[2][0] +
    A[1][1] * A[2][2] - A[1][2] * A[2][1];
  return [1, clean(-tr), clean(m), clean(-det3(A))];
}

/** Rundet auf "schöne" Brüche, wenn sehr nah dran (stabilisiert Mehrfachnullstellen). */
function snap(x: number, tol = 1e-6): number {
  const f = toFraction(x, 24, tol);
  return f ? f.n / f.d : x;
}

/** Nullstellen eines monischen kubischen Polynoms λ³ + b λ² + c λ + d. */
export function cubicRoots(b: number, c: number, d: number): Complex[] {
  const p = (x: number) => ((x + b) * x + c) * x + d;
  const R = 1 + Math.max(Math.abs(b), Math.abs(c), Math.abs(d));
  const ptol = 1e-10 * Math.max(1, Math.abs(b), Math.abs(c), Math.abs(d));
  // 1) Exakte rationale Nullstelle n/q mit kleinem Nenner suchen – das ist bei
  //    Mehrfachnullstellen (z. B. (λ-1)³) viel stabiler als jede Iteration.
  let r = NaN;
  search: for (let q = 1; q <= 6; q++) {
    const maxN = Math.min(Math.ceil(R * q), 600);
    for (let n = 0; n <= maxN; n++)
      for (const s of n === 0 ? [1] : [1, -1]) {
        const x = (s * n) / q;
        if (Math.abs(p(x)) <= ptol) { r = x; break search; }
      }
  }
  // 2) Sonst: eine reelle Nullstelle existiert immer → Bisektion im Cauchy-Intervall
  if (isNaN(r)) {
    let lo = -R, hi = R;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (p(mid) > 0) hi = mid;
      else lo = mid;
    }
    r = snap((lo + hi) / 2);
  }
  // Newton-Politur (falls nicht gesnappt)
  for (let i = 0; i < 5; i++) {
    const dp = (3 * r + 2 * b) * r + c;
    if (Math.abs(dp) < 1e-12) break;
    const nr = r - p(r) / dp;
    if (Math.abs(p(nr)) < Math.abs(p(r))) r = nr;
  }
  r = snap(r);
  // Deflation: λ² + B λ + C
  const B = b + r;
  const C = c + r * B;
  const disc = B * B - 4 * C;
  const scaleTol = 1e-7 * Math.max(1, B * B, Math.abs(C));
  const roots: Complex[] = [{ re: r, im: 0 }];
  if (disc > scaleTol) {
    const s = Math.sqrt(disc);
    roots.push({ re: snap((-B + s) / 2), im: 0 }, { re: snap((-B - s) / 2), im: 0 });
  } else if (disc >= -scaleTol) {
    const x = snap(-B / 2);
    roots.push({ re: x, im: 0 }, { re: x, im: 0 });
  } else {
    const s = Math.sqrt(-disc) / 2;
    roots.push({ re: clean(-B / 2), im: s }, { re: clean(-B / 2), im: -s });
  }
  // Cluster sehr naher reeller Nullstellen zusammenfassen
  const reals = roots.filter((z) => z.im === 0);
  for (let i = 0; i < reals.length; i++)
    for (let j = i + 1; j < reals.length; j++)
      if (Math.abs(reals[i].re - reals[j].re) < 1e-5) reals[j].re = reals[i].re;
  return roots.map((z) => ({ re: clean(z.re), im: clean(z.im) }));
}

export interface EigenSpace {
  lambda: number;
  /** algebraische Vielfachheit */
  alg: number;
  /** geometrische Vielfachheit = dim Eigenraum */
  geo: number;
  basis: Vec3[];
}

export interface EigenResult {
  poly: number[];
  roots: Complex[];
  real: EigenSpace[];
  complex: Complex[];
  diagonalizable: boolean;
}

export function eigen(A: Matrix): EigenResult {
  const poly = charPoly(A);
  const roots = cubicRoots(poly[1], poly[2], poly[3]);
  const realRoots = roots.filter((z) => z.im === 0).map((z) => z.re).sort((a, b) => b - a);
  const complex = roots.filter((z) => z.im !== 0);
  const real: EigenSpace[] = [];
  for (const l of realRoots) {
    const existing = real.find((e) => Math.abs(e.lambda - l) < 1e-6);
    if (existing) {
      existing.alg++;
      continue;
    }
    const shifted = A.map((r, i) => r.map((x, j) => x - (i === j ? l : 0)));
    // etwas großzügigere Toleranz, da λ numerisch bestimmt wurde
    let basis = nullspace(shifted, 1e-7).map((v) => integerize(v) as Vec3);
    if (basis.length === 0) basis = nullspace(shifted, 1e-5).map((v) => integerize(v) as Vec3);
    real.push({ lambda: l, alg: 1, geo: basis.length, basis });
  }
  for (const e of real) e.geo = Math.min(e.geo, e.alg);
  const diagonalizable = complex.length === 0 && real.reduce((s, e) => s + e.geo, 0) === 3;
  return { poly, roots, real, complex, diagonalizable };
}

// ---------------------------------------------------------------------------
// Lineare Gleichungssysteme
// ---------------------------------------------------------------------------

export type RowOp =
  | { type: 'swap'; i: number; j: number }
  | { type: 'scale'; i: number; factor: number }
  | { type: 'add'; target: number; source: number; factor: number };

export interface GaussStep {
  op: RowOp | null;
  matrix: Matrix;
}

/**
 * Gauß-Jordan-Verfahren Schritt für Schritt (wie von Hand: erstes Element ≠ 0
 * als Pivot). Jede Zeilenoperation ist ein eigener Schritt. Schritt 0 = Start.
 */
export function gaussSteps(M: Matrix, eps = EPS): GaussStep[] {
  const A = cloneM(M);
  const m = A.length;
  const n = A[0].length - 1; // letzte Spalte = rechte Seite
  const tol = eps * Math.max(1, maxAbs(A));
  const tidy = () => {
    for (const row of A) for (let j = 0; j <= n; j++) row[j] = Math.abs(row[j]) <= tol ? 0 : row[j];
  };
  const steps: GaussStep[] = [{ op: null, matrix: cloneM(A) }];
  const push = (op: RowOp) => {
    tidy();
    steps.push({ op, matrix: cloneM(A) });
  };
  let r = 0;
  for (let c = 0; c < n && r < m; c++) {
    let p = -1;
    for (let i = r; i < m; i++) if (Math.abs(A[i][c]) > tol) { p = i; break; }
    if (p < 0) continue;
    if (p !== r) {
      [A[r], A[p]] = [A[p], A[r]];
      push({ type: 'swap', i: r, j: p });
    }
    const piv = A[r][c];
    if (Math.abs(piv - 1) > tol) {
      for (let j = 0; j <= n; j++) A[r][j] /= piv;
      A[r][c] = 1;
      push({ type: 'scale', i: r, factor: 1 / piv });
    }
    for (let i = 0; i < m; i++) {
      if (i === r) continue;
      const f = A[i][c];
      if (Math.abs(f) <= tol) continue;
      for (let j = 0; j <= n; j++) A[i][j] -= f * A[r][j];
      A[i][c] = 0;
      push({ type: 'add', target: i, source: r, factor: -f });
    }
    r++;
  }
  return steps;
}

export type SolutionType = 'point' | 'line' | 'plane' | 'space' | 'empty';

export interface LgsSolution {
  type: SolutionType;
  rankA: number;
  rankAug: number;
  /** Partikuläre Lösung (falls lösbar) */
  point: Vec3 | null;
  /** Richtungsvektoren des Lösungsraums (= Basis des Kerns von A) */
  dirs: Vec3[];
}

export function solveLgs(A: Matrix, b: Vec3): LgsSolution {
  const aug = A.map((r, i) => [...r, b[i]]);
  const rankA = rank(A);
  const ra = rref(aug);
  const rankAug = ra.rank;
  if (rankAug > rankA) return { type: 'empty', rankA, rankAug, point: null, dirs: [] };
  const x: Vec3 = [0, 0, 0];
  ra.pivots.forEach((p, i) => {
    if (p < 3) x[p] = clean(ra.R[i][3]);
  });
  const dirs = nullspace(A).map((v) => integerize(v) as Vec3);
  const type: SolutionType = (['point', 'line', 'plane', 'space'] as const)[dirs.length];
  return { type, rankA, rankAug, point: x, dirs };
}

// ---------------------------------------------------------------------------
// Gram-Schmidt
// ---------------------------------------------------------------------------

export interface GramSchmidtResult {
  /** orthogonale (nicht normierte) Vektoren u_k */
  us: Vec3[];
  /** orthonormale Vektoren e_k */
  es: Vec3[];
  /** projs[k] = Liste der Projektionen von v_k auf e_0 … e_{k-1} */
  projs: Vec3[][];
  /** Index des ersten linear abhängigen Vektors (oder -1) */
  failAt: number;
}

export function gramSchmidt(vs: Vec3[]): GramSchmidtResult {
  const us: Vec3[] = [];
  const es: Vec3[] = [];
  const projs: Vec3[][] = [];
  for (let k = 0; k < vs.length; k++) {
    const pk = es.map((e) => scale(e, dot(vs[k], e)));
    projs.push(pk);
    const u = cleanVec(pk.reduce((acc, p) => sub(acc, p), vs[k]));
    const n = norm(u);
    if (n < 1e-9 * Math.max(1, norm(vs[k]))) return { us, es, projs, failAt: k };
    us.push(u);
    es.push(cleanVec(scale(u, 1 / n)));
  }
  return { us, es, projs, failAt: -1 };
}
