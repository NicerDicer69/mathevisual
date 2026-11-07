/**
 * Modul 6 – Lineare Gleichungssysteme: drei Ebenen im Raum, Lösung als
 * Punkt/Gerade/Ebene/leer und Gauß-Verfahren Schritt für Schritt.
 */
import * as THREE from 'three';
import type { AppContext, ModuleDef } from '../../core/module';
import { h, card, row, matEditor, toggle, button, note, renderTex } from '../../core/ui';
import { clearGroup, makePlane, makeLine, makePoint, makeLabel, COLORS, toV3 } from '../../core/objects';
import { parseMat, allFinite } from '../../math/parse';
import { gaussSteps, solveLgs, scale, dot, type Vec3, type GaussStep } from '../../math/linalg';
import { texMat } from '../../math/format';
import { texRowOp, describeRowOp, texEquation, texSolution, SOLUTION_TEXT, isContradiction, PRESETS } from './math';

interface LState { m: string[][]; step: number; follow: boolean }
const DEFAULT: LState = { m: PRESETS[0].m.map((r) => r.slice()), step: 0, follow: true };
const PCOL = [COLORS.pink, COLORS.cyan, COLORS.amber];

export const lgsModule: ModuleDef = {
  id: 'lgs',
  title: 'Lineare Gleichungssysteme',
  short: 'LGS',
  icon: '≡',
  create(ctx: AppContext) {
    const { store } = ctx;
    const S = () => store.get<LState>('lgs', DEFAULT);
    const save = () => store.set('lgs', S());
    const group = new THREE.Group();

    const editor = matEditor(S().m, (v) => { S().m = v; S().step = 0; save(); update(); }, { augmented: true });
    const err = note('error');
    const eqs = h('div');
    const solution = h('div');
    const stepView = h('div');
    const stepList = h('div', { class: 'steps' });
    const btnPrev = button('◀ Zurück', () => go(S().step - 1));
    const btnNext = button('Nächster Schritt ▶', () => go(S().step + 1), 'primary');

    const panel = h('div', {},
      card('Gleichungssystem (A | b)', editor.el,
        h('div', { class: 'row' }, h('span', { class: 'muted' }, 'Beispiele:'), ...PRESETS.map((p) => button(p.name, () => {
          S().m = p.m.map((r) => r.slice()); S().step = 0; save(); editor.set(S().m); update();
        }, 'small'))),
        eqs, err),
      card('Lösung', solution),
      card('Gauß-Verfahren',
        row(button('⏮', () => go(0), 'small'), btnPrev, btnNext, button('⏭ Alle', () => go(Infinity), 'small')),
        toggle('Ebenen des aktuellen Schritts zeigen', S().follow, (v) => { S().follow = v; save(); update(); }),
        stepView, stepList,
        h('p', { class: 'hint' }, 'Zeilenumformungen verändern die Ebenen, aber nie die gemeinsame Lösungsmenge. Ausführlich erklärt (mit Selbst-Rechnen) im Tab „Gauß“.')),
    );

    let steps: GaussStep[] = [];

    function go(i: number) {
      S().step = Math.max(0, Math.min(steps.length - 1, i));
      save();
      update();
      stepList.querySelector('.current')?.scrollIntoView({ block: 'nearest' });
    }

    function update() {
      const st = S();
      const fmt = ctx.fmt();
      clearGroup(group);
      const M = parseMat(st.m);
      if (!allFinite(M)) { err.textContent = 'Ungültige Eingabe – bitte Zahlen prüfen.'; return; }
      err.textContent = '';
      steps = gaussSteps(M);
      st.step = Math.min(st.step, steps.length - 1);
      const cur = steps[st.step];
      const A = M.map((r) => r.slice(0, 3));
      const b = M.map((r) => r[3]) as Vec3;
      const sol = solveLgs(A, b);

      // ---- Gleichungen ----
      eqs.replaceChildren(...M.map((r, i) => {
        const e = h('div', { class: 'row' }, h('span', { class: 'color-dot', style: { background: PCOL[i] } }));
        const t = h('span'); renderTex(t, `${['\\text{I}', '\\text{II}', '\\text{III}'][i]}:\\; ${texEquation(r, fmt)}`); e.append(t);
        return e;
      }));

      // ---- Ebenen ----
      const shown = st.follow ? cur.matrix : M;
      shown.forEach((r, i) => {
        const n = r.slice(0, 3) as Vec3;
        const nn = dot(n, n);
        if (nn < 1e-12) return; // 0 = c: keine Ebene
        const p = scale(n, r[3] / nn); // Punkt der Ebene, der dem Ursprung am nächsten ist
        group.add(makePlane(n, p, PCOL[i], 9, 0.2));
        const lbl = makeLabel(['I', 'II', 'III'][i], PCOL[i], 0.32);
        lbl.position.copy(toV3(p)).add(toV3(n).normalize().multiplyScalar(0.3));
        group.add(lbl);
      });

      // ---- Lösung ----
      if (sol.type === 'point') {
        group.add(makePoint(sol.point!, COLORS.white, 0.14));
        const l = makeLabel('Lösung', COLORS.white, 0.28);
        l.position.copy(toV3(sol.point!)).add(new THREE.Vector3(0, 0, 0.4));
        group.add(l);
      } else if (sol.type === 'line') {
        group.add(makeLine(sol.point!, sol.dirs[0], COLORS.white, 16, 0.05, 1));
      } else if (sol.type === 'plane') {
        group.add(makePlane(([0, 1, 2].map((k) => A.find((r) => dot(r, r) > 0)![k]) as Vec3), sol.point!, COLORS.white, 9.2, 0.12));
      }
      const badgeCls = sol.type === 'empty' ? 'err' : sol.type === 'point' ? 'ok' : 'info';
      const label = { point: 'Punkt', line: 'Gerade', plane: 'Ebene', space: 'ganzer Raum', empty: 'leer' }[sol.type];
      const solTex = h('div'); renderTex(solTex, texSolution(sol, fmt), true);
      solution.replaceChildren(
        h('div', { class: 'row' }, h('span', { class: `badge ${badgeCls}` }, `Lösungsmenge: ${label}`), h('span', { class: 'badge info' }, `Rang A = ${sol.rankA}`), h('span', { class: 'badge info' }, `Rang (A|b) = ${sol.rankAug}`)),
        h('p', {}, SOLUTION_TEXT[sol.type] + '.'),
        solTex,
      );

      // ---- Gauß-Schritt ----
      const head = h('div', { class: 'row' }, h('span', { class: 'badge info' }, `Schritt ${st.step} / ${steps.length - 1}`), h('span', { class: 'muted' }, describeRowOp(cur.op)));
      const mat = h('div');
      renderTex(mat, `${cur.op ? `\\xrightarrow{${texRowOp(cur.op, fmt)}}\\;` : ''}${texMat(cur.matrix, fmt, true)}`, true);
      stepView.replaceChildren(head, mat);
      if (st.step === steps.length - 1) {
        const contra = cur.matrix.findIndex(isContradiction);
        stepView.append(note(contra >= 0 ? 'error' : 'ok',
          contra >= 0 ? `Zeile ${['I', 'II', 'III'][contra]} lautet 0 = ${cur.matrix[contra][3].toFixed(3).replace(/\.?0+$/, '')} – Widerspruch, keine Lösung.` : 'Reduzierte Zeilenstufenform erreicht.'));
      }
      btnPrev.disabled = st.step === 0;
      btnNext.disabled = st.step >= steps.length - 1;

      stepList.replaceChildren(...steps.map((s, i) => {
        const e = h('div', { class: `step${i === st.step ? ' current' : ''}${i > st.step ? ' future' : ''}`, onclick: () => go(i) });
        renderTex(e, s.op ? `${i}.\\; ${texRowOp(s.op, fmt)}` : '0.\\; \\text{Start}');
        return e;
      }));
    }

    ctx.onSettings(update);
    update();
    return { panel, group, activate: update };
  },
};
