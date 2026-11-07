/**
 * Modul 5 – Eigenwerte und Eigenvektoren: Darstellungslogik (rein).
 */
import { matVec, cross, norm, type EigenResult, type Matrix, type Vec3 } from '../../math/linalg';
import { texNum, texPoly, type FormatOptions, defaultFormat } from '../../math/format';

/** Faktorisierte Form des charakteristischen Polynoms, z. B. (λ - 1)^{2}(λ - 3). */
export function texFactored(e: EigenResult, o: FormatOptions = defaultFormat): string {
  const lin = (r: number) => (Math.abs(r) < 1e-12 ? '\\lambda' : `(\\lambda ${r < 0 ? '+' : '-'} ${texNum(Math.abs(r), o)})`);
  const parts = e.real.map((s) => `${lin(s.lambda)}${s.alg > 1 ? `^{${s.alg}}` : ''}`);
  if (e.complex.length === 2) {
    const { re, im } = e.complex[0];
    parts.push(`(${texPoly([1, -2 * re, re * re + im * im], '\\lambda', { mode: 'dec', decimals: 3 })})`);
  }
  return parts.join('');
}

/** Ist v (≠ 0) ein Eigenvektor von A? */
export function isEigenvector(A: Matrix, v: Vec3): boolean {
  const n = norm(v);
  if (n < 1e-12) return false;
  return norm(cross(matVec(A, v), v)) < 1e-9 * Math.max(1, n * n);
}

/** Sucht einen Vergleichsvektor, der KEIN Eigenvektor ist (für den Kontrast). */
export function nonEigenVector(A: Matrix): Vec3 | null {
  const cands: Vec3[] = [[1, 0.6, 0.3], [0.3, 1, 0.6], [0.6, 0.3, 1], [1, -0.5, 0.8], [-0.4, 1, 0.9]];
  return cands.find((c) => !isEigenvector(A, c)) ?? null;
}

export { texPoly };
