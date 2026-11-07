/**
 * Wiederverwendbare Panel-Komponenten:
 *  - sharedMatrixEditor: Editor für die global geteilte Matrix M (inkl. Voreinstellungen)
 *  - transformControls : "Anwenden"-Button + Slider t für animierte Transformationen
 */
import { h, matEditor, select, slider, button, exprInput, animate, row, type MatEditor } from './ui';
import type { Store } from './store';
import { parseMat, parseExpr, allFinite } from '../math/parse';
import { toExprString } from '../math/format';
import {
  rotationMatrix, reflectionMatrix, stretchMatrix, shearMatrix, projectionPlaneMatrix,
  projectionLineMatrix, identity, type Matrix, type Vec3,
} from '../math/linalg';

export const DEFAULT_M = [
  ['1', '1', '0'],
  ['0', '1', '0'],
  ['0', '0', '1'],
];

/** Liest eine Matrix (Strings) aus dem Store; null bei ungültigen Einträgen. */
export function readMatrix(store: Store, key = 'matrix', def = DEFAULT_M): Matrix | null {
  const m = parseMat(store.get<string[][]>(key, def));
  return allFinite(m) ? m : null;
}

export const matToStrings = (M: Matrix): string[][] => M.map((r) => r.map(toExprString));

type PresetKind = 'identity' | 'rotation' | 'reflection' | 'stretch' | 'shear' | 'projection';

/**
 * Editor für eine im Store gespeicherte 3×3-Matrix. Mehrere Module teilen sich
 * den Schlüssel "matrix" – Änderungen sind sofort überall sichtbar.
 */
export function sharedMatrixEditor(store: Store, opts: { key?: string; presets?: boolean; title?: string } = {}): { el: HTMLElement; editor: MatEditor } {
  const key = opts.key ?? 'matrix';
  const editor = matEditor(store.get<string[][]>(key, DEFAULT_M), (v) => store.set(key, v));
  store.on(key, () => editor.set(store.get<string[][]>(key, DEFAULT_M)));
  const el = h('div', { class: 'shared-matrix' }, h('div', { class: 'row' }, h('span', { class: 'muted' }, opts.title ?? 'M ='), editor.el));
  if (opts.presets !== false) el.append(presetPanel((M) => store.set(key, matToStrings(M))));
  return { el, editor };
}

