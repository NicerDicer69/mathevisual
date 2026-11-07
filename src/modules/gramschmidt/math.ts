/**
 * Modul 8 – Gram-Schmidt: zerlegt das Verfahren in einzelne, animierbare
 * Schritte. Jeder Schritt beschreibt, welche Pfeile sichtbar sind.
 */
import { gramSchmidt, add, type Vec3, type GramSchmidtResult } from '../../math/linalg';

export type GsStepKind = 'start' | 'u' | 'e' | 'proj' | 'done';

export interface GsStep {
  kind: GsStepKind;
  /** betroffener Index k (0-basiert) */
  k: number;
}

export type ArrowStyle = 'orig' | 'work' | 'proj' | 'final';

export interface GsArrow {
  id: string;
  from: Vec3;
  to: Vec3;
  style: ArrowStyle;
  /** Index des zugehörigen Vektors (für Farbe) */
  k: number;
  label?: string;
}

const SUB = ['₁', '₂', '₃'];

/** Liste der Schritte (bricht bei linearer Abhängigkeit ab). */
export function buildSteps(g: GramSchmidtResult, n = 3): GsStep[] {
  const steps: GsStep[] = [{ kind: 'start', k: -1 }];
  const ok = g.failAt < 0 ? n : g.failAt;
  for (let k = 0; k < n; k++) {
    if (k > 0) steps.push({ kind: 'proj', k });
    if (k >= ok) break;
    steps.push({ kind: 'u', k }, { kind: 'e', k });
  }
  if (g.failAt < 0) steps.push({ kind: 'done', k: n });
  return steps;
}

/**
 * Sichtbare Pfeile nach Schritt `idx`. Der Arbeitspfeil w_k wandert
 * v_k → u_k → e_k; Projektionen werden aneinandergehängt gezeigt.
 */
export function arrowsAt(vs: Vec3[], g: GramSchmidtResult, steps: GsStep[], idx: number): GsArrow[] {
  const O: Vec3 = [0, 0, 0];
  const out: GsArrow[] = [];
  const stage = vs.map(() => 'v' as 'v' | 'u' | 'e');
  let projK = -1;
  for (let i = 1; i <= idx && i < steps.length; i++) {
    const s = steps[i];
    projK = -1;
    if (s.kind === 'u') stage[s.k] = 'u';
    if (s.kind === 'e') stage[s.k] = 'e';
    if (s.kind === 'proj' || s.kind === 'u') projK = s.k;
  }
  vs.forEach((v, k) => {
    // Original als Geisterpfeil, sobald der Arbeitspfeil davon abweicht
    if (stage[k] !== 'v') out.push({ id: `v${k}`, from: O, to: v, style: 'orig', k, label: `v${SUB[k]}` });
    const to = stage[k] === 'v' ? v : stage[k] === 'u' ? g.us[k] : g.es[k];
    const label = stage[k] === 'v' ? `v${SUB[k]}` : stage[k] === 'u' ? `u${SUB[k]}` : `e${SUB[k]}`;
    out.push({ id: `w${k}`, from: O, to, style: stage[k] === 'e' ? 'final' : 'work', k, label });
  });
  if (projK > 0 && g.projs[projK]) {
    let p: Vec3 = O;
    g.projs[projK].forEach((pr, j) => {
      const q = add(p, pr);
      out.push({ id: `p${projK}_${j}`, from: p, to: q, style: 'proj', k: j, label: `⟨v${SUB[projK]},e${SUB[j]}⟩e${SUB[j]}` });
      p = q;
    });
  }
  return out;
}

export function runGramSchmidt(vs: Vec3[]) {
  const g = gramSchmidt(vs);
  const steps = buildSteps(g, vs.length);
  return { g, steps };
}
