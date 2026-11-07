/**
 * Zahlen- und Formel-Formatierung (Text und LaTeX für KaTeX).
 * Rein funktional – keine DOM-Abhängigkeit.
 */
import { toFraction, type Vec, type Matrix } from './linalg';

export type NumberMode = 'frac' | 'dec';

export interface FormatOptions {
  mode: NumberMode;
  decimals: number;
}

export const defaultFormat: FormatOptions = { mode: 'frac', decimals: 3 };

function decimalString(x: number, decimals: number): string {
  const s = x.toFixed(decimals);
  const t = s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
  return t === '-0' ? '0' : t;
}

/** Zahl als Text, z. B. "1/2", "-3" oder "0.333". */
export function fmtNum(x: number, o: FormatOptions = defaultFormat): string {
  if (!isFinite(x)) return '—';
  if (Math.abs(x) < 1e-12) return '0';
  if (o.mode === 'frac') {
    const f = toFraction(x, 1000, 1e-9);
    if (f) return f.d === 1 ? String(f.n) : `${f.n}/${f.d}`;
  }
  return decimalString(x, o.decimals);
}

/** Zahl als LaTeX, z. B. "-\frac{1}{2}". */
export function texNum(x: number, o: FormatOptions = defaultFormat): string {
  if (!isFinite(x)) return '\\text{—}';
  if (Math.abs(x) < 1e-12) return '0';
  if (o.mode === 'frac') {
    const f = toFraction(x, 1000, 1e-9);
    if (f) {
      if (f.d === 1) return String(f.n);
      return `${f.n < 0 ? '-' : ''}\\frac{${Math.abs(f.n)}}{${f.d}}`;
    }
  }
  return decimalString(x, o.decimals);
}

export const texVec = (v: Vec, o: FormatOptions = defaultFormat): string =>
  `\\begin{pmatrix} ${v.map((x) => texNum(x, o)).join(' \\\\ ')} \\end{pmatrix}`;

/** Matrix als LaTeX; augmented = true zeichnet einen Strich vor der letzten Spalte. */
export function texMat(M: Matrix, o: FormatOptions = defaultFormat, augmented = false): string {
  const body = M.map((r) => r.map((x) => texNum(x, o)).join(' & ')).join(' \\\\ ');
  if (!augmented) return `\\begin{pmatrix} ${body} \\end{pmatrix}`;
  const n = M[0].length;
  return `\\left(\\begin{array}{${'c'.repeat(n - 1)}|c} ${body} \\end{array}\\right)`;
}

/** Koeffizient vor einem Symbol: 1 → "", -1 → "-", sonst Zahl. */
function coefTerm(c: number, sym: string, first: boolean, o: FormatOptions): string {
  const abs = Math.abs(c);
  const sign = c < 0 ? '-' : first ? '' : '+';
  const num = Math.abs(abs - 1) < 1e-12 && sym ? '' : texNum(abs, o);
  return `${first ? sign : ` ${sign} `}${num}${sym}`;
}

/** Polynom aus Koeffizienten [a_n, …, a_0] in LaTeX. */
export function texPoly(coeffs: number[], variable = '\\lambda', o: FormatOptions = defaultFormat): string {
  const deg = coeffs.length - 1;
  const parts: string[] = [];
  coeffs.forEach((c, i) => {
    if (Math.abs(c) < 1e-12) return;
    const p = deg - i;
    const sym = p === 0 ? '' : p === 1 ? variable : `${variable}^{${p}}`;
    parts.push(coefTerm(c, sym, parts.length === 0, o));
  });
  return parts.length ? parts.join('') : '0';
}

/** Linearkombination, z. B. "-v_{1} - v_{2} + v_{3}". */
export function texLinComb(coeffs: number[], names: string[], o: FormatOptions = defaultFormat): string {
  const parts: string[] = [];
  coeffs.forEach((c, i) => {
    if (Math.abs(c) < 1e-12) return;
    parts.push(coefTerm(c, names[i], parts.length === 0, o));
  });
  return parts.length ? parts.join('') : '0';
}

/** Ebenengleichung n·x = d, z. B. "x - y + z = 0". */
export const texPlane = (n: Vec, d = 0, o: FormatOptions = defaultFormat): string =>
  `${texLinComb(n, ['x', 'y', 'z'], o)} = ${texNum(d, o)}`;

/**
 * Wandelt eine Zahl in einen Eingabe-String um (für Zahlenfelder):
 * rationale Zahlen als Bruch, sonst bis zu 6 Nachkommastellen.
 */
export function toExprString(x: number): string {
  if (Math.abs(x) < 1e-12) return '0';
  const f = toFraction(x, 100, 1e-10);
  if (f) return f.d === 1 ? String(f.n) : `${f.n}/${f.d}`;
  return decimalString(x, 6);
}

/**
 * Wurzel aus einer Zahl als LaTeX: exakt, wenn möglich
 * (√4 → 2, √5 → \sqrt{5} ≈ 2.236), sonst Dezimalzahl.
 */
export function texSqrt(sq: number, o: FormatOptions = defaultFormat): string {
  if (sq < 0 || !isFinite(sq)) return '\\text{—}';
  const r = Math.sqrt(sq);
  const fr = toFraction(r, 1000, 1e-10);
  if (fr) return texNum(r, o);
  const fs = toFraction(sq, 1000, 1e-10);
  if (fs && o.mode === 'frac') {
    const inner = fs.d === 1 ? String(fs.n) : `\\frac{${fs.n}}{${fs.d}}`;
    return `\\sqrt{${inner}} \\approx ${decimalString(r, o.decimals)}`;
  }
  return decimalString(r, o.decimals);
}
