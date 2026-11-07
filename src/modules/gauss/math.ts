/**
 * Modul "Gauß-Trainer": Gauß-Verfahren wie in der Schule/Vorlesung –
 *  1. Vorwärtselimination bis zur Zeilenstufenform (ohne Normieren, damit die
 *     Zahlen möglichst lange ganzzahlig bleiben)
 *  2. Rückwärtseinsetzen (auch mit freien Parametern)
 * Reine Logik, ohne DOM/Three.js – vollständig getestet.
 */
import { cloneM, type Matrix, type RowOp } from '../../math/linalg';
import { texNum, type FormatOptions, defaultFormat } from '../../math/format';

export const EPS = 1e-10;
export const ROMAN = ['I', 'II', 'III'];
export const VARS = ['x', 'y', 'z'];
const TROMAN = ROMAN.map((r) => `\\text{${r}}`);

// ---------------------------------------------------------------------------
// Beispiele mit "guten" Zahlen
// ---------------------------------------------------------------------------

export interface GaussExample {
  id: string;
  name: string;
  description: string;
  m: string[][];
}

export const EXAMPLES: GaussExample[] = [
  {
    id: 'standard',
    name: 'Standard',
    description: 'Eindeutige Lösung, alle Zwischenschritte ganzzahlig. Ideal zum Einstieg.',
    m: [['1', '1', '1', '6'], ['2', '3', '1', '11'], ['1', '2', '3', '14']],
  },
  {
    id: 'swap',
    name: 'Mit Zeilentausch',
    description: 'In der ersten Zeile fehlt x – hier muss zuerst getauscht werden.',
    m: [['0', '2', '1', '7'], ['1', '1', '1', '6'], ['2', '1', '2', '10']],
  },
  {
    id: 'fractions',
    name: 'Mit Brüchen',
    description: 'Der Klassiker: Pivot 2, Faktoren wie 3/2 – zeigt, wie Brüche entstehen.',
    m: [['2', '1', '-1', '8'], ['-3', '-1', '2', '-11'], ['-2', '1', '2', '-3']],
  },
  {
    id: 'line',
    name: 'Unendlich viele',
    description: 'Eine Gleichung ist überflüssig (III = I + II) → Lösung ist eine Gerade.',
    m: [['1', '2', '-1', '1'], ['2', '5', '1', '5'], ['3', '7', '0', '6']],
  },
  {
    id: 'none',
    name: 'Keine Lösung',
    description: 'Am Ende steht 0 = 2 – ein Widerspruch. Die Ebenen haben keinen gemeinsamen Punkt.',
    m: [['1', '1', '1', '2'], ['1', '2', '2', '3'], ['2', '3', '3', '7']],
  },
];

// ---------------------------------------------------------------------------
// Zeilenoperationen
// ---------------------------------------------------------------------------

const tidy = (M: Matrix) => M.map((r) => r.map((x) => (Math.abs(x) < EPS ? 0 : +x.toPrecision(14))));

export function applyOp(M: Matrix, op: RowOp): Matrix {
  const A = cloneM(M);
  if (op.type === 'swap') [A[op.i], A[op.j]] = [A[op.j], A[op.i]];
  else if (op.type === 'scale') A[op.i] = A[op.i].map((x) => x * op.factor);
  else A[op.target] = A[op.target].map((x, j) => x + op.factor * A[op.source][j]);
  return tidy(A);
}

/** Prüft eine (z. B. vom Nutzer eingegebene) Operation; liefert Fehlermeldung oder null. */
export function validateOp(op: RowOp): string | null {
  if (op.type === 'swap' && op.i === op.j) return 'Eine Zeile kann nicht mit sich selbst getauscht werden.';
  if (op.type === 'scale' && Math.abs(op.factor) < EPS) return 'Multiplikation mit 0 ist verboten – dabei ginge die Gleichung verloren.';
  if (op.type === 'add' && op.target === op.source) return 'Ziel- und Quellzeile müssen verschieden sein.';
  if (op.type !== 'swap' && !isFinite(op.factor)) return 'Ungültiger Faktor.';
  return null;
}

