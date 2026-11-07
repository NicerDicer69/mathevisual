/**
 * Modul 7 – Kern und Bild: reine Logik.
 */
import { nullspace, columnSpace, integerize, cross, type Matrix, type Vec3 } from '../../math/linalg';

export type SubspaceKind = 'point' | 'line' | 'plane' | 'space';

export interface Subspace {
  dim: number;
  kind: SubspaceKind;
  basis: Vec3[];
  /** Normalenvektor bei Dimension 2 */
  normal: Vec3 | null;
}

function subspace(basis: Vec3[]): Subspace {
  const dim = basis.length;
  const kind = (['point', 'line', 'plane', 'space'] as const)[dim];
  let normal: Vec3 | null = null;
  if (dim === 2) {
    normal = integerize(cross(basis[0], basis[1])) as Vec3;
    if ((normal.find((x) => x !== 0) ?? 1) < 0) normal = normal.map((x) => (x === 0 ? 0 : -x)) as Vec3;
  }
  return { dim, kind, basis, normal };
}

export interface KernelImage {
  kernel: Subspace;
  image: Subspace;
  rank: number;
}

export function kernelImage(M: Matrix): KernelImage {
  const ker = nullspace(M).map((v) => integerize(v) as Vec3);
  const img = columnSpace(M).map((v) => v as Vec3);
  return { kernel: subspace(ker), image: subspace(img), rank: img.length };
}

export const EXAMPLES: { name: string; m: string[][] }[] = [
  { name: 'Rang 3', m: [['2', '1', '0'], ['0', '1', '0'], ['1', '0', '1']] },
  { name: 'Rang 2', m: [['1', '2', '3'], ['2', '4', '6'], ['1', '1', '1']] },
  { name: 'Rang 1', m: [['1', '2', '3'], ['2', '4', '6'], ['3', '6', '9']] },
  { name: 'Projektion', m: [['1', '0', '0'], ['0', '1', '0'], ['0', '0', '0']] },
];
