import { describe, it, expect } from 'vitest';
import { texRowOp, texEquation, texSolution, isContradiction, PRESETS } from './math';
import { solveLgs, gaussSteps, type Vec3 } from '../../math/linalg';
import { parseMat } from '../../math/parse';

const split = (m: number[][]) => ({ A: m.map((r) => r.slice(0, 3)), b: m.map((r) => r[3]) as Vec3 });

describe('Modul LGS', () => {
  it('Zeilenoperationen als LaTeX', () => {
    expect(texRowOp({ type: 'swap', i: 0, j: 2 })).toBe('\\text{I} \\leftrightarrow \\text{III}');
    expect(texRowOp({ type: 'add', target: 1, source: 0, factor: -2 })).toBe('\\text{II} \\leftarrow \\text{II} - 2 \\cdot \\text{I}');
    expect(texRowOp({ type: 'scale', i: 0, factor: 0.5 })).toBe('\\text{I} \\leftarrow \\frac{1}{2} \\cdot \\text{I}');
  });
  it('Gleichung', () => {
    expect(texEquation([1, -1, 2, 3])).toBe('x - y + 2z = 3');
  });
  it('alle Voreinstellungen werden richtig klassifiziert', () => {
    const expected = ['point', 'line', 'plane', 'empty', 'empty'];
    PRESETS.forEach((p, i) => {
      const { A, b } = split(parseMat(p.m));
      expect(solveLgs(A, b).type).toBe(expected[i]);
    });
  });
  it('Lösungsmenge', () => {
    const { A, b } = split(parseMat(PRESETS[0].m));
    expect(texSolution(solveLgs(A, b))).toContain('\\begin{pmatrix} 1 \\\\ 2 \\\\ 3 \\end{pmatrix}');
  });
  it('Gauß erkennt Widerspruch im letzten Schritt', () => {
    const steps = gaussSteps(parseMat(PRESETS[3].m));
    const last = steps[steps.length - 1].matrix;
    expect(last.some(isContradiction)).toBe(true);
  });
});