/** Voreinstellungen: Drehung, Spiegelung, Streckung, Scherung, Projektion */
export function presetPanel(apply: (M: Matrix) => void): HTMLElement {
  const params = h('div', { class: 'preset-params' });
  let kind: PresetKind = 'rotation';
  // Parameterzustand der Voreinstellungen
  const st = { axis: 'z', custom: ['1', '1', '1'], angle: '45', plane: 'xy', sx: '2', sy: '1', sz: '1', shear: 'xy', k: '1', proj: 'xy' };

  const axisVec = (a: string): Vec3 => {
    if (a === 'x') return [1, 0, 0];
    if (a === 'y') return [0, 1, 0];
    if (a === 'z') return [0, 0, 1];
    const v = st.custom.map((s) => parseExpr(s));
    return (v.every(isFinite) ? v : [0, 0, 1]) as Vec3;
  };
  const planeNormal = (p: string): Vec3 => (p === 'xy' ? [0, 0, 1] : p === 'xz' ? [0, 1, 0] : [1, 0, 0]);

  const num = (k: keyof typeof st) => exprInput(st[k] as string, (v) => ((st as Record<string, unknown>)[k] = v));
  const customVec = () => h('span', { class: 'row' }, ...st.custom.map((_, i) => exprInput(st.custom[i], (v) => (st.custom[i] = v))));

  const renderParams = () => {
    params.replaceChildren();
    switch (kind) {
      case 'rotation': {
        const cv = customVec();
        cv.style.display = st.axis === 'custom' ? '' : 'none';
        params.append(
          row(h('span', { class: 'muted' }, 'Achse'), select([{ value: 'x', label: 'x-Achse' }, { value: 'y', label: 'y-Achse' }, { value: 'z', label: 'z-Achse' }, { value: 'custom', label: 'eigene' }], st.axis, (v) => { st.axis = v; cv.style.display = v === 'custom' ? '' : 'none'; }),
            h('span', { class: 'muted' }, 'Winkel °'), num('angle')),
          cv,
        );
        break;
      }
      case 'reflection':
        params.append(row(h('span', { class: 'muted' }, 'an der Ebene'), select([{ value: 'xy', label: 'xy-Ebene' }, { value: 'xz', label: 'xz-Ebene' }, { value: 'yz', label: 'yz-Ebene' }], st.plane, (v) => (st.plane = v))));
        break;
      case 'stretch':
        params.append(row(h('span', { class: 'muted' }, 'sₓ'), num('sx'), h('span', { class: 'muted' }, 'sᵧ'), num('sy'), h('span', { class: 'muted' }, 's_z'), num('sz')));
        break;
      case 'shear':
        params.append(row(
          select([
            { value: 'xy', label: 'x += k·y' }, { value: 'xz', label: 'x += k·z' }, { value: 'yx', label: 'y += k·x' },
            { value: 'yz', label: 'y += k·z' }, { value: 'zx', label: 'z += k·x' }, { value: 'zy', label: 'z += k·y' },
          ], st.shear, (v) => (st.shear = v)),
          h('span', { class: 'muted' }, 'k'), num('k')));
        break;
      case 'projection':
        params.append(row(h('span', { class: 'muted' }, 'auf'), select([
          { value: 'xy', label: 'xy-Ebene' }, { value: 'xz', label: 'xz-Ebene' }, { value: 'yz', label: 'yz-Ebene' },
          { value: 'x', label: 'x-Achse' }, { value: 'diag', label: 'Gerade (1,1,1)' },
        ], st.proj, (v) => (st.proj = v))));
        break;
      case 'identity':
        params.append(h('div', { class: 'hint' }, 'Setzt M auf die Einheitsmatrix E.'));
    }
  };

  const build = (): Matrix => {
    const n = (s: string, d: number) => { const v = parseExpr(s); return isFinite(v) ? v : d; };
    const idx = { x: 0, y: 1, z: 2 } as Record<string, number>;
    switch (kind) {
      case 'rotation': return rotationMatrix(axisVec(st.axis), (n(st.angle, 0) * Math.PI) / 180);
      case 'reflection': return reflectionMatrix(planeNormal(st.plane));
      case 'stretch': return stretchMatrix(n(st.sx, 1), n(st.sy, 1), n(st.sz, 1));
      case 'shear': return shearMatrix(idx[st.shear[0]], idx[st.shear[1]], n(st.k, 1));
      case 'projection':
        if (st.proj === 'x') return projectionLineMatrix([1, 0, 0]);
        if (st.proj === 'diag') return projectionLineMatrix([1, 1, 1]);
        return projectionPlaneMatrix(planeNormal(st.proj));
      default: return identity();
    }
  };

  const kindSel = select<PresetKind>([
    { value: 'rotation', label: 'Drehung' },
    { value: 'reflection', label: 'Spiegelung' },
    { value: 'stretch', label: 'Streckung' },
    { value: 'shear', label: 'Scherung' },
    { value: 'projection', label: 'Projektion' },
    { value: 'identity', label: 'Einheitsmatrix' },
  ], kind, (v) => { kind = v; renderParams(); });

  renderParams();
  return h('details', { class: 'presets' },
    h('summary', {}, 'Voreinstellungen'),
    row(kindSel, button('Übernehmen', () => apply(build()), 'small primary')),
    params,
  );
}

export interface TransformControls {
  el: HTMLElement;
  t(): number;
  setT(t: number): void;
  setMax(m: number): void;
  play(): void;
}

/**
 * Animations-Steuerung für t ∈ [0, max]. "Anwenden" animiert von 0 bis max,
 * "Zurück" zurück auf 0. Der Slider erlaubt freies Scrubben.
 */
export function transformControls(onT: (t: number) => void, initial = 1, max = 1): TransformControls {
  let t = initial;
  let cancel: (() => void) | null = null;
  const sl = slider({ label: 't', min: 0, max, step: 0.001, value: t, onInput: (v) => { cancel?.(); set(v); }, format: (v) => v.toFixed(2) });
  const set = (v: number) => { t = v; sl.set(v); onT(v); };
  const to = (target: number) => {
    cancel?.();
    const from = t;
    const dur = 900 + 700 * Math.abs(target - from);
    cancel = animate(dur, (k) => set(from + (target - from) * k), () => (cancel = null));
  };
  const play = () => { set(0); to(Number(sl.input.max)); };
  const el = h('div', { class: 'transform-controls' },
    row(button('▶ Anwenden', play, 'primary'), button('⟲ Zurück', () => to(0)), button('E → M sofort', () => { cancel?.(); set(Number(sl.input.max)); }, 'small')),
    sl.el,
  );
  return {
    el,
    t: () => t,
    setT: set,
    setMax(m) { sl.input.max = String(m); if (t > m) set(m); else sl.set(t); },
    play,
  };
}
