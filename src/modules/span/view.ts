/**
 * Modul 4 – Lineare Unabhängigkeit, Span, Basis.
 * Bis zu 3 Vektoren (Einträge dürfen den Parameter a enthalten), automatische
 * Analyse, Darstellung des Spans, "Rundweg" bei Abhängigkeit und Basiswechsel.
 */
import * as THREE from 'three';
import type { AppContext, ModuleDef } from '../../core/module';
import { h, card, row, vecEditor, slider, select, toggle, note, renderTex, exprInput, type VecEditor } from '../../core/ui';
import { Arrow, clearGroup, makeLine, makePlane, makeSpaceBox, makeDashed, COLORS } from '../../core/objects';
import { parseVec, parseExpr, allFinite } from '../../math/parse';
import { texVec, texPlane, texLinComb, fmtNum } from '../../math/format';
import { scale, add, cross, type Vec3 } from '../../math/linalg';
import { analyzeSpan, coordsInBasis, distanceToPlane } from './math';

interface SState {
  v: string[][];
  count: number;
  a: number;
  showLoop: boolean;
  w: string[];
  showCoords: boolean;
}
const DEFAULT: SState = {
  v: [['1', '1', '0'], ['0', '1', '1'], ['1', '2', 'a']],
  count: 3,
  a: 0,
  showLoop: true,
  w: ['2', '3', '1'],
  showCoords: true,
};
const VCOL = [COLORS.pink, COLORS.cyan, COLORS.amber];
const SUB = ['₁', '₂', '₃'];

