import { describe, it, expect } from 'vitest';
import { transformAt, matrixStats } from './math';
import { identity, matMul } from '../../math/linalg';

const M = [[2, 0, 0], [0, 1, 0], [0, 0, 1]];
const N = [[0, -1, 0], [1, 0, 0], [0, 0, 1]];

describe('Modul Matrizen', () => {
  it('Animation: t=0 ist E, t=1 ist M', () => {
    expect(transformAt(M, 0)).toEqual(identity());
    expect(transformAt(M, 1)).toEqual(M);
    expect(transformAt(M, 0.5)[0][0]).toBe(1.5);
  });
  it('Produkt: t=2 ist N·M (erst M, dann N)', () => {
    expect(transformAt(M, 1, N)).toEqual(M);
    expect(transformAt(M, 2, N)).toEqual(matMul(N, M));
  });
  it('Kenngrößen', () => {
    expect(matrixStats(M)).toEqual({ det: 2, rank: 3, trace: 4, orientation: 'erhalten' });
    expect(matrixStats([[-1, 0, 0], [0, 1, 0], [0, 0, 1]]).orientation).toBe('gekippt');
    const P = matrixStats([[1, 0, 0], [0, 1, 0], [0, 0, 0]]);
    expect(P.rank).toBe(2);
    expect(P.orientation).toBe('entartet');
  });
});
