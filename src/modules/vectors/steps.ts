/**
 * Modul 1 – Vektoren: vollständige Rechenwege als LaTeX (mit eingesetzten Zahlen).
 * Jede Funktion liefert einen "aligned"-Block, den KaTeX untereinander setzt.
 */
import { dot, cross, add, scale, type Vec3 } from '../../math/linalg';
import { texNum, texSqrt, type FormatOptions, defaultFormat } from '../../math/format';

/** Zahl, negative Werte in Klammern (für Produkte/Summen). */
const p = (x: number, o: FormatOptions) => {
  const s = texNum(x, o);
  return s.startsWith('-') ? `\\left(${s}\\right)` : s;
};
const col = (entries: string[]) => `\\begin{pmatrix} ${entries.join(' \\\\ ')} \\end{pmatrix}`;
const vec = (v: Vec3, o: FormatOptions) => col(v.map((x) => texNum(x, o)));
const aligned = (lines: string[]) => `\\begin{aligned} ${lines.join(' \\\\[4pt] ')} \\end{aligned}`;
const sub = (name: string, i: number) => `${name}_{${i + 1}}`;

export function lengthSteps(name: string, v: Vec3, o: FormatOptions = defaultFormat): string {
  const sq = dot(v, v);
  return aligned([
    `|${name}| &= \\sqrt{${[0, 1, 2].map((i) => `${sub(name, i)}^2`).join(' + ')}}`,
    `&= \\sqrt{${v.map((x) => `${p(x, o)}^2`).join(' + ')}}`,
    `&= \\sqrt{${v.map((x) => texNum(x * x, o)).join(' + ')}}`,
    `&= \\sqrt{${texNum(sq, o)}} = ${texSqrt(sq, o)}`,
  ]);
}

export function sumSteps(an: string, bn: string, a: Vec3, b: Vec3, o: FormatOptions = defaultFormat): string {
  return aligned([
    `${an} + ${bn} &= ${col([0, 1, 2].map((i) => `${sub(an, i)} + ${sub(bn, i)}`))}`,
    `&= ${col(a.map((x, i) => `${texNum(x, o)} + ${p(b[i], o)}`))}`,
    `&= ${vec(add(a, b), o)}`,
  ]);
}

export function scaledSteps(k: number, an: string, a: Vec3, o: FormatOptions = defaultFormat): string {
  return aligned([
    `${p(k, o)} \\cdot ${an} &= ${col([0, 1, 2].map((i) => `${p(k, o)} \\cdot ${sub(an, i)}`))}`,
    `&= ${col(a.map((x) => `${p(k, o)} \\cdot ${p(x, o)}`))}`,
    `&= ${vec(scale(a, k), o)}`,
  ]);
}

export function dotSteps(an: string, bn: string, a: Vec3, b: Vec3, o: FormatOptions = defaultFormat): string {
  return aligned([
    `${an} \\cdot ${bn} &= ${[0, 1, 2].map((i) => `${sub(an, i)}${sub(bn, i)}`).join(' + ')}`,
    `&= ${a.map((x, i) => `${p(x, o)} \\cdot ${p(b[i], o)}`).join(' + ')}`,
    `&= ${a.map((x, i) => p(x * b[i], o)).join(' + ')}`,
    `&= ${texNum(dot(a, b), o)}`,
  ]);
}

export function angleSteps(an: string, bn: string, a: Vec3, b: Vec3, o: FormatOptions = defaultFormat): string | null {
  const la = Math.sqrt(dot(a, a)), lb = Math.sqrt(dot(b, b));
  if (la < 1e-12 || lb < 1e-12) return null;
  const c = Math.max(-1, Math.min(1, dot(a, b) / (la * lb)));
  const deg = (Math.acos(c) * 180) / Math.PI;
  const dec = { mode: 'dec' as const, decimals: Math.max(3, o.decimals) };
  return aligned([
    `\\cos\\varphi &= \\frac{${an} \\cdot ${bn}}{|${an}| \\cdot |${bn}|}`,
    `&= \\frac{${texNum(dot(a, b), o)}}{\\sqrt{${texNum(dot(a, a), o)}} \\cdot \\sqrt{${texNum(dot(b, b), o)}}}`,
    `&\\approx \\frac{${texNum(dot(a, b), dec)}}{${texNum(la * lb, dec)}} \\approx ${texNum(c, dec)}`,
    `\\varphi &= \\arccos(${texNum(c, dec)}) \\approx ${deg.toFixed(2)}^\\circ`,
  ]);
}

export function projSteps(an: string, bn: string, a: Vec3, b: Vec3, o: FormatOptions = defaultFormat): string | null {
  const bb = dot(b, b);
  if (bb < 1e-12) return null;
  const f = dot(a, b) / bb;
  return aligned([
    `\\operatorname{proj}_{${bn}}(${an}) &= \\frac{${an} \\cdot ${bn}}{${bn} \\cdot ${bn}} \\cdot ${bn}`,
    `&= \\frac{${texNum(dot(a, b), o)}}{${texNum(bb, o)}} \\cdot ${vec(b, o)}`,
    `&= ${col(b.map((x) => `${p(f, o)} \\cdot ${p(x, o)}`))} = ${vec(scale(b, f), o)}`,
  ]);
}

export function crossSteps(an: string, bn: string, a: Vec3, b: Vec3, o: FormatOptions = defaultFormat): string {
  const idx = [[1, 2], [2, 0], [0, 1]];
  const c = cross(a, b);
  return aligned([
    `${an} \\times ${bn} &= ${col(idx.map(([i, j]) => `${sub(an, i)}${sub(bn, j)} - ${sub(an, j)}${sub(bn, i)}`))}`,
    `&= ${col(idx.map(([i, j]) => `${p(a[i], o)} \\cdot ${p(b[j], o)} - ${p(a[j], o)} \\cdot ${p(b[i], o)}`))}`,
    `&= ${col(idx.map(([i, j]) => `${p(a[i] * b[j], o)} - ${p(a[j] * b[i], o)}`))} = ${vec(c, o)}`,
    `|${an} \\times ${bn}| &= \\sqrt{${c.map((x) => `${p(x, o)}^2`).join(' + ')}} = ${texSqrt(dot(c, c), o)}`,
  ]);
}

/** Ebene aus Stützpunkt und zwei Richtungen: Normalenvektor, d und Koordinatenform. */
export function planeSpanSteps(pn: string, un: string, vn: string, P: Vec3, u: Vec3, v: Vec3, o: FormatOptions = defaultFormat): string {
  const n = cross(u, v);
  const d = dot(n, P);
  const idx = [[1, 2], [2, 0], [0, 1]];
  return aligned([
    `E:\\; \\vec{x} &= ${pn} + s \\cdot ${un} + t \\cdot ${vn} = ${vec(P, o)} + s ${vec(u, o)} + t ${vec(v, o)}`,
    `\\vec{n} &= ${un} \\times ${vn} = ${col(idx.map(([i, j]) => `${p(u[i], o)} \\cdot ${p(v[j], o)} - ${p(u[j], o)} \\cdot ${p(v[i], o)}`))} = ${vec(n, o)}`,
    `d &= \\vec{n} \\cdot ${pn} = ${n.map((x, i) => `${p(x, o)} \\cdot ${p(P[i], o)}`).join(' + ')} = ${texNum(d, o)}`,
  ]);
}
