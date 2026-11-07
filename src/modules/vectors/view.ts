/**
 * Modul 1 – Vektoren: Eingabe beliebig vieler Vektoren, Operationen
 * (Summe, Skalarmultiplikation, Skalarprodukt mit Projektion und Winkel,
 * Kreuzprodukt, Länge) jeweils mit aufklappbarem Rechenweg, Verschieben der
 * Vektorspitzen per Maus und optionale Ebenen (per "+ Ebene").
 */
import * as THREE from 'three';
import type { AppContext, ModuleDef } from '../../core/module';
import { h, card, row, vecEditor, exprInput, toggle, select, button, note, renderTex } from '../../core/ui';
import {
  Arrow, clearGroup, makeDashed, makeAngleArc, makeSegment, makePoint, makePlane, makeLabel, PALETTE, COLORS, toV3,
} from '../../core/objects';
import { parseVec, parseExpr, allFinite } from '../../math/parse';
import { texVec, texNum, texSqrt, texPlane, toExprString } from '../../math/format';
import { dot, type Vec3 } from '../../math/linalg';
import { vectorOps, snapVec, planeFromSpan, planeFromCoords, planeCenter, type PlaneEq } from './math';
import { lengthSteps, sumSteps, scaledSteps, dotSteps, angleSteps, projSteps, crossSteps, planeSpanSteps } from './steps';

interface VecItem {
  id: number;
  name: string;
  v: string[];
  color: string;
  visible: boolean;
}

interface PlaneItem {
  id: number;
  name: string;
  /** 'span': Stützvektor + zwei Richtungsvektoren, 'coord': a·x + b·y + c·z = d */
  mode: 'span' | 'coord';
  /** Vektor-IDs (p = 0 bedeutet Ursprung) */
  p: number;
  u: number;
  v: number;
  coef: string[];
  color: string;
  visible: boolean;
}

interface VState {
  items: VecItem[];
  planes: PlaneItem[];
  a: number;
  b: number;
  k: string;
  showSum: boolean;
  showScaled: boolean;
  showDot: boolean;
  showCross: boolean;
  drag: boolean;
}

const DEFAULT: VState = {
  items: [
    { id: 1, name: 'a', v: ['2', '1', '0'], color: PALETTE[0], visible: true },
    { id: 2, name: 'b', v: ['1', '2', '2'], color: PALETTE[1], visible: true },
  ],
  planes: [],
  a: 1,
  b: 2,
  k: '1.5',
  showSum: true,
  showScaled: false,
  showDot: false,
  showCross: false,
  drag: false,
};

const NAMES = 'abcdefghuvw';
const PLANE_COLORS = ['#818cf8', '#34d399', '#f472b6', '#fbbf24', '#22d3ee'];

