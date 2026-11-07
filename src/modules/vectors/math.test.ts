import { describe, it, expect } from 'vitest';
import { vectorOps, snapVec } from './math';

describe('Modul Vektoren', () => {
  it('berechnet alle Operationen', () => {
    const r = vectorOps([3, 0, 0], [0, 4, 0], 2);
    expect(r.sum).toEqual([3, 4, 0]);
    expect(r.scaled).toEqual([6, 0, 0]);
    expect(r.dot).toBe(0);
    expect(r.angleDeg).toBeCloseTo(90);
    expect(r.cross).toEqual([0, 0, 12]);
    expect(r.area).toBe(12);
    expect(r.orthogonal).toBe(true);
  });
  it('Projektion und Parallelität', () => {
    const r = vectorOps([2, 2, 0], [1, 0, 0], 1);
    expect(r.proj).toEqual([2, 0, 0]);
    expect(r.projLen).toBe(2);
    expect(r.angleDeg).toBeCloseTo(45);
    expect(vectorOps([1, 2, 3], [2, 4, 6], 1).parallel).toBe(true);
  });
  it('Nullvektor ohne Absturz', () => {
    const r = vectorOps([0, 0, 0], [1, 0, 0], 1);
    expect(r.angleDeg).toBeNull();
  });
  it('Raster', () => {
    expect(snapVec([1.04, -0.26, 2.351])).toEqual([1, -0.3, 2.4]);
  });
});

import { planeFromSpan, planeFromCoords, planeCenter } from './math';
import { sumSteps, dotSteps, crossSteps, lengthSteps, angleSteps, projSteps, planeSpanSteps } from './steps';

describe('Ebenen', () => {
  it('Ebene aus zwei Richtungen', () => {
    expect(planeFromSpan([0, 0, 1], [1, 0, 0], [0, 1, 0])).toEqual({ n: [0, 0, 1], d: 1 });
    expect(planeFromSpan([0, 0, 0], [1, 2, 3], [2, 4, 6])).toBeNull();
  });
  it('Koordinatenform und Mittelpunkt', () => {
    const e = planeFromCoords(0, 0, 2, 4)!;
    expect(planeCenter(e)).toEqual([0, 0, 2]);
    expect(planeFromCoords(0, 0, 0, 1)).toBeNull();
  });
});

describe('Rechenwege', () => {
  it('enthalten eingesetzte Zahlen und Ergebnis', () => {
    expect(sumSteps('a', 'b', [2, 1, 0], [1, -2, 2])).toContain('1 + \\left(-2\\right)');
    expect(dotSteps('a', 'b', [2, 1, 0], [1, 2, 2])).toContain('2 \\cdot 1 + 1 \\cdot 2 + 0 \\cdot 2');
    expect(dotSteps('a', 'b', [2, 1, 0], [1, 2, 2])).toContain('&= 4');
    expect(crossSteps('a', 'b', [1, 0, 0], [0, 1, 0])).toContain('\\begin{pmatrix} 0 \\\\ 0 \\\\ 1 \\end{pmatrix}');
    expect(lengthSteps('a', [3, 4, 0])).toContain('\\sqrt{25} = 5');
    expect(angleSteps('a', 'b', [1, 0, 0], [0, 1, 0])).toContain('90.00^\\circ');
    expect(angleSteps('a', 'b', [0, 0, 0], [0, 1, 0])).toBeNull();
    expect(projSteps('a', 'b', [2, 2, 0], [1, 0, 0])).toContain('\\begin{pmatrix} 2 \\\\ 0 \\\\ 0 \\end{pmatrix}');
    expect(planeSpanSteps('a', 'b', 'c', [0, 0, 1], [1, 0, 0], [0, 1, 0])).toContain('= 1');
  });
});
