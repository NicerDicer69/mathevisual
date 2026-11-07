/**
 * Modul 1 – Vektoren: reine Rechenlogik.
 */
import { add, scale, dot, cross, norm, angle, project, type Vec3 } from '../../math/linalg';

export interface VectorOps {
  sum: Vec3;
  scaled: Vec3;
  dot: number;
  /** Winkel in Grad (null bei Nullvektor) */
  angleDeg: number | null;
  /** Projektion von a auf b */
  proj: Vec3;
  /** Skalare Projektion (Länge mit Vorzeichen) */
  projLen: number;
  cross: Vec3;
  lenA: number;
  lenB: number;
  /** Fläche des von a und b aufgespannten Parallelogramms = |a × b| */
  area: number;
  orthogonal: boolean;
  parallel: boolean;
}

export function vectorOps(a: Vec3, b: Vec3, k: number): VectorOps {
  const c = cross(a, b);
  const ang = angle(a, b);
  const lenB = norm(b);
  return {
    sum: add(a, b),
    scaled: scale(a, k),
    dot: dot(a, b),
    angleDeg: ang === null ? null : (ang * 180) / Math.PI,
    proj: project(a, b),
    projLen: lenB > 0 ? dot(a, b) / lenB : 0,
    cross: c,
    lenA: norm(a),
    lenB,
    area: norm(c),
    orthogonal: Math.abs(dot(a, b)) < 1e-9 && norm(a) > 0 && lenB > 0,
    parallel: norm(c) < 1e-9,
  };
}

/** Rundet einen Punkt auf ein Raster (für das Verschieben per Maus). */
export const snapVec = (v: Vec3, step = 0.1): Vec3 =>
  v.map((x) => Math.round(x / step) * step).map((x) => +x.toFixed(6)) as Vec3;

export interface PlaneEq {
  /** Normalenvektor */
  n: Vec3;
  /** rechte Seite der Koordinatenform n·x = d */
  d: number;
}

/** Ebene durch Stützpunkt p mit Richtungen u, v (null, falls u ∥ v). */
export function planeFromSpan(p: Vec3, u: Vec3, v: Vec3): PlaneEq | null {
  const n = cross(u, v);
  if (norm(n) < 1e-9) return null;
  return { n, d: dot(n, p) };
}

/** Ebene aus Koordinatenform a·x + b·y + c·z = d (null, falls (a,b,c) = 0). */
export function planeFromCoords(a: number, b: number, c: number, d: number): PlaneEq | null {
  const n: Vec3 = [a, b, c];
  if (norm(n) < 1e-12) return null;
  return { n, d };
}

/** Punkt der Ebene, der dem Ursprung am nächsten liegt (Mittelpunkt der Zeichnung). */
export function planeCenter(e: PlaneEq): Vec3 {
  return scale(e.n, e.d / dot(e.n, e.n));
}
