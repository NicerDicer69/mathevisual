import { describe, it, expect } from 'vitest';
import { texFactored, isEigenvector, nonEigenVector } from './math';
import { eigen, identity } from '../../math/linalg';

describe('Modul Eigenwerte', () => {
  it('faktorisiertes Polynom', () => {
    expect(texFactored(eigen([[1, 1, 0], [0, 1, 0], [0, 0, 1]]))).toBe('(\\lambda - 1)^{3}');
    expect(texFactored(eigen([[2, 0, 0], [0, -1, 0], [0, 0, 0]]))).toBe('(\\lambda - 2)\\lambda(\\lambda + 1)');
    expect(texFactored(eigen([[0, -1, 0], [1, 0, 0], [0, 0, 1]]))).toBe('(\\lambda - 1)(\\lambda^{2} + 1)');
  });
  it('Eigenvektor-Test', () => {
    const A = [[2, 0, 0], [0, 3, 0], [0, 0, 4]];
    expect(isEigenvector(A, [0, 1, 0])).toBe(true);
    expect(isEigenvector(A, [1, 1, 0])).toBe(false);
    expect(nonEigenVector(identity())).toBeNull();
    expect(nonEigenVector(A)).not.toBeNull();
  });
});
