/**
 * Modul 8 – Gram-Schmidt: drei Vektoren werden Schritt für Schritt (animiert)
 * zu einer Orthonormalbasis.
 */
import * as THREE from 'three';
import type { AppContext, ModuleDef } from '../../core/module';
import { h, card, row, vecEditor, button, note, renderTex, animate } from '../../core/ui';
import { Arrow, clearGroup, makeDashed, COLORS, disposeObject } from '../../core/objects';
import { parseVec, allFinite } from '../../math/parse';
import { texVec, texNum } from '../../math/format';
import { dot, add, fromColumns, type Vec3, type GramSchmidtResult } from '../../math/linalg';
import { runGramSchmidt, arrowsAt, type GsArrow, type GsStep } from './math';

interface GState { v: string[][]; step: number }
const DEFAULT: GState = { v: [['2', '1', '0'], ['1', '2', '1'], ['0', '1', '2']], step: 0 };
const VCOL = [COLORS.pink, COLORS.cyan, COLORS.amber];
const SUB = ['₁', '₂', '₃'];
const lerp3 = (a: Vec3, b: Vec3, k: number): Vec3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

export const gramSchmidtModule: ModuleDef = {
  id: 'gramschmidt',
  title: 'Gram-Schmidt-Verfahren',
  short: 'Gram-Schmidt',
  icon: '⊾',
  create(ctx: AppContext) {
    const { store } = ctx;
    const S = () => store.get<GState>('gs', DEFAULT);
    const save = () => store.set('gs', S());
    const group = new THREE.Group();
    const arrowsGroup = new THREE.Group();
    const extras = new THREE.Group();
    group.add(arrowsGroup, extras);

    const editors = S().v.map((v, i) => vecEditor(v, (nv) => { S().v[i] = nv; S().step = 0; save(); recompute(true); }));
    const err = note('error');
    const stepView = h('div');
    const stepList = h('div', { class: 'steps' });
    const btnPrev = button('◀ Zurück', () => go(S().step - 1));
    const btnNext = button('Nächster Schritt ▶', () => go(S().step + 1), 'primary');
    let playTimer: number | undefined;
    const btnPlay = button('▶▶ Abspielen', () => togglePlay(), 'small');

    const panel = h('div', {},
      card('Vektoren', ...editors.map((e, i) => h('div', { class: 'vec-item' }, h('span', { class: 'name', style: { color: VCOL[i] } }, `v${SUB[i]}`), e.el)), err),
      card('Schritte', row(button('⏮', () => go(0), 'small'), btnPrev, btnNext, btnPlay), stepView, stepList),
      card('Verfahren',
        h('div', { class: 'tex-block' }),
        h('p', { class: 'hint' }, 'Von jedem Vektor werden die Anteile in Richtung der bereits gefundenen e-Vektoren abgezogen (Projektionen). Der Rest steht senkrecht darauf und wird auf Länge 1 normiert.')),
    );
    renderTex(panel.querySelector('.tex-block') as HTMLElement,
      'u_k = v_k - \\sum_{j<k} \\langle v_k, e_j\\rangle\\, e_j, \\qquad e_k = \\frac{u_k}{\\lVert u_k \\rVert}', true);

    let vs: Vec3[] = [];
    let g: GramSchmidtResult | null = null;
    let steps: GsStep[] = [];
    const objs = new Map<string, Arrow>();
    let shown: GsArrow[] = [];
    let cancelAnim: (() => void) | null = null;

    const colorOf = (a: GsArrow) => (a.style === 'proj' ? '#fdba74' : a.style === 'orig' ? '#64748b' : VCOL[a.k]);
    const radiusOf = (a: GsArrow) => (a.style === 'orig' ? 0.022 : a.style === 'proj' ? 0.03 : a.style === 'final' ? 0.055 : 0.045);

    function ensureArrow(a: GsArrow): Arrow {
      let o = objs.get(a.id);
      if (!o) {
        o = new Arrow(a.from, a.from, colorOf(a), { radius: radiusOf(a), label: a.label, opacity: a.style === 'orig' ? 0.6 : 1 });
        o.userData.label = a.label;
        objs.set(a.id, o);
        arrowsGroup.add(o);
      } else if (o.userData.label !== a.label || o.userData.style !== a.style) {
        // Beschriftung/Stil geändert → Pfeil neu erzeugen, aber an alter Position
        const old = o;
        o = new Arrow(a.from, a.from, colorOf(a), { radius: radiusOf(a), label: a.label, opacity: a.style === 'orig' ? 0.6 : 1 });
        o.userData.label = a.label;
        o.position.copy(old.position);
        arrowsGroup.remove(old);
        disposeObject(old);
        objs.set(a.id, o);
        arrowsGroup.add(o);
      }
      o.userData.style = a.style;
      return o;
    }

    /** Animiert vom bisherigen Zustand zum Zustand nach Schritt `idx`. */
    function showStep(idx: number, instant = false) {
      if (!g) return;
      const target = arrowsAt(vs, g, steps, idx);
      const prev = new Map(shown.map((a) => [a.id, a]));
      const tgtIds = new Set(target.map((a) => a.id));
      const leaving = shown.filter((a) => !tgtIds.has(a.id));
      cancelAnim?.();
      const startOf = (a: GsArrow) => prev.get(a.id) ?? { ...a, to: a.from };
      target.forEach(ensureArrow);
      const frame = (k: number) => {
        for (const a of target) {
          const s = startOf(a);
          objs.get(a.id)!.set(lerp3(s.from, a.from, k), lerp3(s.to, a.to, k));
        }
        for (const a of leaving) objs.get(a.id)?.set(a.from, lerp3(a.to, a.from, k));
      };
      const finish = () => {
        for (const a of leaving) {
          const o = objs.get(a.id);
          if (o) { arrowsGroup.remove(o); disposeObject(o); objs.delete(a.id); }
        }
        frame(1);
        drawExtras(idx);
      };
      shown = target;
      clearGroup(extras);
      if (instant) finish();
      else cancelAnim = animate(750, frame, finish);
    }

    /** Lot-Linie im Projektionsschritt */
    function drawExtras(idx: number) {
      clearGroup(extras);
      const s = steps[idx];
      if (!g || !s || (s.kind !== 'proj' && s.kind !== 'u') || s.k === 0) return;
      const pSum = g.projs[s.k].reduce((acc, p) => add(acc, p), [0, 0, 0] as Vec3);
      extras.add(makeDashed(pSum, vs[s.k], COLORS.white));
    }

    function stepTex(s: GsStep): string {
      const fmt = ctx.fmt();
      const k = s.k, n = k + 1;
      const V = (v: Vec3) => texVec(v, { ...fmt, mode: 'dec' });
      switch (s.kind) {
        case 'start': return `\\text{Gegeben: } v_1, v_2, v_3`;
        case 'u': return k === 0 ? `u_1 = v_1 = ${V(g!.us[0])}`
          : `u_${n} = v_${n} - ${g!.projs[k].map((_, j) => `\\langle v_${n}, e_${j + 1}\\rangle e_${j + 1}`).join(' - ')} = ${V(g!.us[k])}`;
        case 'e': return `e_${n} = \\frac{u_${n}}{\\lVert u_${n}\\rVert} = ${V(g!.es[k])}`;
        case 'proj': return g!.projs[k].map((p, j) => `\\langle v_${n}, e_${j + 1}\\rangle e_${j + 1} = ${V(p)}`).join(',\\;');
        case 'done': {
          const E = g!.es;
          const Q = fromColumns(E);
          const ok = [0, 1, 2].every((i) => [0, 1, 2].every((j) => Math.abs(dot(E[i], E[j]) - (i === j ? 1 : 0)) < 1e-9));
          return `Q = (e_1\\; e_2\\; e_3) = \\begin{pmatrix} ${Q.map((r) => r.map((x) => texNum(x, { ...fmt, mode: 'dec' })).join(' & ')).join(' \\\\ ')} \\end{pmatrix}, \\quad Q^T Q = E ${ok ? '\\;\\checkmark' : ''}`;
        }
      }
    }
    const stepTitle = (s: GsStep) => {
      const n = s.k + 1;
      return { start: 'Start', u: `u${SUB[s.k]} berechnen`, e: `e${SUB[s.k]} normieren`, proj: `v${SUB[s.k]} auf e₁${n > 2 ? ', e₂' : ''} projizieren`, done: 'Orthonormalbasis fertig' }[s.kind];
    };

    function renderPanel() {
      const st = S();
      const cur = steps[st.step];
      stepView.replaceChildren();
      if (!cur) return;
      const t = h('div');
      renderTex(t, stepTex(cur), true);
      stepView.append(h('div', { class: 'row' }, h('span', { class: 'badge info' }, `Schritt ${st.step} / ${steps.length - 1}`), h('span', { class: 'muted' }, stepTitle(cur))), t);
      if (g && g.failAt >= 0 && st.step === steps.length - 1)
        stepView.append(note('error', `u${SUB[g.failAt]} = 0: v${SUB[g.failAt]} liegt im Span der vorherigen Vektoren (linear abhängig). Keine Orthonormalbasis des ℝ³ möglich.`));
      btnPrev.disabled = st.step === 0;
      btnNext.disabled = st.step >= steps.length - 1;
      stepList.replaceChildren(...steps.map((s, i) =>
        h('div', { class: `step${i === st.step ? ' current' : ''}${i > st.step ? ' future' : ''}`, onclick: () => go(i) }, `${i}. ${stepTitle(s)}`)));
    }

    function go(i: number) {
      S().step = Math.max(0, Math.min(steps.length - 1, i));
      save();
      renderPanel();
      showStep(S().step);
      stepList.querySelector('.current')?.scrollIntoView({ block: 'nearest' });
      if (S().step >= steps.length - 1) stopPlay();
    }

    function togglePlay() {
      if (playTimer) return stopPlay();
      if (S().step >= steps.length - 1) go(0);
      btnPlay.textContent = '⏸ Pause';
      playTimer = window.setInterval(() => go(S().step + 1), 1400);
    }
    function stopPlay() {
      clearInterval(playTimer);
      playTimer = undefined;
      btnPlay.textContent = '▶▶ Abspielen';
    }

    function recompute(instant = false) {
      const raw = S().v.map((v) => parseVec(v));
      if (!allFinite(raw)) { err.textContent = 'Ungültige Eingabe in einem Vektor.'; return; }
      err.textContent = '';
      vs = raw as Vec3[];
      const r = runGramSchmidt(vs);
      g = r.g;
      steps = r.steps;
      S().step = Math.min(S().step, steps.length - 1);
      // bei neuer Eingabe alle Pfeile neu aufbauen
      for (const o of objs.values()) { arrowsGroup.remove(o); disposeObject(o); }
      objs.clear();
      shown = [];
      renderPanel();
      showStep(S().step, instant);
    }

    ctx.onSettings(renderPanel);
    recompute(true);
    return { panel, group, deactivate: stopPlay };
  },
};
