/**
 * Modul 2 – Matrizen als Transformation: reine Rechenlogik.
 */
import { identity, lerpMat, matMul, det3, rank, trace, type Matrix } from '../../math/linalg';

/**
 * Matrix zum Animationszeitpunkt t.
 *  - ohne zweite Matrix: t ∈ [0,1], E → M
 *  - mit zweiter Matrix N ("erst M, dann N"): t ∈ [0,2], E → M → N·M
 */
export function transformAt(M: Matrix, t: number, N: Matrix | null = null): Matrix {
  if (!N) return lerpMat(identity(), M, Math.max(0, Math.min(1, t)));
  if (t <= 1) return lerpMat(identity(), M, Math.max(0, t));
  return lerpMat(M, matMul(N, M), Math.min(1, t - 1));
}

export type Orientation = 'erhalten' | 'gekippt' | 'entartet';

export interface MatrixStats {
  det: number;
  rank: number;
  trace: number;
  orientation: Orientation;
}

export function matrixStats(M: Matrix): MatrixStats {
  const d = det3(M);
  return {
    det: Math.abs(d) < 1e-12 ? 0 : d,
    rank: rank(M),
    trace: trace(M),
    orientation: Math.abs(d) < 1e-12 ? 'entartet' : d > 0 ? 'erhalten' : 'gekippt',
  };
}
