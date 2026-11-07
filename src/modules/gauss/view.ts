/**
 * Modul "Gauß-Trainer": das Gauß-Verfahren zum Verstehen.
 *  - Vorführen: Schritt für Schritt mit Begründung, Vorher/Nachher-Matrix,
 *    eintragweiser Rechnung und farbigen Markierungen (Pivot, neue Null).
 *  - Selbst rechnen: Zeilenoperationen selbst wählen, mit Tipp und Rückgängig.
 *  - 3D: Jede Gleichung ist eine Ebene. Bei "Vielfaches addieren" dreht sich die
 *    Ebene um die Schnittgerade mit der Hilfszeile – die Lösung bleibt gleich.
 *  - Am Ende: Rückwärtseinsetzen und Lösungsmenge.
 */
import * as THREE from 'three';
import type { AppContext, ModuleDef } from '../../core/module';
import { h, card, row, matEditor, select, button, note, renderTex, exprInput, animate, toast } from '../../core/ui';
import { clearGroup, makePlane, makeLine, makePoint, makeLabel, COLORS, toV3 } from '../../core/objects';
import { parseMat, parseExpr, allFinite } from '../../math/parse';
import { solveLgs, scale, dot, type Matrix, type RowOp, type Vec3 } from '../../math/linalg';
import { toExprString } from '../../math/format';
import {
  EXAMPLES, ROMAN, applyOp, applyPerm, forwardSteps, isEchelon, validateOp, suggestNext,
  texOp, explainOp, texRowCalc, texMatrixHL, texEquationRow, backSubstitute, texSolutionSet, type Highlight,
} from './math';

interface GState {
  source: string; // Beispiel-ID oder 'custom'
  custom: string[][];
  mode: 'demo' | 'manual';
  idx: number;
  manualOps: RowOp[];
}
const DEFAULT: GState = {
  source: 'standard',
  custom: EXAMPLES[0].m.map((r) => r.slice()),
  mode: 'demo',
  idx: 0,
  manualOps: [],
};
/** Farbe je ursprünglicher Gleichung (bleibt beim Tauschen an der Gleichung) */
const PCOL = [COLORS.pink, COLORS.cyan, COLORS.amber];

