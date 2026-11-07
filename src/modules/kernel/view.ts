/**
 * Modul 7 – Kern und Bild: Nullraum und Spaltenraum der Matrix M als
 * Punkt/Gerade/Ebene/Raum mit Dimensionen (Rangsatz).
 */
import * as THREE from 'three';
import type { AppContext, ModuleDef } from '../../core/module';
import { h, card, toggle, button, note, renderTex } from '../../core/ui';
import { Arrow, clearGroup, makeLine, makePlane, makeSpaceBox, makePoint, COLORS } from '../../core/objects';
import { sharedMatrixEditor, transformControls, readMatrix } from '../../core/components';
import { Lattice } from '../../core/transformVisuals';
import { lerpMat, identity, matVec, normalize, scale, columns, type Vec3 } from '../../math/linalg';
import { texVec, texPlane } from '../../math/format';
import { kernelImage, EXAMPLES, type Subspace } from './math';

interface KState { lattice: boolean }
const DEFAULT: KState = { lattice: true };
const KER = COLORS.orange;
const IMG = COLORS.cyan;

export const kernelModule: ModuleDef = {
  id: 'kernel',
  title: 'Kern und Bild',
  short: 'Kern/Bild',
  icon: '⊥',
  create(ctx: AppContext) {
    const { store } = ctx;
    const S = () => store.get<KState>('kernel', DEFAULT);
    const group = new THREE.Group();
    const lattice = new Lattice(2, 3);
    const stat = new THREE.Group();
    const dyn = new THREE.Group();
    group.add(lattice.object, stat, dyn);

    const { el: mEditor } = sharedMatrixEditor(store);
    const tc = transformControls(() => animate(), 0);
    const err = note('error');
    const info = h('div');
    const panel = h('div', {},
      card('Matrix M', mEditor,
        h('div', { class: 'row' }, h('span', { class: 'muted' }, 'Beispiele:'), ...EXAMPLES.map((e) => button(e.name, () => store.set('matrix', e.m.map((r) => r.slice())), 'small'))),
        err),
      card('Kern & Bild', info),
      card('Animation E → M', tc.el,
        h('p', { class: 'hint' }, 'Der ganze Raum wird auf das Bild (cyan) gedrückt. Vektoren im Kern (orange) schrumpfen auf den Nullvektor.'),
        toggle('Gitter mitverformen', S().lattice, (v) => { S().lattice = v; store.set('kernel', S()); animate(); })),
    );

    let ker: Subspace | null = null;

    const drawSub = (s: Subspace, color: string) => {
      if (s.kind === 'point') stat.add(makePoint([0, 0, 0], color, 0.13));
      if (s.kind === 'line') stat.add(makeLine([0, 0, 0], s.basis[0], color, 16, 0.035, 0.9));
      if (s.kind === 'plane') stat.add(makePlane(s.normal!, [0, 0, 0], color, 9, 0.22));
      if (s.kind === 'space') stat.add(makeSpaceBox(color, 7, 0.05));
    };

    function rebuild() {
      clearGroup(stat);
      info.replaceChildren();
      const M = readMatrix(store);
      if (!M) { err.textContent = 'Ungültige Matrix-Einträge.'; ker = null; return; }
      err.textContent = '';
      const fmt = ctx.fmt();
      const r = kernelImage(M);
      ker = r.kernel;
      drawSub(r.image, IMG);
      drawSub(r.kernel, KER);

      const tx = (latex: string) => { const e = h('div'); renderTex(e, latex, true); info.append(e); };
      const desc = (s: Subspace) =>
        s.kind === 'point' ? '\\{0\\}' : s.kind === 'space' ? '\\mathbb{R}^3' : `\\operatorname{span}\\left\\{${s.basis.map((b) => texVec(b, fmt)).join(', ')}\\right\\}`;
      const kindDe = { point: 'Punkt {0}', line: 'Gerade', plane: 'Ebene', space: 'ganzer Raum' };
      info.append(h('div', { class: 'row' },
        h('span', { class: 'badge', style: { color: KER, borderColor: KER } }, `Kern: ${kindDe[r.kernel.kind]}, dim ${r.kernel.dim}`),
        h('span', { class: 'badge', style: { color: IMG, borderColor: IMG } }, `Bild: ${kindDe[r.image.kind]}, dim ${r.image.dim}`)));
      tx(`\\ker M = \\{x \\mid Mx = 0\\} = ${desc(r.kernel)}`);
      if (r.kernel.kind === 'plane') tx(`\\ker M:\\; ${texPlane(r.kernel.normal!, 0, fmt)}`);
      tx(`\\operatorname{im} M = \\operatorname{span}(\\text{Spalten}) = ${desc(r.image)}`);
      if (r.image.kind === 'plane') tx(`\\operatorname{im} M:\\; ${texPlane(r.image.normal!, 0, fmt)}`);
      tx(`\\underbrace{\\dim \\ker M}_{${r.kernel.dim}} + \\underbrace{\\dim \\operatorname{im} M}_{${r.image.dim}\\,=\\,\\operatorname{Rang}} = ${r.kernel.dim + r.image.dim} = \\dim \\mathbb{R}^3`);
      info.append(h('p', { class: 'hint' }, 'Rangsatz (Dimensionsformel): Was im Kern "verloren geht", fehlt dem Bild an Dimension.'));
      animate();
    }

    function animate() {
      clearGroup(dyn);
      const M = readMatrix(store);
      if (!M) return;
      const Mt = lerpMat(identity(), M, tc.t());
      lattice.object.visible = S().lattice;
      lattice.update(Mt);
      // Bilder der Basisvektoren = Spalten von M_t
      columns(Mt).forEach((c, i) => dyn.add(new Arrow([0, 0, 0], c, IMG, { radius: 0.03, label: `Me${'₁₂₃'[i]}`, opacity: 0.85 })));
      // Kernvektoren schrumpfen auf 0
      ker?.basis.forEach((b, i) => {
        const u = normalize(b);
        if (!u) return;
        dyn.add(new Arrow([0, 0, 0], matVec(Mt, scale(u, 2) as Vec3), KER, { radius: 0.045, label: i === 0 ? 'k' : undefined }));
      });
    }

    store.on('matrix', rebuild);
    ctx.onSettings(rebuild);
    rebuild();
    return { panel, group, activate: rebuild };
  },
};
