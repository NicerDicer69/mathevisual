/**
 * Modul 6 – Lineare Gleichungssysteme: Darstellung der Zeilenoperationen und
 * Lösungsmengen als LaTeX (rein, testbar).
 */
import { type RowOp, type LgsSolution } from '../../math/linalg';
import { texNum, texVec, texLinComb, type FormatOptions, defaultFormat } from '../../math/format';

const ROMAN = ['\\text{I}', '\\text{II}', '\\text{III}', '\\text{IV}'];

/** Zeilenoperation als LaTeX, z. B. "\text{II} \leftarrow \text{II} - 2\cdot\text{I}". */
export function texRowOp(op: RowOp, o: FormatOptions = defaultFormat): string {
  switch (op.type) {
    case 'swap':
      return `${ROMAN[op.i]} \\leftrightarrow ${ROMAN[op.j]}`;
    case 'scale':
      return `${ROMAN[op.i]} \\leftarrow ${texNum(op.factor, o)} \\cdot ${ROMAN[op.i]}`;
    case 'add': {
      const abs = Math.abs(op.factor);
      const f = Math.abs(abs - 1) < 1e-12 ? '' : `${texNum(abs, o)} \\cdot `;
      return `${ROMAN[op.target]} \\leftarrow ${ROMAN[op.target]} ${op.factor < 0 ? '-' : '+'} ${f}${ROMAN[op.source]}`;
    }
  }
}

/** Kurzbeschreibung auf Deutsch. */
export function describeRowOp(op: RowOp | null): string {
  if (!op) return 'Ausgangssystem';
  const R = ['I', 'II', 'III', 'IV'];
  switch (op.type) {
    case 'swap': return `Zeilen ${R[op.i]} und ${R[op.j]} tauschen`;
    case 'scale': return `Zeile ${R[op.i]} normieren (Pivot = 1)`;
    case 'add': return `Eintrag in Zeile ${R[op.target]} eliminieren`;
  }
}

/** Gleichung einer Zeile, z. B. "x + 2y - z = 3". */
export function texEquation(row: number[], o: FormatOptions = defaultFormat): string {
  return `${texLinComb(row.slice(0, 3), ['x', 'y', 'z'], o)} = ${texNum(row[3], o)}`;
}

export const SOLUTION_TEXT: Record<LgsSolution['type'], string> = {
  point: 'genau eine Lösung – die Ebenen schneiden sich in einem Punkt',
  line: 'unendlich viele Lösungen – die Ebenen schneiden sich in einer Geraden',
  plane: 'unendlich viele Lösungen – alle Ebenen fallen zusammen (Lösungsmenge ist eine Ebene)',
  space: 'jeder Punkt ist Lösung (alle Gleichungen lauten 0 = 0)',
  empty: 'keine Lösung – die Ebenen haben keinen gemeinsamen Punkt (z. B. parallele Ebenen)',
};

/** Lösungsmenge als LaTeX. */
export function texSolution(s: LgsSolution, o: FormatOptions = defaultFormat): string {
  if (s.type === 'empty') return 'L = \\emptyset';
  if (s.type === 'space') return 'L = \\mathbb{R}^3';
  const p = texVec(s.point!, o);
  if (s.type === 'point') return `L = \\left\\{ ${p} \\right\\}`;
  const params = ['s', 't', 'u'];
  const terms = s.dirs.map((d, i) => `${params[i]}\\cdot ${texVec(d, o)}`).join(' + ');
  return `L = \\left\\{ ${p} + ${terms} \\;\\middle|\\; ${params.slice(0, s.dirs.length).join(', ')} \\in \\mathbb{R} \\right\\}`;
}

/** Ist die Zeile ein Widerspruch "0 = c" mit c ≠ 0? */
export const isContradiction = (row: number[]) =>
  row.slice(0, 3).every((x) => Math.abs(x) < 1e-12) && Math.abs(row[3]) > 1e-12;

export const PRESETS: { name: string; m: string[][] }[] = [
  { name: 'Punkt', m: [['1', '1', '1', '6'], ['1', '2', '3', '14'], ['2', '1', '1', '7']] },
  { name: 'Gerade', m: [['1', '1', '1', '3'], ['1', '-1', '0', '0'], ['2', '0', '1', '3']] },
  { name: 'Ebene', m: [['1', '1', '1', '1'], ['2', '2', '2', '2'], ['3', '3', '3', '3']] },
  { name: 'Parallel (leer)', m: [['1', '1', '1', '1'], ['1', '1', '1', '3'], ['1', '-1', '0', '0']] },
  { name: 'Prisma (leer)', m: [['1', '1', '1', '1'], ['1', '-1', '1', '2'], ['2', '0', '2', '5']] },
];
