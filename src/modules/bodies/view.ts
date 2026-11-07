/**
 * Modul 3 – Körper: Würfel, Kugel, Tetraeder, Zylinder oder eigene Punktwolke
 * werden von der Matrix M verformt; das Original bleibt als Geisterbild sichtbar.
 */
import * as THREE from 'three';
import type { AppContext, ModuleDef } from '../../core/module';
import { h, card, row, toggle, select, button, note, renderTex } from '../../core/ui';
import { clearGroup, toMatrix4, toV3 } from '../../core/objects';
import { sharedMatrixEditor, transformControls, readMatrix } from '../../core/components';
import { det3, lerpMat, identity } from '../../math/linalg';
import { texNum, fmtNum } from '../../math/format';
import { BODY_NAMES, bodyVolume, parsePointCloud, samplePointCloud, type BodyType } from './math';

interface BState {
  type: BodyType;
  ghost: boolean;
  points: string;
}
const DEFAULT: BState = { type: 'cube', ghost: true, points: samplePointCloud(48) };

function buildGeometry(t: BodyType): THREE.BufferGeometry {
  switch (t) {
    case 'sphere': return new THREE.SphereGeometry(1, 48, 32);
    case 'cylinder': return new THREE.CylinderGeometry(1, 1, 2, 48, 1).rotateX(Math.PI / 2);
    case 'tetra': {
      const O = [0, 0, 0], A = [1, 0, 0], B = [0, 1, 0], C = [0, 0, 1];
      const faces = [O, B, A, O, A, C, O, C, B, A, B, C].flat();
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(faces, 3));
      g.computeVertexNormals();
      return g;
    }
    default: return new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0.5, 0.5);
  }
}