export const gaussModule: ModuleDef = {
  id: 'gauss',
  title: 'Gauß-Verfahren verstehen',
  short: 'Gauß',
  icon: '⇣',
  create(ctx: AppContext) {
    const { store } = ctx;
    const S = () => store.get<GState>('gauss', DEFAULT);
    const save = () => store.set('gauss', S());
    const group = new THREE.Group();

    // ---------------- Panel ----------------
    const exampleBtns = h('div', { class: 'row' });
    const exampleDesc = h('p', { class: 'hint' });
    const customEditor = matEditor(S().custom, (v) => { S().custom = v; S().idx = 0; S().manualOps = []; save(); update(true); }, { augmented: true });
    const customWrap = h('div', {}, customEditor.el);
    const modeBtns = h('div', { class: 'seg' });
    const err = note('error');
    const eqView = h('div');
    const controls = h('div');
    const stepView = h('div');
    const backView = h('div');

    const panel = h('div', {},
      card('1 · Beispiel wählen', exampleBtns, exampleDesc, customWrap, err),
      card('2 · Modus', modeBtns, h('p', { class: 'hint' }, 'Vorführen: die App rechnet und erklärt. Selbst rechnen: du wählst die Zeilenoperationen, die App prüft mit.')),
      card('Aktuelles Gleichungssystem', eqView),
      card('3 · Vorwärtselimination (Zeilenstufenform)', controls, stepView),
      card('4 · Rückwärtseinsetzen', backView),
      card('Spielregeln',
        h('p', { class: 'hint' }, 'Erlaubt sind nur drei Umformungen – sie ändern die Lösungsmenge nie:'),
        h('ol', { class: 'rules' },
          h('li', {}, 'Zwei Zeilen tauschen'),
          h('li', {}, 'Eine Zeile mit einer Zahl ≠ 0 multiplizieren'),
          h('li', {}, 'Ein Vielfaches einer Zeile zu einer anderen addieren')),
        h('p', { class: 'hint' }, 'Ziel: Unter jedem Pivot (gelb umrahmt) nur Nullen – die „Treppe“ der Zeilenstufenform. Danach liest man z ab und setzt von unten nach oben ein.')),
    );

    function renderExamples() {
      const st = S();
      exampleBtns.replaceChildren(
        ...EXAMPLES.map((e) => button(e.name, () => selectSource(e.id), `small${st.source === e.id ? ' active' : ''}`)),
        button('Eigenes System', () => selectSource('custom'), `small${st.source === 'custom' ? ' active' : ''}`),
        button('Aus Tab „LGS“ übernehmen', () => {
          const lgs = store.get<{ m: string[][] }>('lgs', { m: EXAMPLES[0].m });
          S().custom = lgs.m.map((r) => r.slice());
          customEditor.set(S().custom);
          selectSource('custom');
          toast('System aus dem LGS-Tab übernommen');
        }, 'small'),
      );
      exampleDesc.textContent = st.source === 'custom'
        ? 'Gib dein eigenes System ein (Zahlen kannst du auch mit der Maus ziehen).'
        : EXAMPLES.find((e) => e.id === st.source)?.description ?? '';
      customWrap.style.display = st.source === 'custom' ? '' : 'none';
      modeBtns.replaceChildren(
        button('▶ Vorführen', () => setMode('demo'), st.mode === 'demo' ? 'active' : ''),
        button('✎ Selbst rechnen', () => setMode('manual'), st.mode === 'manual' ? 'active' : ''),
      );
    }
    function selectSource(id: string) {
      Object.assign(S(), { source: id, idx: 0, manualOps: [] });
      save(); renderExamples(); renderControls(); update(true);
    }
    function setMode(m: GState['mode']) {
      S().mode = m;
      save(); renderExamples(); renderControls(); update(true);
    }

    // ---------------- Zustand berechnen ----------------
    function baseMatrix(): Matrix | null {
      const st = S();
      const src = st.source === 'custom' ? st.custom : EXAMPLES.find((e) => e.id === st.source)?.m ?? EXAMPLES[0].m;
      const M = parseMat(src);
      return allFinite(M) ? M : null;
    }
    interface History { ops: RowOp[]; mats: Matrix[]; perms: number[][]; pivots: ([number, number] | null)[]; cur: number }
    function history(M0: Matrix): History {
      const st = S();
      const demoSteps = st.mode === 'demo' ? forwardSteps(M0) : null;
      const ops = demoSteps ? demoSteps.map((s) => s.op) : st.manualOps;
      const mats = [M0];
      const perms = [[0, 1, 2]];
      ops.forEach((op) => { mats.push(applyOp(mats[mats.length - 1], op)); perms.push(applyPerm(perms[perms.length - 1], op)); });
      const pivots = ops.map((op, i) => {
        if (demoSteps) return demoSteps[i].pivot;
        if (op.type !== 'add') return null;
        const c = mats[i][op.source].slice(0, 3).findIndex((x) => Math.abs(x) > 1e-10);
        return c >= 0 ? ([op.source, c] as [number, number]) : null;
      });
      const cur = demoSteps ? Math.min(st.idx, ops.length) : ops.length;
      return { ops, mats, perms, pivots, cur };
    }

    // ---------------- Steuerung ----------------
    // Baukasten für "Selbst rechnen" (nicht persistiert)
    const draft: { type: RowOp['type']; target: number; source: number; factor: string; i: number; j: number; k: string } =
      { type: 'add', target: 1, source: 0, factor: '-2', i: 0, j: 1, k: '2' };
    const manualMsg = h('div');

    function renderControls() {
      controls.replaceChildren();
      manualMsg.replaceChildren();
      if (S().mode === 'demo') {
        let timer: number | undefined;
        const playBtn = button('▶▶ Abspielen', () => {
          if (timer) { clearInterval(timer); timer = undefined; playBtn.textContent = '▶▶ Abspielen'; return; }
          const M0 = baseMatrix(); if (!M0) return;
          if (S().idx >= history(M0).ops.length) go(0);
          playBtn.textContent = '⏸ Pause';
          timer = window.setInterval(() => {
            const M = baseMatrix();
            if (!M || S().idx >= history(M).ops.length) { clearInterval(timer); timer = undefined; playBtn.textContent = '▶▶ Abspielen'; return; }
            go(S().idx + 1);
          }, 2200);
        }, 'small');
        controls.append(row(
          button('⏮', () => go(0), 'small'),
          button('◀ Zurück', () => go(S().idx - 1)),
          button('Nächster Schritt ▶', () => go(S().idx + 1), 'primary'),
          button('⏭', () => go(Infinity), 'small'),
          playBtn,
        ));
        return;
      }
      // ---- Selbst rechnen ----
      const rowSel = (val: number, set: (v: number) => void) =>
        select(ROMAN.map((r, i) => ({ value: String(i), label: r })), String(val), (v) => set(Number(v)));
      const typeSel = select<RowOp['type']>([
        { value: 'add', label: 'Vielfaches addieren' },
        { value: 'swap', label: 'Zeilen tauschen' },
        { value: 'scale', label: 'Zeile multiplizieren' },
      ], draft.type, (v) => { draft.type = v; renderControls(); });
      const builder = h('div', { class: 'row op-builder' });
      if (draft.type === 'add') {
        builder.append(h('span', {}, 'Zeile'), rowSel(draft.target, (v) => { draft.target = v; renderControls(); }),
          h('span', {}, '← Zeile'), h('b', {}, ROMAN[draft.target]), h('span', {}, '+'),
          exprInput(draft.factor, (v) => (draft.factor = v)), h('span', {}, '· Zeile'), rowSel(draft.source, (v) => (draft.source = v)));
      } else if (draft.type === 'swap') {
        builder.append(h('span', {}, 'Zeile'), rowSel(draft.i, (v) => (draft.i = v)), h('span', {}, '↔ Zeile'), rowSel(draft.j, (v) => (draft.j = v)));
      } else {
        builder.append(h('span', {}, 'Zeile'), rowSel(draft.i, (v) => { draft.i = v; renderControls(); }), h('span', {}, '←'),
          exprInput(draft.k, (v) => (draft.k = v)), h('span', {}, '· Zeile'), h('b', {}, ROMAN[draft.i]));
      }
      controls.append(
        row(typeSel), builder,
        row(
          button('Ausführen', doManual, 'primary'),
          button('💡 Tipp', showHint),
          button('↶ Rückgängig', () => { S().manualOps.pop(); save(); update(); }),
          button('Neu starten', () => { S().manualOps = []; save(); update(true); }, 'small'),
        ),
        manualMsg,
      );
    }

    function draftOp(): RowOp {
      if (draft.type === 'swap') return { type: 'swap', i: draft.i, j: draft.j };
      if (draft.type === 'scale') return { type: 'scale', i: draft.i, factor: parseExpr(draft.k) };
      return { type: 'add', target: draft.target, source: draft.source, factor: parseExpr(draft.factor) };
    }
    function doManual() {
      const op = draftOp();
      const e = validateOp(op);
      manualMsg.replaceChildren();
      if (e) { manualMsg.append(note('error', e)); return; }
      S().manualOps.push(op);
      save();
      update();
    }
    function showHint() {
      const M0 = baseMatrix(); if (!M0) return;
      const hst = history(M0);
      const cur = hst.mats[hst.cur];
      const op = suggestNext(cur);
      manualMsg.replaceChildren();
      if (!op) { manualMsg.append(note('ok', 'Die Zeilenstufenform ist schon erreicht – weiter mit dem Rückwärtseinsetzen!')); return; }
      // Baukasten mit dem Vorschlag füllen
      draft.type = op.type;
      if (op.type === 'add') Object.assign(draft, { target: op.target, source: op.source, factor: toExprString(op.factor) });
      if (op.type === 'swap') Object.assign(draft, { i: op.i, j: op.j });
      if (op.type === 'scale') Object.assign(draft, { i: op.i, k: toExprString(op.factor) });
      renderControls();
      const t = h('div');
      renderTex(t, texOp(op, ctx.fmt()), true);
      manualMsg.append(note('info', 'Vorschlag (eingetragen – nur noch „Ausführen“ klicken):'), t, h('p', { class: 'hint' }, explainOp(op, cur, ctx.fmt())));
    }

    function go(i: number) {
      const M0 = baseMatrix(); if (!M0) return;
      S().idx = Math.max(0, Math.min(history(M0).ops.length, i));
      save();
      update();
    }

    // ---------------- Darstellung ----------------
    let shownRows: Matrix | null = null; // Ebenen nach Identität (für Animation)
    let cancelAnim: (() => void) | null = null;

    function rowsByIdentity(M: Matrix, perm: number[]): Matrix {
      const out: Matrix = [[], [], []];
      perm.forEach((id, i) => (out[id] = M[i]));
      return out;
    }

    function drawPlanes(rows: Matrix, perm: number[], focus: number | null, ghost: number[] | null, M0: Matrix) {
      clearGroup(group);
      rows.forEach((r, id) => {
        const n = r.slice(0, 3) as Vec3;
        const nn = dot(n, n);
        if (nn < 1e-9) return;
        const p = scale(n, r[3] / nn);
        const isFocus = focus === id;
        group.add(makePlane(n, p, PCOL[id], 9, focus === null ? 0.22 : isFocus ? 0.4 : 0.1));
        const lbl = makeLabel(ROMAN[perm.indexOf(id)], PCOL[id], isFocus ? 0.42 : 0.3);
        lbl.position.copy(toV3(p)).add(toV3(n).normalize().multiplyScalar(0.35));
        group.add(lbl);
      });
      if (ghost) {
        const n = ghost.slice(0, 3) as Vec3;
        const nn = dot(n, n);
        if (nn > 1e-9) group.add(makePlane(n, scale(n, ghost[3] / nn), COLORS.gray, 9, 0.05));
      }
      // Lösung des Ausgangssystems (bleibt bei allen Umformungen gleich!)
      const sol = solveLgs(M0.map((r) => r.slice(0, 3)), M0.map((r) => r[3]) as Vec3);
      if (sol.type === 'point') group.add(makePoint(sol.point!, COLORS.white, 0.13));
      if (sol.type === 'line') group.add(makeLine(sol.point!, sol.dirs[0], COLORS.white, 16, 0.045, 1));
    }

    function update(instant = false) {
      const fmt = ctx.fmt();
      const M0 = baseMatrix();
      eqView.replaceChildren(); stepView.replaceChildren(); backView.replaceChildren();
      if (!M0) { err.textContent = 'Ungültige Eingabe – bitte Zahlen prüfen.'; clearGroup(group); return; }
      err.textContent = '';
      const hst = history(M0);
      const i = hst.cur;
      const M = hst.mats[i];
      const perm = hst.perms[i];
      const done = isEchelon(M);
      const tx = (latex: string, target: HTMLElement) => { const e = h('div'); renderTex(e, latex, true); target.append(e); return e; };

      // ---- Gleichungen (Farbe bleibt an der ursprünglichen Gleichung) ----
      M.forEach((r, k) => {
        const line = h('div', { class: 'row eq-row' }, h('span', { class: 'color-dot', style: { background: PCOL[perm[k]] } }));
        const t = h('span'); renderTex(t, `\\text{${ROMAN[k]}}:\\; ${texEquationRow(r, fmt)}`); line.append(t);
        eqView.append(line);
      });

      // ---- Schritt ----
      stepView.append(h('div', { class: 'row' },
        h('span', { class: 'badge info' }, S().mode === 'demo' ? `Schritt ${i} / ${hst.ops.length}` : `${i} Umformung${i === 1 ? '' : 'en'}`),
        done ? h('span', { class: 'badge ok' }, 'Zeilenstufenform erreicht ✓') : h('span', { class: 'badge warn' }, 'noch keine Zeilenstufenform')));
      let focus: number | null = null;
      if (i === 0) {
        const hl: Highlight = {};
        const next = hst.pivots[0];
        if (next) hl.pivot = next;
        tx(texMatrixHL(M, hl, fmt), stepView);
        stepView.append(h('p', { class: 'hint' }, S().mode === 'demo'
          ? 'Ausgangssystem als erweiterte Koeffizientenmatrix (A | b). Jede Zeile ist eine Gleichung – und im 3D-Bild eine Ebene. Klicke auf „Nächster Schritt“.'
          : 'Wähle eine Zeilenoperation und klicke „Ausführen“. Nicht sicher? „💡 Tipp“ schlägt den nächsten sinnvollen Schritt vor.'));
      } else {
        const op = hst.ops[i - 1];
        const before = hst.mats[i - 1];
        const pv = hst.pivots[i - 1];
        const hlBefore: Highlight = {};
        const hlAfter: Highlight = {};
        if (op.type === 'add') {
          hlBefore.row = hlAfter.row = op.target;
          hlBefore.source = hlAfter.source = op.source;
          if (pv) {
            hlBefore.pivot = pv;
            if (Math.abs(M[op.target][pv[1]]) < 1e-10 && Math.abs(before[op.target][pv[1]]) > 1e-10) hlAfter.zero = [op.target, pv[1]];
          }
          focus = hst.perms[i][op.target];
        } else if (op.type === 'swap') {
          hlAfter.row = op.i; hlAfter.source = op.j;
        } else {
          hlAfter.row = op.i;
          focus = hst.perms[i][op.i];
        }
        stepView.append(h('p', { class: 'explain' }, explainOp(op, before, fmt)));
        stepView.append(h('div', { class: 'muted' }, 'vorher'));
        tx(texMatrixHL(before, hlBefore, fmt), stepView);
        tx(`\\Big\\downarrow\\; ${texOp(op, fmt)}`, stepView);
        stepView.append(h('div', { class: 'muted' }, 'nachher'));
        tx(texMatrixHL(M, hlAfter, fmt), stepView);
        const calc = texRowCalc(op, before, M, fmt);
        if (calc) {
          const det = h('details', { class: 'calc', open: true }, h('summary', {}, 'Eintragweise Rechnung'));
          const body = h('div'); renderTex(body, calc, true); det.append(body);
          stepView.append(det);
        }
        stepView.append(h('div', { class: 'legend' },
          h('span', {}, h('span', { class: 'color-dot', style: { background: '#fbbf24' } }), 'Pivot'),
          h('span', {}, h('span', { class: 'color-dot', style: { background: '#c4b5fd' } }), 'Hilfszeile'),
          h('span', {}, h('span', { class: 'color-dot', style: { background: '#67e8f9' } }), 'veränderte Zeile'),
          h('span', {}, h('span', { class: 'color-dot', style: { background: '#86efac' } }), 'neue Null')));
        if (op.type === 'add') stepView.append(h('p', { class: 'hint' }, '3D: Die veränderte Ebene dreht sich um die Schnittgerade mit der Hilfszeilen-Ebene – der Lösungspunkt (weiß) bleibt liegen.'));
        if (op.type === 'swap') stepView.append(h('p', { class: 'hint' }, '3D: Beim Tauschen ändert sich keine Ebene – nur ihre Nummer.'));
      }

      // ---- Rückwärtseinsetzen ----
      if (!done) {
        backView.append(h('p', { class: 'hint' }, 'Erst wenn unter jedem Pivot nur Nullen stehen (Zeilenstufenform), kann man von unten nach oben einsetzen.'));
      } else {
        const bs = backSubstitute(M, fmt);
        backView.append(h('p', { class: 'hint' }, bs.kind === 'none'
          ? 'Eine Zeile lautet 0 = c mit c ≠ 0 – das ist nie erfüllt.'
          : 'Von unten nach oben: letzte Zeile nach der Variablen auflösen, Ergebnis in die Zeile darüber einsetzen usw.'));
        bs.lines.forEach((l) => tx(l, backView));
        const badge = { unique: ['ok', 'genau eine Lösung (Punkt)'], infinite: ['info', 'unendlich viele Lösungen'], none: ['err', 'keine Lösung'], all: ['info', 'jeder Punkt ist Lösung'] }[bs.kind];
        backView.append(h('div', { class: 'row' }, h('span', { class: `badge ${badge[0]}` }, badge[1])));
        tx(texSolutionSet(bs, fmt), backView);
      }

      // ---- 3D mit Animation ----
      const target = rowsByIdentity(M, perm);
      const ghost = focus !== null && i > 0 ? rowsByIdentity(hst.mats[i - 1], hst.perms[i - 1])[focus] : null;
      cancelAnim?.();
      const from = shownRows;
      shownRows = target;
      if (instant || !from) { drawPlanes(target, perm, focus, ghost, M0); return; }
      cancelAnim = animate(900, (k) => {
        const rows = target.map((r, id) => r.map((x, j) => from[id][j] + (x - from[id][j]) * k));
        drawPlanes(rows, perm, focus, k >= 1 ? ghost : null, M0);
      });
    }

    renderExamples();
    renderControls();
    ctx.onSettings(() => update(true));
    update(true);
    return { panel, group, activate: () => update(true) };
  },
};
