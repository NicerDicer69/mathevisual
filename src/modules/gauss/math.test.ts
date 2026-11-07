import { describe, it, expect } from 'vitest';
import {
  EXAMPLES, applyOp, forwardSteps, isEchelon, backSubstitute, texSolutionSet, validateOp,
  suggestNext, texOp, explainOp, texRowCalc, applyPerm, texEquationRow,
} from './math';
import { parseMat } from '../../math/parse';
import { solveLgs, type Matrix, type Vec3 } from '../../math/linalg';

const ex = (id: string) => parseMat(EXAMPLES.find((e) => e.id === id)!.m);
const run = (M: Matrix) => forwardSteps(M).reduce((A, s) => applyOp(A, s.op), M);

describe('Gauß-Trainer: Vorwärtselimination', () => {
  it('alle Beispiele enden in Zeilenstufenform', () => {
    for (const e of EXAMPLES) expect(isEchelon(run(parseMat(e.m)))).toBe(true);
  });
  it('Standard-Beispiel bleibt in jedem Schritt ganzzahlig', () => {
    let M = ex('standard');
    for (const s of forwardSteps(M)) {
      M = applyOp(M, s.op);
      M.flat().forEach((x) => expect(Number.isInteger(x)).toBe(true));
    }
    expect(M).toEqual([[1, 1, 1, 6], [0, 1, -1, -1], [0, 0, 3, 9]]);
  });
  it('Beispiel "Mit Zeilentausch" beginnt mit einem Tausch', () => {
    const steps = forwardSteps(ex('swap'));
    expect(steps[0].op).toEqual({ type: 'swap', i: 0, j: 1 });
  });
  it('Lösung stimmt mit allgemeinem Löser überein', () => {
    for (const e of EXAMPLES) {
      const M = parseMat(e.m);
      const bs = backSubstitute(run(M));
      const ref = solveLgs(M.map((r) => r.slice(0, 3)), M.map((r) => r[3]) as Vec3);
      const map = { unique: 'point', infinite: ref.type, none: 'empty', all: 'space' } as const;
      expect(map[bs.kind]).toBe(ref.type);
      if (bs.kind === 'unique') bs.solution!.forEach((a, i) => expect(a.c).toBeCloseTo(ref.point![i]));
    }
  });
});

describe('Gauß-Trainer: Rückwärtseinsetzen', () => {
  it('eindeutige Lösung (1, 2, 3) mit nachvollziehbaren Zeilen', () => {
    const r = backSubstitute([[1, 1, 1, 6], [0, 1, -1, -1], [0, 0, 3, 9]]);
    expect(r.kind).toBe('unique');
    expect(r.solution!.map((a) => a.c)).toEqual([1, 2, 3]);
    expect(r.lines[0]).toContain('3z = 9');
    expect(r.lines[0]).toContain('z = 3');
    expect(r.lines[2]).toContain('x + 2 + 3 = 6');
    expect(texSolutionSet(r)).toContain('\\begin{pmatrix} 1 \\\\ 2 \\\\ 3 \\end{pmatrix}');
  });
  it('Gerade mit Parameter t', () => {
    const r = backSubstitute(run(ex('line')));
    expect(r.kind).toBe('infinite');
    expect(r.solution).toEqual([{ c: -5, t: 7, s: 0 }, { c: 3, t: -3, s: 0 }, { c: 0, t: 1, s: 0 }]);
    expect(texSolutionSet(r)).toContain('t\\,');
  });
  it('Widerspruch 0 = 2', () => {
    const r = backSubstitute(run(ex('none')));
    expect(r.kind).toBe('none');
    expect(r.lines[0]).toContain('0 = 2');
  });
});

describe('Gauß-Trainer: Operationen und Texte', () => {
  it('Validierung', () => {
    expect(validateOp({ type: 'swap', i: 1, j: 1 })).not.toBeNull();
    expect(validateOp({ type: 'scale', i: 0, factor: 0 })).not.toBeNull();
    expect(validateOp({ type: 'add', target: 1, source: 1, factor: 2 })).not.toBeNull();
    expect(validateOp({ type: 'add', target: 1, source: 0, factor: -2 })).toBeNull();
  });
  it('Tipp und Permutation', () => {
    expect(suggestNext(ex('standard'))).toEqual({ type: 'add', target: 1, source: 0, factor: -2 });
    expect(suggestNext([[1, 1, 1, 6], [0, 1, -1, -1], [0, 0, 3, 9]])).toBeNull();
    expect(applyPerm([0, 1, 2], { type: 'swap', i: 0, j: 2 })).toEqual([2, 1, 0]);
  });
  it('Texte enthalten Faktor und Rechnung', () => {
    const M = ex('standard');
    const op = { type: 'add' as const, target: 1, source: 0, factor: -2 };
    expect(texOp(op)).toBe('\\text{II} \\leftarrow \\text{II} - 2 \\cdot \\text{I}');
    expect(explainOp(op, M)).toContain('Faktor = −(2) / (1) = -2');
    expect(texRowCalc(op, M, applyOp(M, op))).toContain('11 - 2\\cdot 6');
    expect(texEquationRow([0, 0, 0, 2])).toBe('0 = 2');
    expect(texEquationRow([1, -1, 2, 3])).toBe('x - y + 2z = 3');
  });
});