export const vectorsModule: ModuleDef = {
  id: 'vectors',
  title: 'Vektoren',
  short: 'Vektoren',
  icon: '↗',
  create(ctx: AppContext) {
    const { store, viewport } = ctx;
    const S = () => store.get<VState>('vectors', DEFAULT);
    const save = () => store.set('vectors', S());
    const group = new THREE.Group();
    const handles: THREE.Mesh[] = [];
    const editors = new Map<number, ReturnType<typeof vecEditor>>();
    const planeInfos = new Map<number, HTMLElement>();
    /** welche Rechenwege aufgeklappt sind (bleibt bei Live-Updates offen) */
    const openCalcs = new Set<string>();

    const vecOf = (it: VecItem | undefined): Vec3 | null => {
      if (!it) return null;
      const v = parseVec(it.v);
      return allFinite(v) ? (v as Vec3) : null;
    };
    const byId = (id: number) => S().items.find((i) => i.id === id);

    /** Fehlerbehebung: Auswahl A/B auf existierende Vektoren korrigieren (z. B. nach dem Löschen). */
    function fixSelection() {
      const st = S();
      const ids = st.items.map((i) => i.id);
      if (!ids.includes(st.a)) st.a = ids[0] ?? 0;
      if (!ids.includes(st.b)) st.b = ids.find((i) => i !== st.a) ?? ids[0] ?? 0;
    }

    // ---------------- Panel ----------------
    const list = h('div', { class: 'vec-list' });
    const opsSel = h('div', { class: 'row' });
    const opsToggles = h('div');
    const results = h('div', { class: 'results' });
    const err = note('error');
    const planeList = h('div');

    function renderList() {
      list.replaceChildren();
      editors.clear();
      for (const it of S().items) {
        const ed = vecEditor(it.v, (v) => { it.v = v; save(); redraw(); });
        editors.set(it.id, ed);
        const color = h('input', { type: 'color', value: it.color, title: 'Farbe' }) as HTMLInputElement;
        color.addEventListener('input', () => { it.color = color.value; nameEl.style.color = it.color; save(); redraw(); });
        const vis = h('input', { type: 'checkbox', checked: it.visible, title: 'anzeigen' }) as HTMLInputElement;
        const nameEl = h('span', { class: 'name', style: { color: it.color } }, it.name);
        const item = h('div', { class: `vec-item${it.visible ? '' : ' off'}` },
          nameEl, ed.el, color,
          h('label', { class: 'switch', title: 'an/aus' }, vis, h('span', { class: 'switch-track' })),
          button('✕', () => {
            const st = S();
            st.items = st.items.filter((x) => x.id !== it.id);
            save(); renderAll();
          }, 'small icon danger'),
        );
        vis.addEventListener('change', () => { it.visible = vis.checked; item.classList.toggle('off', !it.visible); save(); redraw(); });
        list.append(item);
      }
    }

    /** Auswahl A/B + Schalter, deren Beschriftung die gewählten Namen zeigt (z. B. "a + c"). */
    function renderOps() {
      fixSelection();
      const st = S();
      const opts = st.items.map((it) => ({ value: String(it.id), label: it.name }));
      opsSel.replaceChildren();
      opsToggles.replaceChildren();
      if (!opts.length) return;
      const onSel = (key: 'a' | 'b') => (v: string) => { S()[key] = Number(v); save(); renderOps(); redraw(); };
      opsSel.append(
        h('span', { class: 'muted' }, 'Vektor A'), select(opts, String(st.a), onSel('a')),
        h('span', { class: 'muted' }, 'Vektor B'), select(opts, String(st.b), onSel('b')),
        h('span', { class: 'muted' }, 'k ='), kInput,
      );
      const an = byId(st.a)?.name ?? 'A';
      const bn = byId(st.b)?.name ?? 'B';
      const tg = (label: string, key: 'showSum' | 'showScaled' | 'showDot' | 'showCross') =>
        toggle(label, st[key], (v) => { S()[key] = v; save(); redraw(); });
      opsToggles.append(
        h('div', { class: 'row' }, tg(`${an} + ${bn}`, 'showSum'), tg(`k · ${an}`, 'showScaled')),
        h('div', { class: 'row' }, tg(`${an} · ${bn} (Skalarprodukt, Winkel, Projektion)`, 'showDot')),
        h('div', { class: 'row' }, tg(`${an} × ${bn} (Kreuzprodukt)`, 'showCross')),
      );
    }

    // ---- Ebenen ----
    function renderPlanes() {
      planeList.replaceChildren();
      planeInfos.clear();
      const st = S();
      const vecOpts = st.items.map((it) => ({ value: String(it.id), label: it.name }));
      const supportOpts = [{ value: '0', label: 'Ursprung 0' }, ...vecOpts];
      for (const pl of st.planes) {
        const body = h('div', { class: 'plane-body' });
        if (pl.mode === 'span') {
          const sel = (key: 'p' | 'u' | 'v', options: { value: string; label: string }[]) =>
            select(options, String(pl[key]), (v) => { pl[key] = Number(v); save(); redraw(); });
          body.append(
            h('span', { class: 'muted' }, 'Stützvektor'), sel('p', supportOpts),
            h('span', { class: 'muted' }, 'Richtungen'), sel('u', vecOpts), sel('v', vecOpts),
          );
        } else {
          const inp = (i: number) => exprInput(pl.coef[i], (v) => { pl.coef[i] = v; save(); redraw(); });
          body.append(inp(0), h('span', {}, 'x +'), inp(1), h('span', {}, 'y +'), inp(2), h('span', {}, 'z ='), inp(3));
        }
        const color = h('input', { type: 'color', value: pl.color, title: 'Farbe' }) as HTMLInputElement;
        color.addEventListener('input', () => { pl.color = color.value; save(); redraw(); });
        const vis = h('input', { type: 'checkbox', checked: pl.visible }) as HTMLInputElement;
        vis.addEventListener('change', () => { pl.visible = vis.checked; save(); redraw(); });
        const info = h('div', { class: 'plane-info' });
        planeInfos.set(pl.id, info);
        planeList.append(h('div', { class: 'vec-item plane-item' },
          h('span', { class: 'name', style: { color: pl.color } }, pl.name),
          select([{ value: 'span', label: 'Stütz- + Richtungsvektoren' }, { value: 'coord', label: 'Koordinatenform' }], pl.mode,
            (v) => { pl.mode = v; save(); renderPlanes(); redraw(); }),
          color,
          h('label', { class: 'switch', title: 'an/aus' }, vis, h('span', { class: 'switch-track' })),
          button('✕', () => { S().planes = S().planes.filter((x) => x.id !== pl.id); save(); renderPlanes(); redraw(); }, 'small icon danger'),
          body, info,
        ));
      }
    }

    const addPlaneBtn = button('+ Ebene', () => {
      const st = S();
      const id = Math.max(0, ...st.planes.map((p) => p.id)) + 1;
      const ids = st.items.map((i) => i.id);
      st.planes.push({
        id, name: `E${id}`, mode: ids.length >= 2 ? 'span' : 'coord',
        p: 0, u: ids[0] ?? 0, v: ids[1] ?? ids[0] ?? 0,
        coef: ['0', '0', '1', '1'], color: PLANE_COLORS[(id - 1) % PLANE_COLORS.length], visible: true,
      });
      save(); renderPlanes(); redraw();
    }, 'primary small');

    const addBtn = button('+ Vektor', () => {
      const st = S();
      const used = new Set(st.items.map((i) => i.name));
      const name = [...NAMES].find((n) => !used.has(n)) ?? `v${st.items.length + 1}`;
      const id = Math.max(0, ...st.items.map((i) => i.id)) + 1;
      const r = () => String(Math.round(Math.random() * 6 - 3));
      st.items.push({ id, name, v: [r(), r(), r()], color: PALETTE[(id - 1) % PALETTE.length], visible: true });
      save(); renderAll();
    }, 'primary small');

    const kInput = exprInput(S().k, (v) => { S().k = v; save(); redraw(); });

    const panel = h('div', {},
      card('Vektoren', list, row(addBtn, h('span', { class: 'hint' }, 'Zahlen per Maus ziehen ↔ oder tippen (1/2, sqrt(2), 0,5 …).'))),
      card('Operationen', opsSel, opsToggles, err, results),
      card('Ebenen', planeList, row(addPlaneBtn, h('span', { class: 'hint' }, 'Ebenen erscheinen nur, wenn du sie hier hinzufügst.'))),
      card('Interaktion',
        toggle('Vektorspitzen per Maus verschieben', S().drag, (v) => { S().drag = v; save(); redraw(); }),
        h('p', { class: 'hint' }, 'Ziehe die leuchtenden Punkte an den Spitzen. Bewegung erfolgt parallel zur Bildschirmebene, Raster 0.1.'),
      ),
    );

    function renderAll() {
      renderList();
      renderOps();
      renderPlanes();
      redraw();
    }

    /** Ergebniszeile + aufklappbarer Rechenweg */
    function resultBlock(key: string, summary: string, steps: string | null, extra?: Node) {
      const res = h('div', { class: 'res-line' });
      renderTex(res, summary, true);
      results.append(res);
      if (extra) results.append(extra);
      if (!steps) return;
      const body = h('div');
      renderTex(body, steps, true);
      const det = h('details', { class: 'calc', open: openCalcs.has(key) }, h('summary', {}, 'Rechenweg anzeigen'), body);
      det.addEventListener('toggle', () => (det.open ? openCalcs.add(key) : openCalcs.delete(key)));
      results.append(det);
    }

    // ---------------- 3D ----------------
    function redraw() {
      clearGroup(group);
      handles.length = 0;
      fixSelection();
      const st = S();
      const fmt = ctx.fmt();
      for (const it of st.items) {
        const v = vecOf(it);
        if (!v || !it.visible) continue;
        group.add(new Arrow([0, 0, 0], v, it.color, { label: it.name, radius: 0.04 }));
        if (st.drag) {
          const hnd = makePoint(v, it.color, 0.13);
          (hnd.material as THREE.MeshStandardMaterial).emissiveIntensity = 2;
          hnd.userData.itemId = it.id;
          handles.push(hnd);
          group.add(hnd);
        }
      }

      drawPlanes();

      const A = byId(st.a);
      const B = byId(st.b);
      results.replaceChildren();
      err.textContent = '';
      if (!A || !B) { results.append(h('p', { class: 'hint' }, 'Mindestens einen Vektor anlegen.')); return; }
      const a = vecOf(A), b = vecOf(B), k = parseExpr(st.k);
      if (!a || !b || !isFinite(k)) { err.textContent = 'Ungültige Eingabe – bitte Zahlen prüfen.'; return; }
      const r = vectorOps(a, b, k);
      const an = A.name, bn = B.name;

      if (st.showSum) {
        group.add(new Arrow([0, 0, 0], r.sum, COLORS.amber, { label: `${an}+${bn}`, radius: 0.04 }));
        group.add(makeDashed(a, r.sum, B.color));
        group.add(makeDashed(b, r.sum, A.color));
      }
      if (st.showScaled) group.add(new Arrow([0, 0, 0], r.scaled, COLORS.lime, { label: `${+k.toFixed(2)}·${an}`, radius: 0.03, opacity: 0.85 }));
      if (st.showDot) {
        group.add(new Arrow([0, 0, 0], r.proj, COLORS.orange, { label: 'proj', radius: 0.05 }));
        group.add(makeDashed(a, r.proj, COLORS.orange));
        group.add(makeAngleArc(a, b, COLORS.white, 0.7));
      }
      if (st.showCross) {
        group.add(new Arrow([0, 0, 0], r.cross, COLORS.accent, { label: `${an}×${bn}`, radius: 0.045 }));
        const geo = new THREE.BufferGeometry().setFromPoints([toV3([0, 0, 0]), toV3(a), toV3(r.sum), toV3([0, 0, 0]), toV3(r.sum), toV3(b)]);
        group.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: COLORS.accent, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })));
        group.add(makeSegment(a, r.sum, COLORS.accent, 0.01, 0.6), makeSegment(b, r.sum, COLORS.accent, 0.01, 0.6));
      }

      // ---- Formeln mit Rechenweg ----
      resultBlock(`len-${an}`, `|${an}| = ${texSqrt(dot(a, a), fmt)}`, lengthSteps(an, a, fmt));
      if (B.id !== A.id) resultBlock(`len-${bn}`, `|${bn}| = ${texSqrt(dot(b, b), fmt)}`, lengthSteps(bn, b, fmt));
      if (st.showSum) resultBlock('sum', `${an} + ${bn} = ${texVec(r.sum, fmt)}`, sumSteps(an, bn, a, b, fmt));
      if (st.showScaled) resultBlock('scaled', `${texNum(k, fmt)} \\cdot ${an} = ${texVec(r.scaled, fmt)}`, scaledSteps(k, an, a, fmt));
      if (st.showDot) {
        resultBlock('dot', `${an} \\cdot ${bn} = ${texNum(r.dot, fmt)}`, dotSteps(an, bn, a, b, fmt),
          r.orthogonal ? h('span', { class: 'badge ok' }, `${an} ⟂ ${bn} (orthogonal)`) : undefined);
        if (r.angleDeg !== null) {
          resultBlock('angle', `\\varphi = \\angle(${an}, ${bn}) \\approx ${r.angleDeg.toFixed(2)}^\\circ`, angleSteps(an, bn, a, b, fmt));
          resultBlock('proj', `\\operatorname{proj}_{${bn}}(${an}) = ${texVec(r.proj, fmt)}`, projSteps(an, bn, a, b, fmt));
        } else results.append(h('p', { class: 'hint' }, 'Winkel und Projektion sind für den Nullvektor nicht definiert.'));
      }
      if (st.showCross) {
        resultBlock('cross', `${an} \\times ${bn} = ${texVec(r.cross, fmt)}, \\quad |${an}\\times ${bn}| = ${texSqrt(dot(r.cross, r.cross), fmt)}`,
          crossSteps(an, bn, a, b, fmt),
          h('p', { class: 'hint' }, `|${an}×${bn}| ist der Flächeninhalt des violetten Parallelogramms. ${an}×${bn} steht senkrecht auf beiden (Rechte-Hand-Regel).`));
        if (r.parallel) results.append(h('span', { class: 'badge warn' }, 'parallel – Kreuzprodukt ist 0'));
      }
    }

    /** Ebenen zeichnen und deren Gleichungen (mit Rechenweg) im Panel aktualisieren. */
    function drawPlanes() {
      const fmt = ctx.fmt();
      for (const pl of S().planes) {
        const info = planeInfos.get(pl.id);
        info?.replaceChildren();
        let eq: PlaneEq | null = null;
        let steps: string | null = null;
        let error = '';
        if (pl.mode === 'span') {
          const P: Vec3 | null = pl.p === 0 ? [0, 0, 0] : vecOf(byId(pl.p));
          const U = vecOf(byId(pl.u)), V = vecOf(byId(pl.v));
          if (!byId(pl.u) || !byId(pl.v) || (pl.p !== 0 && !byId(pl.p))) error = 'Gewählter Vektor existiert nicht mehr.';
          else if (!P || !U || !V) error = 'Ungültige Vektoreinträge.';
          else {
            eq = planeFromSpan(P, U, V);
            if (!eq) error = 'Die Richtungsvektoren sind parallel – sie spannen keine Ebene auf.';
            else steps = planeSpanSteps(pl.p === 0 ? '\\vec{0}' : byId(pl.p)!.name, byId(pl.u)!.name, byId(pl.v)!.name, P, U, V, fmt);
          }
        } else {
          const c = pl.coef.map((s) => parseExpr(s));
          if (!c.every(isFinite)) error = 'Ungültige Eingabe.';
          else {
            eq = planeFromCoords(c[0], c[1], c[2], c[3]);
            if (!eq) error = 'Mindestens ein Koeffizient vor x, y oder z muss ≠ 0 sein.';
          }
        }
        if (!info) continue;
        if (error || !eq) { info.append(note('warn', error)); continue; }
        const t = h('div');
        renderTex(t, `${pl.name}:\\; ${texPlane(eq.n, eq.d, fmt)}`, true);
        info.append(t);
        if (steps) {
          const key = `plane-${pl.id}`;
          const body = h('div');
          renderTex(body, steps, true);
          const det = h('details', { class: 'calc', open: openCalcs.has(key) }, h('summary', {}, 'Rechenweg anzeigen'), body);
          det.addEventListener('toggle', () => (det.open ? openCalcs.add(key) : openCalcs.delete(key)));
          info.append(det);
        }
        if (pl.visible) {
          const center = planeCenter(eq);
          group.add(makePlane(eq.n, center, pl.color, 8, 0.2));
          const lbl = makeLabel(pl.name, pl.color, 0.34);
          lbl.position.copy(toV3(center)).add(new THREE.Vector3(0, 0, 0.3));
          group.add(lbl);
        }
      }
    }

    // ---------------- Drag & Drop der Spitzen ----------------
    const canvas = viewport.renderer.domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let dragging: { id: number; plane: THREE.Plane } | null = null;
    let activeModule = false;

    const pick = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, viewport.camera);
    };
    canvas.addEventListener('pointerdown', (e) => {
      if (!activeModule || !S().drag || !handles.length) return;
      pick(e);
      const hit = ray.intersectObjects(handles, false)[0];
      if (!hit) return;
      const normal = viewport.camera.getWorldDirection(new THREE.Vector3());
      dragging = { id: hit.object.userData.itemId, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(normal, hit.object.position) };
      viewport.controls.enabled = false;
      canvas.setPointerCapture(e.pointerId);
      e.stopImmediatePropagation();
    }, { capture: true });
    canvas.addEventListener('pointermove', (e) => {
      if (!activeModule || !S().drag) return;
      pick(e);
      if (!dragging) {
        canvas.style.cursor = ray.intersectObjects(handles, false).length ? 'grab' : '';
        return;
      }
      canvas.style.cursor = 'grabbing';
      const p = new THREE.Vector3();
      if (!ray.ray.intersectPlane(dragging.plane, p)) return;
      const it = byId(dragging.id);
      if (!it) return;
      const v = snapVec([p.x, p.y, p.z]).map((x) => Math.max(-20, Math.min(20, x)));
      it.v = v.map(toExprString);
      editors.get(it.id)?.set(it.v);
      redraw();
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = null;
      viewport.controls.enabled = true;
      canvas.style.cursor = '';
      save();
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    renderAll();
    ctx.onSettings(redraw);

    return {
      panel,
      group,
      activate: () => { activeModule = true; redraw(); },
      deactivate: () => { activeModule = false; endDrag(); canvas.style.cursor = ''; },
    };
  },
};
