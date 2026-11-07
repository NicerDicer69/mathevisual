import { describe, it, expect } from 'vitest';
import { runGramSchmidt, arrowsAt } from './math';
import { norm, type Vec3 } from '../../math/linalg';

const vs: Vec3[] = [[1, 1, 0], [1, 0, 1], [0, 1, 1]];

describe('Modul Gram-Schmidt', () => {
  it('Schrittfolge', () => {
    const { steps } = runGramSchmidt(vs);
    expect(steps.map((s) => s.kind)).toEqual(['start', 'u', 'e', 'proj', 'u', 'e', 'proj', 'u', 'e', 'done']);
  });
  it('am Ende drei Einheitsvektoren', () => {
    const { g, steps } = runGramSchmidt(vs);
    const final = arrowsAt(vs, g, steps, steps.length - 1).filter((a) => a.style === 'final');
    expect(final.length).toBe(3);
    final.forEach((a) => expect(norm(a.to)).toBeCloseTo(1));
  });
  it('Projektionsschritt zeigt Projektion', () => {
    const { g, steps } = runGramSchmidt(vs);
    const a = arrowsAt(vs, g, steps, 3);
    expect(a.some((x) => x.style === 'proj')).toBe(true);
  });
  it('bricht bei Abhängigkeit ab', () => {
    const { g, steps } = runGramSchmidt([[1, 0, 0], [2, 0, 0], [0, 1, 0]]);
    expect(g.failAt).toBe(1);
    expect(steps[steps.length - 1].kind).toBe('proj');
  });
});
