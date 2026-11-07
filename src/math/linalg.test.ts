import { describe, it, expect } from 'vitest';
import {
  add, cross, dot, norm, angle, project, det3, trace, rank, rref, nullspace, columnSpace, matMul,
  inverse3, identity, rotationMatrix, reflectionMatrix, projectionPlaneMatrix, toFraction, integerize,
  spanInfo, charPoly, cubicRoots, eigen, gaussSteps, solveLgs, gramSchmidt, solve, type Vec3,
} from './linalg';
import { fmtNum, texNum, texLinComb, texPlane, texPoly, toExprString } from './format';
import { parseExpr } from './parse';

const close = (a: number[], b: number[]) => a.forEach((x, i) => expect(x).toBeCloseTo(b[i], 7));

describe('Vektoren', () => {
  it('Summe, Skalarprodukt, Kreuzprodukt, Länge', () => {
    expect(add([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32);
    expect(cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    expect(norm([3, 4, 0])).toBe(5);
  });
  it('Winkel und Projektion', () => {
    expect(angle([1, 0, 0], [0, 1, 0])).toBeCloseTo(Math.PI / 2);
    expect(angle([1, 0, 0], [0, 0, 0])).toBeNull();
    expect(project([2, 3, 0], [1, 0, 0])).toEqual([2, 0, 0]);
  });
});

describe('Matrizen', () => {
  it('Determinante, Spur, Produkt, Inverse', () => {
    const A = [[2, 0, 0], [0, 3, 0], [0, 0, 4]];
    expect(det3(A)).toBe(24);
    expect(trace(A)).toBe(9);
    expect(matMul(A, identity())).toEqual(A);
    const B = [[1, 2, 0], [0, 1, 0], [1, 0, 1]];
    const Bi = inverse3(B)!;
    matMul(B, Bi).forEach((r, i) => close(r, identity()[i]));
    expect(inverse3([[1, 2, 3], [2, 4, 6], [0, 0, 1]])).toBeNull();
  });
  it('Spiegelung hat det = -1, Drehung det = 1, Projektion det = 0', () => {
    expect(det3(reflectionMatrix([0, 0, 1]))).toBeCloseTo(-1);
    expect(det3(rotationMatrix([1, 2, 3], 0.7))).toBeCloseTo(1);
    expect(det3(projectionPlaneMatrix([0, 0, 1]))).toBeCloseTo(0);
  });
  it('Drehung um z um 90° bildet e1 auf e2 ab', () => {
    const R = rotationMatrix([0, 0, 1], Math.PI / 2);
    close([R[0][0], R[1][0], R[2][0]], [0, 1, 0]);
  });
  it('Matrizenprodukt ist nicht kommutativ', () => {
    const M = [[0, -1, 0], [1, 0, 0], [0, 0, 1]];
    const N = [[1, 1, 0], [0, 1, 0], [0, 0, 1]];
    expect(matMul(N, M)).not.toEqual(matMul(M, N));
  });
});

describe('Rang, Kern, Bild', () => {
  it('rref und Rang', () => {
    const A = [[1, 2, 3], [2, 4, 6], [1, 0, 1]];
    expect(rank(A)).toBe(2);
    expect(rref(A).pivots).toEqual([0, 1]);
  });
  it('Kern und Bild erfüllen den Rangsatz', () => {
    const A = [[1, 2, 3], [2, 4, 6], [3, 6, 9]];
    const ker = nullspace(A);
    const img = columnSpace(A);
    expect(ker.length + img.length).toBe(3);
    for (const v of ker) for (const r of A) expect(dot(r, v)).toBeCloseTo(0);
  });
  it('löst reguläres System', () => {
    close(solve([[2, 1, 0], [0, 1, 0], [0, 0, 1]], [3, 1, 5])!, [1, 1, 5]);
  });
});

describe('Brüche', () => {
  it('erkennt Brüche', () => {
    expect(toFraction(0.5)).toEqual({ n: 1, d: 2 });
    expect(toFraction(-1 / 3)).toEqual({ n: -1, d: 3 });
    expect(toFraction(Math.SQRT2)).toBeNull();
    expect(integerize([0.5, -0.5, 1])).toEqual([1, -1, 2]);
  });
  it('formatiert Zahlen', () => {
    expect(fmtNum(0.5)).toBe('1/2');
    expect(fmtNum(0.5, { mode: 'dec', decimals: 3 })).toBe('0.5');
    expect(fmtNum(1 / 3, { mode: 'dec', decimals: 2 })).toBe('0.33');
    expect(texNum(-0.25)).toBe('-\\frac{1}{4}');
    expect(toExprString(0.75)).toBe('3/4');
  });
});

describe('Parser', () => {
  it('versteht Ausdrücke, Parameter und Dezimalkomma', () => {
    expect(parseExpr('1/2')).toBe(0.5);
    expect(parseExpr('0,25')).toBe(0.25);
    expect(parseExpr('2*a', { a: 3 })).toBe(6);
    expect(parseExpr('sqrt(4)')).toBe(2);
    expect(parseExpr('cos(0 deg)')).toBe(1);
  });
  it('liefert NaN statt Absturz bei ungültiger Eingabe', () => {
    expect(parseExpr('1/')).toBeNaN();
    expect(parseExpr('abc')).toBeNaN();
    expect(parseExpr('')).toBeNaN();
    expect(parseExpr('1/0')).toBeNaN();
    expect(parseExpr('sqrt(-1)')).toBeNaN();
  });
  it('lehnt gefährliche Ausdrücke ab', () => {
    expect(parseExpr('f(x) = x^2')).toBeNaN();
    expect(parseExpr('a = 5')).toBeNaN();
    expect(parseExpr('sqrt.constructor')).toBeNaN();
    expect(parseExpr('"abc"')).toBeNaN();
    expect(parseExpr('[1,2][1]')).toBeNaN();
    expect(parseExpr('import({}, {})')).toBeNaN();
    expect(parseExpr('1'.repeat(300))).toBeNaN();
    // normale Eingaben funktionieren weiter
    expect(parseExpr('2.5e3')).toBe(2500);
    expect(parseExpr('-(1/3)*3')).toBeCloseTo(-1);
    expect(parseExpr('2 pi')).toBeCloseTo(2 * Math.PI);
  });
});

describe('Lineare Unabhängigkeit (Akzeptanzkriterium)', () => {
  const v = (a: number): Vec3[] => [[1, 1, 0], [0, 1, 1], [1, 2, a]];
  it('a = 1: abhängig, Dimension 2, Ebene x - y + z = 0, Rundweg -v1 - v2 + v3 = 0', () => {
    const s = spanInfo(v(1));
    expect(s.independent).toBe(false);
    expect(s.rank).toBe(2);
    expect(s.planeNormal).toEqual([1, -1, 1]);
    expect(texPlane(s.planeNormal!)).toBe('x - y + z = 0');
    expect(s.combination).toEqual([-1, -1, 1]);
    expect(texLinComb(s.combination!, ['v_{1}', 'v_{2}', 'v_{3}'])).toBe('-v_{1} - v_{2} + v_{3}');
  });
  it('a ≠ 1: unabhängig, Dimension 3', () => {
    const s = spanInfo(v(0));
    expect(s.independent).toBe(true);
    expect(s.rank).toBe(3);
  });
  it('a = 1 auch bei Slider-Rundungsfehlern', () => {
    expect(spanInfo(v(0.95 + 0.05)).rank).toBe(2);
  });
  it('kollineare Vektoren: Gerade', () => {
    const s = spanInfo([[1, 2, 3], [2, 4, 6]]);
    expect(s.rank).toBe(1);
    expect(s.combination).toEqual([-2, 1]);
  });
});

describe('Eigenwerte', () => {
  it('charakteristisches Polynom', () => {
    expect(charPoly([[2, 0, 0], [0, 3, 0], [0, 0, 4]])).toEqual([1, -9, 26, -24]);
  });
  it('kubische Nullstellen inkl. komplex', () => {
    const r = cubicRoots(-6, 11, -6).map((z) => z.re).sort();
    close(r, [1, 2, 3]);
    const c = cubicRoots(-1, 1, -1); // (λ-1)(λ²+1)
    expect(c.filter((z) => z.im !== 0).length).toBe(2);
  });
  it('diagonalisierbare Matrix', () => {
    const e = eigen([[2, 1, 0], [1, 2, 0], [0, 0, 5]]);
    expect(e.diagonalizable).toBe(true);
    expect(e.real.map((x) => x.lambda)).toEqual([5, 3, 1]);
  });
  it('Scherung ist nicht diagonalisierbar (λ=1 dreifach, geo. Vielfachheit 2)', () => {
    const e = eigen([[1, 1, 0], [0, 1, 0], [0, 0, 1]]);
    expect(e.real.length).toBe(1);
    expect(e.real[0].lambda).toBe(1);
    expect(e.real[0].alg).toBe(3);
    expect(e.real[0].geo).toBe(2);
    expect(e.diagonalizable).toBe(false);
  });
  it('Drehung hat komplexe Eigenwerte', () => {
    const e = eigen([[0, -1, 0], [1, 0, 0], [0, 0, 1]]);
    expect(e.complex.length).toBe(2);
    expect(e.real[0].basis[0]).toEqual([0, 0, 1]);
  });
  it('Einheitsmatrix: Eigenraum ist ganz R³', () => {
    const e = eigen(identity());
    expect(e.real[0].geo).toBe(3);
    expect(e.diagonalizable).toBe(true);
  });
});

describe('Lineare Gleichungssysteme', () => {
  it('eindeutige Lösung (Punkt)', () => {
    const s = solveLgs([[1, 1, 1], [0, 1, 1], [0, 0, 1]], [6, 5, 3]);
    expect(s.type).toBe('point');
    close(s.point!, [1, 2, 3]);
  });
  it('Gerade als Lösung', () => {
    const s = solveLgs([[1, 0, -1], [0, 1, -1], [1, 1, -2]], [0, 0, 0]);
    expect(s.type).toBe('line');
    expect(s.dirs[0]).toEqual([1, 1, 1]);
  });
  it('parallele Ebenen: leer', () => {
    const s = solveLgs([[1, 1, 1], [1, 1, 1], [0, 0, 1]], [1, 2, 0]);
    expect(s.type).toBe('empty');
  });
  it('Gauß-Schritte enden in reduzierter Stufenform', () => {
    const steps = gaussSteps([[2, 1, -1, 8], [-3, -1, 2, -11], [-2, 1, 2, -3]]);
    const last = steps[steps.length - 1].matrix;
    close(last.map((r) => r[3]), [2, 3, -1]);
    expect(steps[0].op).toBeNull();
    expect(steps.length).toBeGreaterThan(3);
  });
});

describe('Gram-Schmidt', () => {
  it('liefert Orthonormalbasis', () => {
    const g = gramSchmidt([[1, 1, 0], [1, 0, 1], [0, 1, 1]]);
    expect(g.failAt).toBe(-1);
    for (let i = 0; i < 3; i++) {
      expect(norm(g.es[i])).toBeCloseTo(1);
      for (let j = i + 1; j < 3; j++) expect(dot(g.es[i], g.es[j])).toBeCloseTo(0);
    }
  });
  it('erkennt Abhängigkeit', () => {
    expect(gramSchmidt([[1, 0, 0], [2, 0, 0], [0, 1, 0]]).failAt).toBe(1);
  });
});

describe('Formatierung', () => {
  it('Polynome', () => {
    expect(texPoly([1, -9, 26, -24])).toBe('\\lambda^{3} - 9\\lambda^{2} + 26\\lambda - 24');
    expect(texPoly([1, 0, 0, 0])).toBe('\\lambda^{3}');
  });
});
