/**
 * Modul 2 – Matrizen als Transformation: animierter Übergang E → M,
 * mitverformtes Gitter, Standardbasis, Einheitswürfel (Determinante als Volumen),
 * Rang/Spur und Matrizenprodukt mit sichtbarer Reihenfolge.
 */
import * as THREE from 'three';
import type { AppContext, ModuleDef } from '../../core/module';
import { h, card, row, toggle, button, note, renderTex } from '../../core/ui';
import { Arrow, COLORS, clearGroup, makeLabel, toV3 } from '../../core/objects';
import { sharedMatrixEditor, transformControls, readMatrix, DEFAULT_M } from '../../core/components';
import { Lattice, UnitCube, ghostCube } from '../../core/transformVisuals';
import { matMul, matVec, det3, columns, type Matrix } from '../../math/linalg';
import { texMat, texNum, fmtNum } from '../../math/format';
import { transformAt, matrixStats } from './math';

interface MState {
  product: boolean;
  lattice: boolean;
  cube: boolean;
  basis: boolean;
}
const DEFAULT: MState = { product: false, lattice: true, cube: true, basis: true };
const DEFAULT_N = [['0', '-1', '0'], ['1', '0', '0'], ['0', '0', '1']];

export const matrixModule: ModuleDef = {
  id: 'matrix',
  title: 'Matrizen als Transformation',
  short: 'Matrizen',
  icon: '▦',
  create(ctx: AppContext) {
    const { store } = ctx;
    const S = () => store.get<MState>('matrixMod', DEFAULT);
    const save = () => store.set('matrixMod', S());
    const group = new THREE.Group();

    const lattice = new Lattice(2, 3);
    const cube = new UnitCube();
    const ghost = ghostCube();
    const dyn = new THREE.Group(); // Pfeile/Beschriftungen, die neu gebaut werden
    group.add(lattice.object, cube.group, ghost, dyn);
    const e = [
      new Arrow([0, 0, 0], [1, 0, 0], COLORS.x, { label: 'e₁', radius: 0.045 }),
      new Arrow([0, 0, 0], [0, 1, 0], COLORS.y, { label: 'e₂', radius: 0.045 }),
      new Arrow([0, 0, 0], [0, 0, 1], COLORS.z, { label: 'e₃', radius: 0.045 }),
    ];
    group.add(...e);

    // ---------------- Panel ----------------
    const { el: mEditor } = sharedMatrixEditor(store);
    const { el: nEditor } = sharedMatrixEditor(store, { key: 'matrixN', title: 'N =', presets: true });
    const tc = transformControls(() => update(), 1, S().product ? 2 : 1);
    const err = note('error');
    const phase = h('div', { class: 'hint' });
    const stats = h('div', { class: 'stats' });
    const live = h('div');
    const prodInfo = h('div');
    const nWrap = h('div', { style: { display: S().product ? '' : 'none' } }, nEditor, prodInfo,
      row(button('Reihenfolge tauschen (M ↔ N)', () => {
        const m = store.get('matrix', DEFAULT_M);
        const n = store.get('matrixN', DEFAULT_N);
        store.set('matrix', n);
        store.set('matrixN', m);
        tc.play();
      }, 'small')));

    const panel = h('div', {},
      card('Matrix M', mEditor, h('p', { class: 'hint' }, 'Die Spalten von M sind die Bilder von e₁, e₂, e₃. M wird auch in den Modulen Körper, Eigenwerte und Kern/Bild verwendet.'), err),
      card('Animation E → M', tc.el, phase),
      card('Kenngrößen', stats, live),
      card('Matrizenprodukt',
        toggle('Zwei Matrizen nacheinander anwenden', S().product, (v) => {
          S().product = v; save();
          nWrap.style.display = v ? '' : 'none';
          tc.setMax(v ? 2 : 1);
          update();
        }),
        nWrap,
      ),
      card('Anzeige',
        toggle('Gitter', S().lattice, (v) => { S().lattice = v; save(); update(); }),
        toggle('Einheitswürfel', S().cube, (v) => { S().cube = v; save(); update(); }),
        toggle('Basis e₁, e₂, e₃', S().basis, (v) => { S().basis = v; save(); update(); }),
      ),
    );

    // ---------------- Aktualisierung ----------------
    let lastStatsKey = '';
    function update() {
      const st = S();
      const fmt = ctx.fmt();
      const M = readMatrix(store);
      const N = st.product ? readMatrix(store, 'matrixN', DEFAULT_N) : null;
      if (!M || (st.product && !N)) {
        err.textContent = 'Ungültige Matrix-Einträge – Anzeige zeigt den letzten gültigen Zustand.';
        return;
      }
      err.textContent = '';
      const t = tc.t();
      const Mt = transformAt(M, t, N);
      const final: Matrix = N ? matMul(N, M) : M;

      lattice.object.visible = st.lattice;
      lattice.update(Mt);
      cube.group.visible = ghost.visible = st.cube;
      cube.update(Mt);
      const cols = columns(Mt);
      e.forEach((a, i) => { a.visible = st.basis; a.set([0, 0, 0], cols[i]); });

      clearGroup(dyn);
      const dt = det3(Mt);
      if (st.cube) {
        const center = matVec(Mt, [0.5, 0.5, 0.5]);
        const lbl = makeLabel(`Vol = ${fmtNum(Math.abs(dt), { mode: 'dec', decimals: 2 })}`, dt < -1e-9 ? '#fda4af' : '#ddd6fe', 0.24);
        lbl.position.copy(toV3(center)).add(new THREE.Vector3(0, 0, 0.15));
        dyn.add(lbl);
      }

      phase.textContent = !N
        ? `t = ${t.toFixed(2)}: angezeigt wird (1−t)·E + t·M`
        : t <= 1 ? `Phase 1 (t ≤ 1): zuerst wird M angewendet` : `Phase 2 (t > 1): danach wird N angewendet → insgesamt N·M`;

      // Live-Determinante
      const orient = dt > 1e-9 ? 'Orientierung erhalten' : dt < -1e-9 ? 'Orientierung gekippt (Spiegelung!)' : 'Volumen 0 – Raum wird plattgedrückt';
      live.replaceChildren(
        h('div', { class: 'row' },
          h('span', { class: 'muted' }, `det(M_t) = ${fmtNum(dt, { mode: 'dec', decimals: 3 })}`),
          h('span', { class: `badge ${dt > 1e-9 ? 'ok' : dt < -1e-9 ? 'err' : 'warn'}` }, orient)),
        h('p', { class: 'hint' }, 'Der Einheitswürfel (Volumen 1) wird auf ein Spat mit Volumen |det| abgebildet. Rot = negative Determinante.'),
      );

      // Statische Kenngrößen nur bei Änderung neu rendern
      const key = JSON.stringify([final, fmt, !!N]);
      if (key === lastStatsKey) return;
      lastStatsKey = key;
      const s = matrixStats(final);
      const stat = (k: string, latex: string) => {
        const v = h('div', { class: 'v' });
        renderTex(v, latex);
        return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), v);
      };
      stats.replaceChildren(
        stat(N ? 'det(N·M)' : 'det M', texNum(s.det, fmt)),
        stat('Rang', String(s.rank)),
        stat('Spur', texNum(s.trace, fmt)),
      );
      if (N) {
        const NM = matMul(N, M), MN = matMul(M, N);
        const same = JSON.stringify(NM.map((r) => r.map((x) => +x.toFixed(9)))) === JSON.stringify(MN.map((r) => r.map((x) => +x.toFixed(9))));
        const d1 = h('div'); renderTex(d1, `\\underbrace{N\\cdot M}_{\\text{erst } M \\text{, dann } N} = ${texMat(NM, fmt)}`, true);
        const d2 = h('div'); renderTex(d2, `M\\cdot N = ${texMat(MN, fmt)}`, true);
        const d3 = h('div'); renderTex(d3, `\\det(N M) = \\det N \\cdot \\det M = ${texNum(det3(N!), fmt)} \\cdot ${texNum(det3(M), fmt)} = ${texNum(det3(NM), fmt)}`, true);
        prodInfo.replaceChildren(
          h('p', { class: 'hint' }, 'Matrizen wirken von rechts nach links: (N·M)x = N(Mx). Die rechte Matrix wird zuerst angewendet.'),
          d1, d2, d3,
          h('span', { class: `badge ${same ? 'ok' : 'warn'}` }, same ? 'Hier gilt M·N = N·M' : 'M·N ≠ N·M – Reihenfolge ist wichtig!'),
        );
      }
    }

    store.on('matrix', update);
    store.on('matrixN', update);
    ctx.onSettings(() => { lastStatsKey = ''; update(); });
    update();

    return { panel, group, activate: () => { lastStatsKey = ''; update(); } };
  },
};
