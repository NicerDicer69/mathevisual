/**
 * Modul 4 – Lineare Unabhängigkeit, Span, Basis: reine Logik.
 */
import { spanInfo, solve, fromColumns, cross, dot, norm, scale, add, type Vec3, type SpanInfo } from '../../math/linalg';

export interface SpanAnalysis extends SpanInfo {
  dim: number;
  /** "Nullraum", "Gerade", "Ebene", "ganzer Raum" */
  kind: 'point' | 'line' | 'plane' | 'space';
  /** Punkte des Rundwegs: 0 → c1·v1 → c1·v1 + c2·v2 → … → 0 */
  loop: Vec3[];
}

export function analyzeSpan(vs: Vec3[]): SpanAnalysis {
  const info = spanInfo(vs);
  const dim = info.rank;
  const kind = (['point', 'line', 'plane', 'space'] as const)[dim];
  const loop: Vec3[] = [];
  if (info.combination) {
    let p: Vec3 = [0, 0, 0];
    loop.push(p);
    info.combination.forEach((c, i) => {
      if (c === 0) return;
      p = add(p, scale(vs[i], c));
      loop.push(p);
    });
  }
  return { ...info, dim, kind, loop };
}

/** Koordinaten von w bezüglich der Basis B = (b1, b2, b3); null, falls B keine Basis ist. */
export function coordsInBasis(basis: Vec3[], w: Vec3): Vec3 | null {
  if (basis.length !== 3) return null;
  return solve(fromColumns(basis), w) as Vec3 | null;
}

/** Abstand des Punktes p von der Ebene span(a, b) durch den Ursprung. */
export function distanceToPlane(a: Vec3, b: Vec3, p: Vec3): number | null {
  const n = cross(a, b);
  const nn = norm(n);
  if (nn < 1e-12) return null;
  return Math.abs(dot(n, p)) / nn;
}
