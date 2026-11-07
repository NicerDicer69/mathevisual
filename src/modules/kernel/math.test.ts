import { describe, it, expect } from 'vitest';
import { kernelImage, EXAMPLES } from './math';
import { parseMat } from '../../math/parse';
import { matVec } from '../../math/linalg';

describe('Modul Kern und Bild', () => {
  it('Rangsatz für alle Beispiele', () => {
    for (const e of EXAMPLES) {
      const r = kernelImage(parseMat(e.m));
      expect(r.kernel.dim + r.image.dim).toBe(3);
    }
  });
  it('Rang 2: Kern ist Gerade, Bild ist Ebene', () => {
    const M = parseMat(EXAMPLES[1].m);
    const r = kernelImage(M);
    expect(r.kernel.kind).toBe('line');
    expect(r.image.kind).toBe('plane');
    matVec(M, r.kernel.basis[0]).forEach((x) => expect(x).toBeCloseTo(0));
    // Bild = Ebene 2x - y = 0 (Zeile 2 = 2·Zeile 1)
    expect(r.image.normal).toEqual([2, -1, 0]);
  });
  it('Nullmatrix: Kern = R³, Bild = {0}', () => {
    const r = kernelImage([[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
    expect(r.kernel.kind).toBe('space');
    expect(r.image.kind).toBe('point');
  });
});
