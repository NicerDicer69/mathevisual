/**
 * Modul 3 – Körper: reine Logik (Punktwolken-Parser, Volumina).
 */
import { parseExpr } from '../../math/parse';
import type { Vec3 } from '../../math/linalg';

export type BodyType = 'cube' | 'sphere' | 'tetra' | 'cylinder' | 'points';

export const BODY_NAMES: Record<BodyType, string> = {
  cube: 'Einheitswürfel',
  sphere: 'Kugel (r = 1)',
  tetra: 'Tetraeder (0, e₁, e₂, e₃)',
  cylinder: 'Zylinder (r = 1, h = 2)',
  points: 'Eigene Punktwolke',
};

/** Volumen des Originalkörpers (null für Punktwolken). */
export function bodyVolume(t: BodyType): number | null {
  switch (t) {
    case 'cube': return 1;
    case 'sphere': return (4 / 3) * Math.PI;
    case 'tetra': return 1 / 6;
    case 'cylinder': return 2 * Math.PI;
    default: return null;
  }
}

export interface PointCloudResult {
  points: Vec3[];
  errors: number[]; // 1-basierte Zeilennummern mit Fehlern
}

/**
 * Parst Punkte im Format "x, y, z" oder "x y z" oder "(x; y; z)" – ein Punkt pro Zeile.
 * Leere Zeilen und Kommentare (#) werden ignoriert.
 */
export function parsePointCloud(text: string): PointCloudResult {
  const points: Vec3[] = [];
  const errors: number[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/#.*/, '').replace(/[()[\]]/g, ' ').trim();
    if (!line) return;
    // Trennzeichen: Semikolon, Komma+Leerzeichen, Leerzeichen
    let parts = line.split(/\s*;\s*/);
    if (parts.length !== 3) parts = line.split(/\s*,\s*/);
    if (parts.length !== 3) parts = line.split(/\s+/);
    const v = parts.map((p) => parseExpr(p));
    if (v.length === 3 && v.every(isFinite)) points.push(v as Vec3);
    else errors.push(i + 1);
  });
  return { points, errors };
}

/** Zufällige Punktwolke (z. B. eine Spirale), als Text. */
export function samplePointCloud(n = 60): string {
  const lines: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 4 * Math.PI;
    const r = 1.2;
    lines.push(`${(r * Math.cos(t)).toFixed(2)}, ${(r * Math.sin(t)).toFixed(2)}, ${((i / n) * 2).toFixed(2)}`);
  }
  return lines.join('\n');
}