export const spanModule: ModuleDef = {
  id: 'span',
  title: 'Lineare Unabhängigkeit, Span & Basis',
  short: 'Span',
  icon: '⟋',
  create(ctx: AppContext) {
    const { store } = ctx;
    const S = () => store.get<SState>('span', DEFAULT);
    const save = () => store.set('span', S());
    const group = new THREE.Group();
    const scope = () => ({ a: S().a });

    // ---------------- Panel ----------------
    const editors: VecEditor[] = [];
    const rows: HTMLElement[] = [];
    S().v.forEach((v, i) => {
      const ed = vecEditor(v, (nv) => { S().v[i] = nv; save(); update(); }, scope);
      editors.push(ed);
      rows.push(h('div', { class: 'vec-item' }, h('span', { class: 'name', style: { color: VCOL[i] } }, `v${SUB[i]}`), ed.el));
    });
    const countSel = select(['1', '2', '3'].map((c) => ({ value: c, label: `${c} Vektor${c === '1' ? '' : 'en'}` })), String(S().count), (v) => { S().count = Number(v); save(); update(); });
    const aInput = exprInput(String(S().a), (v) => {
      const x = parseExpr(v);
      if (isFinite(x)) { S().a = x; aSlider.set(Math.max(-3, Math.min(3, x))); save(); update(); }
    });
    const aSlider = slider({ label: 'a', min: -3, max: 3, step: 0.05, value: S().a, onInput: (v) => { S().a = v; aInput.value = String(v); save(); update(); } });
    const err = note('error');
    const result = h('div');
    const loopInfo = h('div');
    const wEditor = vecEditor(S().w, (nv) => { S().w = nv; save(); update(); }, scope);
    const coordInfo = h('div');

    const panel = h('div', {},
      card('Vektoren', row(h('span', { class: 'muted' }, 'Anzahl'), countSel), ...rows,
        h('p', { class: 'hint' }, 'Einträge dürfen den Parameter a enthalten, z. B. v₃ = (1, 2, a).'),
        aSlider.el, row(h('span', { class: 'muted' }, 'a exakt ='), aInput), err),
      card('Analyse', result),
      card('Rundweg (Linearkombination = 0)', toggle('Rundweg im Raum zeigen', S().showLoop, (v) => { S().showLoop = v; save(); update(); }), loopInfo),
      card('Basiswechsel', row(h('span', { class: 'muted' }, 'w ='), wEditor.el),
        toggle('Zerlegung im Raum zeigen', S().showCoords, (v) => { S().showCoords = v; save(); update(); }), coordInfo),
    );

    // ---------------- Aktualisierung ----------------
    function update() {
      const st = S();
      const fmt = ctx.fmt();
      editors.forEach((e) => e.validate());
      wEditor.validate();
      rows.forEach((r, i) => (r.style.display = i < st.count ? '' : 'none'));
      clearGroup(group);
      result.replaceChildren();
      loopInfo.replaceChildren();
      coordInfo.replaceChildren();

      const raw = st.v.slice(0, st.count).map((v) => parseVec(v, scope()));
      if (!allFinite(raw)) { err.textContent = 'Ungültige Eingabe in einem Vektor.'; return; }
      err.textContent = '';
      const vs = raw as Vec3[];
      const an = analyzeSpan(vs);
      const names = vs.map((_, i) => `v_{${i + 1}}`);

      vs.forEach((v, i) => group.add(new Arrow([0, 0, 0], v, VCOL[i], { label: `v${SUB[i]}`, radius: 0.045 })));

      // ---- Span zeichnen ----
      const spanColor = COLORS.accent;
      if (an.kind === 'line') group.add(makeLine([0, 0, 0], an.lineDir!, spanColor, 18, 0.03, 0.85));
      if (an.kind === 'plane') group.add(makePlane(an.planeNormal!, [0, 0, 0], spanColor, 10, 0.25));
      if (an.kind === 'space') group.add(makeSpaceBox(spanColor, 8, 0.05));
      // Bei 3 Vektoren immer die Ebene span(v1, v2) andeuten, damit man sieht, wie v3 hineinfällt
      let dist: number | null = null;
      if (st.count === 3 && an.kind === 'space') {
        const n = cross(vs[0], vs[1]);
        dist = distanceToPlane(vs[0], vs[1], vs[2]);
        if (dist !== null) {
          group.add(makePlane(n, [0, 0, 0], COLORS.gray, 10, 0.1));
          // Lot von v3 auf die Ebene
          const nn = Math.hypot(...n);
          const s = (n[0] * vs[2][0] + n[1] * vs[2][1] + n[2] * vs[2][2]) / (nn * nn);
          group.add(makeDashed(vs[2], add(vs[2], scale(n, -s)), COLORS.amber));
        }
      }

      // ---- Analyse-Text ----
      const kindText = { point: 'nur der Nullvektor {0}', line: 'eine Gerade durch 0', plane: 'eine Ebene durch 0', space: 'der ganze Raum ℝ³' }[an.kind];
      result.append(
        h('div', { class: 'row' },
          h('span', { class: `badge ${an.independent ? 'ok' : 'err'}` }, an.independent ? 'linear unabhängig' : 'linear abhängig'),
          h('span', { class: 'badge info' }, `Rang ${an.rank}`),
          h('span', { class: 'badge info' }, `dim span = ${an.dim}`)),
        h('p', {}, `Der Span ist ${kindText}.`),
      );
      const tx = (latex: string) => { const e = h('div'); renderTex(e, latex, true); result.append(e); };
      if (an.kind === 'plane') tx(`\\text{Ebene: } ${texPlane(an.planeNormal!, 0, fmt)}`);
      if (an.kind === 'line') tx(`\\text{Gerade: } \\{\\, t\\cdot ${texVec(an.lineDir!, fmt)} \\mid t\\in\\mathbb{R} \\,\\}`);
      if (an.basisIdx.length && !an.independent) tx(`\\text{Basis des Spans: } (${an.basisIdx.map((i) => names[i]).join(', ')})`);
      if (an.independent && vs.length === 3) result.append(h('p', { class: 'hint' }, 'Drei unabhängige Vektoren im ℝ³ bilden eine Basis.'));
      if (dist !== null) result.append(h('p', { class: 'hint' }, `Abstand von v₃ zur grauen Ebene span(v₁, v₂): ${fmtNum(dist, { mode: 'dec', decimals: 3 })} – bei 0 fällt v₃ in die Ebene.`));
      if (st.v.slice(0, st.count).flat().some((s) => /\ba\b/.test(s))) result.append(h('p', { class: 'hint' }, `Aktueller Parameter: a = ${fmtNum(st.a, fmt)}`));

      // ---- Rundweg ----
      if (an.combination) {
        const e = h('div');
        renderTex(e, `${texLinComb(an.combination, names, fmt)} = 0`, true);
        loopInfo.append(e, h('p', { class: 'hint' }, 'Geht man die Vektoren mit diesen Faktoren nacheinander ab, landet man wieder im Ursprung – ein geschlossener Rundweg (gelb).'));
        if (st.showLoop) {
          let k = 0;
          an.combination.forEach((c, i) => {
            if (c === 0) return;
            const from = an.loop[k], to = an.loop[k + 1];
            const lbl = `${c === 1 ? '' : c === -1 ? '−' : fmtNum(c, fmt)}v${SUB[i]}`;
            group.add(new Arrow(from, to, '#fde047', { radius: 0.028, label: lbl, opacity: 0.95 }));
            k++;
          });
        }
      } else {
        loopInfo.append(h('p', { class: 'hint' }, 'Die Vektoren sind unabhängig – nur die triviale Kombination (alle Faktoren 0) ergibt den Nullvektor.'));
      }

      // ---- Basiswechsel ----
      const w = parseVec(st.w, scope());
      if (!allFinite(w)) { coordInfo.append(note('error', 'Ungültiger Vektor w.')); return; }
      const c = vs.length === 3 ? coordsInBasis(vs, w as Vec3) : null;
      if (!c) {
        coordInfo.append(note('warn', 'Für einen Basiswechsel im ℝ³ werden 3 linear unabhängige Vektoren benötigt.'));
        return;
      }
      const ce = h('div');
      renderTex(ce, `w = ${texLinComb(c, names, fmt)} \\quad\\Rightarrow\\quad [w]_B = ${texVec(c, fmt)}`, true);
      const ce2 = h('div');
      renderTex(ce2, `\\text{Standardkoordinaten: } w = ${texVec(w, fmt)}`, true);
      coordInfo.append(ce, ce2, h('p', { class: 'hint' }, 'Gelöst wird das LGS (v₁ v₂ v₃)·c = w.'));
      group.add(new Arrow([0, 0, 0], w as Vec3, COLORS.white, { label: 'w', radius: 0.04 }));
      if (st.showCoords) {
        let p: Vec3 = [0, 0, 0];
        c.forEach((ci, i) => {
          const q = add(p, scale(vs[i], ci));
          group.add(makeDashed(p, q, VCOL[i], 0.1));
          p = q;
        });
      }
    }

    store.on('span', () => editors.forEach((e, i) => e.set(S().v[i])));
    ctx.onSettings(update);
    update();
    return { panel, group, activate: update };
  },
};
