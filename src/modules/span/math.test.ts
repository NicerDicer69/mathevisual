import { describe, it, expect } from 'vitest';
import { analyzeSpan, coordsInBasis, distanceToPlane } from './math';
import { parseVec } from '../../math/parse';
import { texPlane, texLinComb } from '../../math/format';
import type { Vec3 } from '../../math/linalg';

describe('Modul Span – Akzeptanzkriterium', () => {
  // genau wie in der App: Einträge als Strings mit Parameter a
  const input = [['1', '1', '0'], ['0', '1', '1'], ['1', '2', 'a']];
  const vecs = (a: number) => input.map((v) => parseVec(v, { a }) as Vec3);

  it('a = 1 → abhängig, Dimension 2, Ebene x - y + z = 0', () => {
    const s = analyzeSpan(vecs(1));
    expect(s.independent).toBe(false);
    expect(s.dim).toBe(2);
    expect(s.kind).toBe('plane');
    expect(texPlane(s.planeNormal!)).toBe('x - y + z = 0');
    expect(texLinComb(s.combination!, ['v_1', 'v_2', 'v_3'])).toBe('-v_1 - v_2 + v_3');
    // Rundweg ist geschlossen
    const last = s.loop[s.loop.length - 1];
    last.forEach((x) => expect(x).toBeCloseTo(0));
    expect(s.loop.length).toBe(4);
  });

  it('a = 2 → unabhängig, ganzer Raum', () => {
    const s = analyzeSpan(vecs(2));
    expect(s.independent).toBe(true);
    expect(s.kind).toBe('space');
  });

  it('Abstand von v3 zur Ebene span(v1, v2) ist |a-1|/√3', () => {
    const v = vecs(3);
    expect(distanceToPlane(v[0], v[1], v[2])).toBeCloseTo(2 / Math.sqrt(3));
  });
});

describe('Basiswechsel', () => {
  it('Koordinaten bezüglich einer Basis', () => {
    const B: Vec3[] = [[1, 1, 0], [0, 1, 1], [1, 0, 1]];
    const c = coordsInBasis(B, [2, 2, 2])!;
    c.forEach((x) => expect(x).toBeCloseTo(1));
    expect(coordsInBasis([[1, 0, 0], [2, 0, 0], [0, 0, 1]], [1, 1, 1])).toBeNull();
  });
  it('Nullvektor: Span ist ein Punkt', () => {
    expect(analyzeSpan([[0, 0, 0]]).kind).toBe('point');
  });
});