/** Permutation mitführen: perm[i] = ursprüngliche Gleichung, die jetzt in Zeile i steht. */
export function applyPerm(perm: number[], op: RowOp): number[] {
  const p = perm.slice();
  if (op.type === 'swap') [p[op.i], p[op.j]] = [p[op.j], p[op.i]];
  return p;
}

const leading = (row: number[]) => row.slice(0, 3).findIndex((x) => Math.abs(x) > EPS);

/** Zeilenstufenform: führende Einträge wandern nach rechts, Nullzeilen unten. */
export function isEchelon(M: Matrix): boolean {
  let last = -1;
  let zeroSeen = false;
  for (const r of M) {
    const l = leading(r);
    if (l < 0) { zeroSeen = true; continue; }
    if (zeroSeen || l <= last) return false;
    last = l;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Vorwärtselimination mit Begründungen
// ---------------------------------------------------------------------------

export interface GaussStepInfo {
  op: RowOp;
  /** Pivotposition [Zeile, Spalte], zu der der Schritt gehört */
  pivot: [number, number];
}

/**
 * Schul-Gauß: Spalte für Spalte ein Pivot wählen (bevorzugt ±1, sonst erstes ≠ 0),
 * ggf. tauschen, dann darunter Nullen erzeugen. Keine Normierung.
 */
export function forwardSteps(M0: Matrix): GaussStepInfo[] {
  let M = tidy(M0);
  const steps: GaussStepInfo[] = [];
  let r = 0;
  for (let c = 0; c < 3 && r < 3; c++) {
    const cands = [0, 1, 2].filter((i) => i >= r && Math.abs(M[i][c]) > EPS);
    if (!cands.length) continue;
    const one = cands.find((i) => Math.abs(Math.abs(M[i][c]) - 1) < EPS);
    const p = one ?? cands[0];
    if (p !== r) {
      const op: RowOp = { type: 'swap', i: r, j: p };
      steps.push({ op, pivot: [r, c] });
      M = applyOp(M, op);
    }
    for (let i = r + 1; i < 3; i++) {
      if (Math.abs(M[i][c]) < EPS) continue;
      const op: RowOp = { type: 'add', target: i, source: r, factor: -M[i][c] / M[r][c] };
      steps.push({ op, pivot: [r, c] });
      M = applyOp(M, op);
    }
    r++;
  }
  return steps;
}

/** Nächster sinnvoller Schritt für den "Tipp"-Button (null, wenn fertig). */
export function suggestNext(M: Matrix): RowOp | null {
  return isEchelon(M) ? null : forwardSteps(M)[0]?.op ?? null;
}

// ---------------------------------------------------------------------------
// Texte & LaTeX
// ---------------------------------------------------------------------------

const wrap = (s: string) => (s.startsWith('-') ? `\\left(${s}\\right)` : s);

export function texOp(op: RowOp, o: FormatOptions = defaultFormat): string {
  if (op.type === 'swap') return `${TROMAN[op.i]} \\leftrightarrow ${TROMAN[op.j]}`;
  if (op.type === 'scale') return `${TROMAN[op.i]} \\leftarrow ${wrap(texNum(op.factor, o))} \\cdot ${TROMAN[op.i]}`;
  const abs = Math.abs(op.factor);
  const f = Math.abs(abs - 1) < EPS ? '' : `${texNum(abs, o)} \\cdot `;
  return `${TROMAN[op.target]} \\leftarrow ${TROMAN[op.target]} ${op.factor < 0 ? '-' : '+'} ${f}${TROMAN[op.source]}`;
}

/** Verständliche Begründung, warum dieser Schritt gemacht wird. */
export function explainOp(op: RowOp, before: Matrix, o: FormatOptions = defaultFormat): string {
  if (op.type === 'swap') {
    const c = Math.max(0, [0, 1, 2].find((k) => Math.abs(before[op.i][k]) > EPS || Math.abs(before[op.j][k]) > EPS) ?? 0);
    const v = VARS[c];
    return Math.abs(before[op.i][c]) < EPS
      ? `In Zeile ${ROMAN[op.i]} steht vor ${v} eine 0 – die taugt nicht als Pivot (man kann durch 0 nicht teilen). Darum tauschen wir mit Zeile ${ROMAN[op.j]}, die dort einen Eintrag ≠ 0 hat. Die Reihenfolge der Gleichungen ändert die Lösung nicht.`
      : `Zeile ${ROMAN[op.j]} hat vor ${v} den Eintrag ${texPlain(before[op.j][c], o)} – mit einer 1 als Pivot rechnet es sich viel einfacher. Darum tauschen wir die Zeilen ${ROMAN[op.i]} und ${ROMAN[op.j]}.`;
  }
  if (op.type === 'scale') {
    return `Wir multiplizieren Zeile ${ROMAN[op.i]} mit ${texPlain(op.factor, o)}. Beide Seiten der Gleichung werden gleich verändert – die Lösungsmenge bleibt dieselbe (z. B. um Brüche loszuwerden oder das Pivot zu 1 zu machen).`;
  }
  const c = leading(before[op.source]);
  const t = before[op.target][c];
  const p = before[op.source][c];
  const created = c >= 0 && Math.abs(t + op.factor * p) < EPS && Math.abs(t) > EPS;
  if (!created) {
    return `Zu Zeile ${ROMAN[op.target]} wird das ${texPlain(op.factor, o)}-fache von Zeile ${ROMAN[op.source]} addiert. Das ist erlaubt (die Lösung bleibt gleich), erzeugt hier aber keine neue Null – überlege, welcher Faktor eine 0 erzeugen würde.`;
  }
  return `Ziel: Unter dem Pivot ${texPlain(p, o)} (Zeile ${ROMAN[op.source]}, Spalte ${VARS[c]}) soll eine 0 entstehen. ` +
    `In Zeile ${ROMAN[op.target]} steht dort ${texPlain(t, o)}. Faktor = −(${texPlain(t, o)}) / (${texPlain(p, o)}) = ${texPlain(op.factor, o)}. ` +
    `Also addieren wir das ${texPlain(op.factor, o)}-fache von Zeile ${ROMAN[op.source]} zu Zeile ${ROMAN[op.target]} – danach ist ${VARS[c]} aus Zeile ${ROMAN[op.target]} verschwunden.`;
}

/** Zahl als normaler Text (für Erklärsätze). */
function texPlain(x: number, o: FormatOptions): string {
  return texNum(x, o).replace(/\\frac\{(\d+)\}\{(\d+)\}/, '$1/$2');
}

/** Eintragweise Rechnung der Zielzeile, z. B. II: (2 − 2·1, 3 − 2·1, … | 11 − 2·6) = (0, 1, … | −1). */
export function texRowCalc(op: RowOp, before: Matrix, after: Matrix, o: FormatOptions = defaultFormat): string | null {
  if (op.type === 'swap') return null;
  const i = op.type === 'scale' ? op.i : op.target;
  const fmtRow = (cells: string[]) => `\\left(\\,${cells.slice(0, 3).join(',\\;')}\\;\\middle|\\;${cells[3]}\\,\\right)`;
  const cells = before[i].map((x, j) => {
    if (op.type === 'scale') return `${wrap(texNum(op.factor, o))}\\cdot ${wrap(texNum(x, o))}`;
    const s = before[op.source][j];
    const abs = Math.abs(op.factor);
    const f = Math.abs(abs - 1) < EPS ? '' : `${texNum(abs, o)}\\cdot `;
    return `${texNum(x, o)} ${op.factor < 0 ? '-' : '+'} ${f}${wrap(texNum(s, o))}`;
  });
  return `${TROMAN[i]}_{\\text{neu}}: ${fmtRow(cells)} = ${fmtRow(after[i].map((x) => texNum(x, o)))}`;
}

export interface Highlight {
  /** Pivot-Zelle */
  pivot?: [number, number];
  /** veränderte Zeile */
  row?: number;
  /** Quellzeile */
  source?: number;
  /** neu entstandene Null */
  zero?: [number, number];
}

/** Erweiterte Koeffizientenmatrix mit farbigen Markierungen. */
export function texMatrixHL(M: Matrix, hl: Highlight = {}, o: FormatOptions = defaultFormat): string {
  const body = M.map((r, i) =>
    r.map((x, j) => {
      let s = texNum(x, o);
      if (hl.zero && hl.zero[0] === i && hl.zero[1] === j) return `\\colorbox{#14532d}{$\\color{#86efac}{${s}}$}`;
      if (hl.pivot && hl.pivot[0] === i && hl.pivot[1] === j) return `\\boxed{\\color{#fbbf24}{${s}}}`;
      if (hl.row === i) s = `\\color{#67e8f9}{${s}}`;
      else if (hl.source === i) s = `\\color{#c4b5fd}{${s}}`;
      return s;
    }).join(' & '),
  ).join(' \\\\ ');
  const left = M.map((_, i) => TROMAN[i]).join(' \\\\ ');
  const right = M.map((_, i) =>
    hl.row === i ? '\\color{#67e8f9}{\\leftarrow \\text{neu}}' : hl.source === i ? '\\color{#c4b5fd}{\\text{Hilfe}}' : '\\phantom{x}',
  ).join(' \\\\ ');
  return `\\begin{array}{r} ${left} \\end{array}\\left(\\begin{array}{ccc|c} ${body} \\end{array}\\right)\\begin{array}{l} ${right} \\end{array}`;
}

/** Zeile als Gleichung, z. B. "2x - y + 3z = 7" (Nullzeilen als "0 = c"). */
export function texEquationRow(r: number[], o: FormatOptions = defaultFormat): string {
  const terms: string[] = [];
  r.slice(0, 3).forEach((c, j) => {
    if (Math.abs(c) < EPS) return;
    const abs = Math.abs(c);
    const num = Math.abs(abs - 1) < EPS ? '' : texNum(abs, o);
    terms.push(`${terms.length ? (c < 0 ? ' - ' : ' + ') : c < 0 ? '-' : ''}${num}${VARS[j]}`);
  });
  return `${terms.length ? terms.join('') : '0'} = ${texNum(r[3], o)}`;
}

// ---------------------------------------------------------------------------
// Rückwärtseinsetzen
// ---------------------------------------------------------------------------

/** Affiner Ausdruck c + t·T + s·S (für freie Parameter t, s). */
export interface Affine {
  c: number;
  t: number;
  s: number;
}
const A0: Affine = { c: 0, t: 0, s: 0 };
const addA = (a: Affine, b: Affine, k = 1): Affine => ({ c: a.c + k * b.c, t: a.t + k * b.t, s: a.s + k * b.s });
const scaleA = (a: Affine, k: number): Affine => ({ c: a.c * k, t: a.t * k, s: a.s * k });
const clean = (x: number) => (Math.abs(x) < EPS ? 0 : +x.toPrecision(14));
const cleanA = (a: Affine): Affine => ({ c: clean(a.c), t: clean(a.t), s: clean(a.s) });

export function texAffine(a: Affine, o: FormatOptions = defaultFormat): string {
  const parts: string[] = [];
  const push = (k: number, sym: string) => {
    if (Math.abs(k) < EPS) return;
    const abs = Math.abs(k);
    const num = sym && Math.abs(abs - 1) < EPS ? '' : texNum(abs, o);
    parts.push(`${parts.length ? (k < 0 ? ' - ' : ' + ') : k < 0 ? '-' : ''}${num}${sym}`);
  };
  push(a.c, '');
  push(a.t, 't');
  push(a.s, 's');
  return parts.length ? parts.join('') : '0';
}
const isConst = (a: Affine) => Math.abs(a.t) < EPS && Math.abs(a.s) < EPS;

export interface BackSubResult {
  kind: 'unique' | 'infinite' | 'none' | 'all';
  /** LaTeX-Zeilen (eine pro Rechenschritt) */
  lines: string[];
  /** Lösung als affine Ausdrücke (falls lösbar) */
  solution: Affine[] | null;
  /** Index der Widerspruchszeile */
  contradiction: number;
}

/** Rückwärtseinsetzen aus einer Zeilenstufenform. */
export function backSubstitute(E: Matrix, o: FormatOptions = defaultFormat): BackSubResult {
  const lines: string[] = [];
  const contra = E.findIndex((r) => leading(r) < 0 && Math.abs(r[3]) > EPS);
  if (contra >= 0) {
    lines.push(`${TROMAN[contra]}:\\; 0x + 0y + 0z = ${texNum(E[contra][3], o)} \\;\\Rightarrow\\; 0 = ${texNum(E[contra][3], o)} \\;\\text{ – Widerspruch!}`);
    return { kind: 'none', lines, solution: null, contradiction: contra };
  }
  const pivotCols = E.map(leading);
  const free = [0, 1, 2].filter((c) => !pivotCols.includes(c));
  const val: (Affine | null)[] = [null, null, null];
  const params = ['t', 's'];
  free.forEach((c, k) => {
    val[c] = { ...A0, [params[k]]: 1 } as Affine;
    lines.push(`${VARS[c]} \\text{ ist frei wählbar: } ${VARS[c]} = ${params[k]}, \\; ${params[k]} \\in \\mathbb{R}`);
  });
  E.forEach((_, i) => {
    if (pivotCols[i] < 0) lines.push(`${TROMAN[i]}:\\; 0 = 0 \\;\\text{ (keine Information)}`);
  });
  for (let i = 2; i >= 0; i--) {
    const p = pivotCols[i];
    if (p < 0) continue;
    const r = E[i];
    // bekannte Terme einsetzen
    const others = [0, 1, 2].filter((j) => j !== p && Math.abs(r[j]) > EPS);
    let rest: Affine = { ...A0 };
    const substituted = others.map((j) => {
      const v = val[j]!;
      rest = addA(rest, v, r[j]);
      const vt = texAffine(v, o);
      const needParen = !isConst(v) || v.c < 0;
      const coef = Math.abs(r[j]);
      const coefT = Math.abs(coef - 1) < EPS ? '' : `${texNum(coef, o)}\\cdot `;
      return `${r[j] < 0 ? '-' : '+'} ${coefT}${needParen ? `\\left(${vt}\\right)` : vt}`;
    });
    const pc = r[p];
    const pT = Math.abs(pc - 1) < EPS ? '' : Math.abs(pc + 1) < EPS ? '-' : texNum(pc, o);
    const xp = cleanA(scaleA(addA({ c: r[3], t: 0, s: 0 }, rest, -1), 1 / pc));
    val[p] = xp;
    let line = `${TROMAN[i]}:\\; ${texEquationRow(r, o)}`;
    if (others.length) line += ` \\;\\Rightarrow\\; ${pT}${VARS[p]} ${substituted.join(' ')} = ${texNum(r[3], o)}`;
    const rhs = cleanA(addA({ c: r[3], t: 0, s: 0 }, rest, -1));
    if (others.length) line += ` \\;\\Rightarrow\\; ${pT}${VARS[p]} = ${texAffine(rhs, o)}`;
    if (Math.abs(pc - 1) > EPS) line += ` \\;\\Rightarrow\\; ${VARS[p]} = ${texAffine(xp, o)}`;
    lines.push(line);
  }
  const solution = val.map((v) => cleanA(v ?? A0));
  const kind = free.length === 0 ? 'unique' : free.length === 3 ? 'all' : 'infinite';
  return { kind, lines, solution, contradiction: -1 };
}

/** Lösungsmenge als LaTeX */
export function texSolutionSet(r: BackSubResult, o: FormatOptions = defaultFormat): string {
  if (r.kind === 'none' || !r.solution) return 'L = \\emptyset';
  if (r.kind === 'all') return 'L = \\mathbb{R}^3';
  const vec = (f: (a: Affine) => number) => `\\begin{pmatrix} ${r.solution!.map((a) => texNum(f(a), o)).join(' \\\\ ')} \\end{pmatrix}`;
  if (r.kind === 'unique') return `L = \\left\\{ ${vec((a) => a.c)} \\right\\}`;
  const hasS = r.solution.some((a) => Math.abs(a.s) > EPS);
  return `L = \\left\\{ ${vec((a) => a.c)} + t\\, ${vec((a) => a.t)}${hasS ? ` + s\\, ${vec((a) => a.s)}` : ''} \\;\\middle|\\; t${hasS ? ', s' : ''} \\in \\mathbb{R} \\right\\}`;
}