export const bodiesModule: ModuleDef = {
  id: 'bodies',
  title: 'Körper verformen',
  short: 'Körper',
  icon: '◆',
  create(ctx: AppContext) {
    const { store } = ctx;
    const S = () => store.get<BState>('bodies', DEFAULT);
    const save = () => store.set('bodies', S());
    const group = new THREE.Group();
    const transformed = new THREE.Group();
    const original = new THREE.Group();
    transformed.matrixAutoUpdate = false;
    group.add(original, transformed);

    const { el: mEditor } = sharedMatrixEditor(store);
    const tc = transformControls(() => applyT(), 1);
    const err = note('error');
    const info = h('div');
    const pointsArea = h('textarea', { spellcheck: false }) as HTMLTextAreaElement;
    pointsArea.value = S().points;
    const pointsErr = note('warn');
    const pointsCard = h('div', {}, h('p', { class: 'hint' }, 'Ein Punkt pro Zeile, z. B. "1, 2, 3" oder "(1; 0; 1/2)".'), pointsArea, pointsErr,
      row(button('Beispiel: Spirale', () => { pointsArea.value = samplePointCloud(48); S().points = pointsArea.value; save(); rebuild(); }, 'small'),
        button('Zufällige Wolke', () => {
          const r = () => (Math.random() * 2 - 1).toFixed(2);
          pointsArea.value = Array.from({ length: 80 }, () => `${r()}, ${r()}, ${r()}`).join('\n');
          S().points = pointsArea.value; save(); rebuild();
        }, 'small')));
    pointsArea.addEventListener('input', () => { S().points = pointsArea.value; save(); rebuild(); });

    const typeSel = select<BodyType>(
      (Object.keys(BODY_NAMES) as BodyType[]).map((k) => ({ value: k, label: BODY_NAMES[k] })),
      S().type,
      (v) => { S().type = v; save(); rebuild(); },
    );

    const panel = h('div', {},
      card('Körper', row(typeSel), toggle('Original als Geisterbild', S().ghost, (v) => { S().ghost = v; save(); rebuild(); }), pointsCard),
      card('Matrix M', mEditor, err),
      card('Animation', tc.el),
      card('Volumen', info),
    );

    function rebuild() {
      clearGroup(original);
      clearGroup(transformed);
      const st = S();
      pointsCard.style.display = st.type === 'points' ? '' : 'none';
      if (st.type === 'points') {
        const { points, errors } = parsePointCloud(st.points);
        pointsErr.textContent = errors.length ? `Ungültige Zeile(n): ${errors.slice(0, 8).join(', ')}${errors.length > 8 ? ' …' : ''} – werden ignoriert.` : '';
        const geo = new THREE.BufferGeometry().setFromPoints(points.map(toV3));
        transformed.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: '#22d3ee', size: 0.12, sizeAttenuation: true })));
        if (st.ghost) original.add(new THREE.Points(geo.clone(), new THREE.PointsMaterial({ color: '#94a3b8', size: 0.07, transparent: true, opacity: 0.5 })));
      } else {
        const geo = buildGeometry(st.type);
        const mat = new THREE.MeshStandardMaterial({
          color: '#22d3ee', emissive: '#0e7490', emissiveIntensity: 0.4, roughness: 0.35, metalness: 0.1,
          transparent: true, opacity: 0.82, side: THREE.DoubleSide,
        });
        transformed.add(new THREE.Mesh(geo, mat));
        const edges = new THREE.EdgesGeometry(geo, 25);
        transformed.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: '#cffafe' })));
        if (st.type === 'sphere') {
          // Breiten- und Längenkreise machen die Verformung sichtbar
          transformed.add(new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(1.001, 12, 8)), new THREE.LineBasicMaterial({ color: '#a5f3fc', transparent: true, opacity: 0.35 })));
        }
        if (st.ghost) {
          original.add(new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({ color: '#94a3b8', transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide })));
          original.add(new THREE.LineSegments(edges.clone(), new THREE.LineDashedMaterial({ color: '#94a3b8', dashSize: 0.1, gapSize: 0.07, transparent: true, opacity: 0.7 })).computeLineDistances());
          if (st.type === 'sphere') original.add(new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(1, 12, 8)), new THREE.LineBasicMaterial({ color: '#94a3b8', transparent: true, opacity: 0.18 })));
        }
      }
      applyT();
    }

    function applyT() {
      const M = readMatrix(store);
      if (!M) { err.textContent = 'Ungültige Matrix-Einträge.'; return; }
      err.textContent = '';
      const Mt = lerpMat(identity(), M, tc.t());
      transformed.matrix.copy(toMatrix4(Mt));
      transformed.matrixWorldNeedsUpdate = true;

      const fmt = ctx.fmt();
      const V = bodyVolume(S().type);
      const d = det3(M);
      const dt = det3(Mt);
      info.replaceChildren();
      const add = (latex: string) => { const e = h('div'); renderTex(e, latex, true); info.append(e); };
      add(`\\det M = ${texNum(d, fmt)}`);
      if (V !== null) {
        add(`V_{\\text{neu}} = |\\det M| \\cdot V_{\\text{alt}} = ${texNum(Math.abs(d), fmt)} \\cdot ${fmtNum(V, { mode: 'dec', decimals: 3 })} = ${fmtNum(Math.abs(d) * V, { mode: 'dec', decimals: 3 })}`);
        info.append(h('div', { class: 'row' }, h('span', { class: 'muted' }, `aktuell (t = ${tc.t().toFixed(2)}): V = ${fmtNum(Math.abs(dt) * V, { mode: 'dec', decimals: 3 })}`),
          h('span', { class: `badge ${dt > 1e-9 ? 'ok' : dt < -1e-9 ? 'err' : 'warn'}` }, dt > 1e-9 ? 'Orientierung erhalten' : dt < -1e-9 ? 'Orientierung gekippt' : 'plattgedrückt')));
      } else {
        info.append(h('p', { class: 'hint' }, 'Bei Punktwolken wird jeder Punkt p auf M·p abgebildet.'));
      }
    }

    store.on('matrix', applyT);
    ctx.onSettings(applyT);
    rebuild();
    return { panel, group, activate: applyT };
  },
};
