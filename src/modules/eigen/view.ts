/**
 * Modul 5 – Eigenwerte und Eigenvektoren: charakteristisches Polynom,
 * Eigenräume als Geraden/Ebenen, Diagonalisierbarkeit. Während der Animation
 * E → M bleiben Eigenvektoren auf ihrer Geraden, andere Vektoren drehen weg.
 */
import * as THREE from 'three';
import type { AppContext, ModuleDef } from '../../core/module';
import { h, card, toggle, note, renderTex } from '../../core/ui';
import { Arrow, clearGroup, makeLine, makePlane, makeSpaceBox, makeDashed, COLORS, PALETTE } from '../../core/objects';
import { sharedMatrixEditor, transformControls, readMatrix } from '../../core/components';
import { Lattice } from '../../core/transformVisuals';
import { eigen, lerpMat, identity, matVec, normalize, cross, fromColumns, scale, type Vec3, type EigenResult } from '../../math/linalg';
import { texNum, texVec, texMat, texPoly, fmtNum } from '../../math/format';
import { texFactored, nonEigenVector } from './math';

interface EState { lattice: boolean; contrast: boolean }
const DEFAULT: EState = { lattice: true, contrast: true };
const ECOL = [COLORS.amber, COLORS.pink, COLORS.lime];

export const eigenModule: ModuleDef = {
  id: 'eigen',
  title: 'Eigenwerte & Eigenvektoren',
  short: 'Eigen',
  icon: 'λ',
  create(ctx: AppContext) {
    const { store } = ctx;
    const S = () => store.get<EState>('eigen', DEFAULT);
    const save = () => store.set('eigen', S());
    const group = new THREE.Group();
    const lattice = new Lattice(2, 3);
    const stat = new THREE.Group(); // Eigenräume (statisch)
    const dyn = new THREE.Group(); // animierte Pfeile
    group.add(lattice.object, stat, dyn);

    const { el: mEditor } = sharedMatrixEditor(store);
    const tc = transformControls(() => animateVecs(), 1);
    const err = note('error');
    const info = h('div');
    const panel = h('div', {},
      card('Matrix M', mEditor, err),
      card('Animation E → M', tc.el, h('p', { class: 'hint' }, 'Eigenvektoren (farbig) bleiben auf ihrer Geraden und werden nur um λ gestreckt. Der graue Vergleichsvektor ändert seine Richtung.')),
      card('Ergebnis', info),
      card('Anzeige',
        toggle('Gitter mitverformen', S().lattice, (v) => { S().lattice = v; save(); animateVecs(); }),
        toggle('Vergleichsvektor (kein Eigenvektor)', S().contrast, (v) => { S().contrast = v; save(); animateVecs(); })),
    );

    let E: EigenResult | null = null;

    function rebuild() {
      clearGroup(stat);
      info.replaceChildren();
      const M = readMatrix(store);
      if (!M) { err.textContent = 'Ungültige Matrix-Einträge.'; E = null; clearGroup(dyn); return; }
      err.textContent = '';
      const fmt = ctx.fmt();
      E = eigen(M);
      const tx = (latex: string, target: HTMLElement = info) => { const e = h('div'); renderTex(e, latex, true); target.append(e); return e; };

      tx(`\\chi_M(\\lambda) = \\det(\\lambda E - M) = ${texPoly(E.poly, '\\lambda', fmt)}`);
      tx(`= ${texFactored(E, fmt)}`);

      // Tabelle der Eigenwerte
      const tbl = h('table', { class: 'tbl' },
        h('thead', {}, h('tr', {}, h('th', {}, 'λ'), h('th', {}, 'alg.'), h('th', {}, 'geom.'), h('th', {}, 'Eigenraum'))));
      const tb = h('tbody');
      E.real.forEach((s, i) => {
        const lc = h('td'); renderTex(lc, texNum(s.lambda, fmt));
        const bc = h('td'); renderTex(bc, s.basis.length ? `\\operatorname{span}\\left\\{${s.basis.map((b) => texVec(b, fmt)).join(', ')}\\right\\}` : '—');
        tb.append(h('tr', {}, h('td', {}, h('span', { class: 'color-dot', style: { background: ECOL[i % 3] } }), lc), h('td', {}, String(s.alg)), h('td', {}, String(s.geo)), bc));
      });
      E.complex.forEach((z) => {
        const lc = h('td'); renderTex(lc, `${texNum(z.re, { mode: 'dec', decimals: 3 })} ${z.im < 0 ? '-' : '+'} ${fmtNum(Math.abs(z.im), { mode: 'dec', decimals: 3 })}\\,i`);
        tb.append(h('tr', {}, lc, h('td', {}, '1'), h('td', {}, '–'), h('td', { class: 'muted' }, 'komplex (keine reelle Richtung)')));
      });
      tbl.append(tb);
      info.append(tbl);

      // Diagonalisierbarkeit
      const geoSum = E.real.reduce((s, e) => s + e.geo, 0);
      if (E.diagonalizable) {
        info.append(h('div', { class: 'row' }, h('span', { class: 'badge ok' }, 'diagonalisierbar über ℝ')));
        const P = fromColumns(E.real.flatMap((s) => s.basis));
        const D = identity().map((r, i) => r.map((_, j) => (i === j ? E!.real.flatMap((s) => s.basis.map(() => s.lambda))[i] : 0)));
        tx(`M = P D P^{-1}, \\quad P = ${texMat(P, fmt)}, \\quad D = ${texMat(D, fmt)}`);
      } else {
        const reason = E.complex.length
          ? 'Das charakteristische Polynom zerfällt nicht in reelle Linearfaktoren (komplexe Eigenwerte).'
          : `Die geometrischen Vielfachheiten ergeben nur ${geoSum} < 3 (geom. < alg. Vielfachheit).`;
        info.append(h('div', { class: 'row' }, h('span', { class: 'badge err' }, 'nicht diagonalisierbar über ℝ')), h('p', { class: 'hint' }, reason));
      }

      // Eigenräume zeichnen
      E.real.forEach((s, i) => {
        const c = ECOL[i % 3];
        if (s.geo === 1) stat.add(makeLine([0, 0, 0], s.basis[0], c, 16, 0.022, 0.75));
        else if (s.geo === 2) stat.add(makePlane(cross(s.basis[0], s.basis[1]), [0, 0, 0], c, 8, 0.18));
        else if (s.geo === 3) stat.add(makeSpaceBox(c, 6, 0.04));
      });
      animateVecs();
    }

    function animateVecs() {
      clearGroup(dyn);
      const M = readMatrix(store);
      if (!M || !E) return;
      const Mt = lerpMat(identity(), M, tc.t());
      lattice.object.visible = S().lattice;
      lattice.update(Mt);
      E.real.forEach((s, i) => {
        s.basis.forEach((b, j) => {
          const u = normalize(b);
          if (!u) return;
          const v = scale(u, 2);
          const img = matVec(Mt, v);
          dyn.add(new Arrow([0, 0, 0], img, ECOL[i % 3], { radius: 0.05, label: j === 0 ? `λ=${fmtNum(s.lambda, ctx.fmt())}` : undefined }));
          dyn.add(makeDashed([0, 0, 0], v, ECOL[i % 3], 0.08));
        });
      });
      if (S().contrast) {
        const w = nonEigenVector(M);
        if (w) {
          const ws = scale(w, 1.8) as Vec3;
          dyn.add(makeDashed([0, 0, 0], ws, COLORS.gray));
          dyn.add(new Arrow([0, 0, 0], matVec(Mt, ws), PALETTE[7], { radius: 0.035, label: 'Mw', opacity: 0.8 }));
        }
      }
    }

    store.on('matrix', rebuild);
    ctx.onSettings(rebuild);
    rebuild();
    return { panel, group, activate: rebuild };
  },
};
