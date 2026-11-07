/**
 * Kleine UI-Bibliothek ohne Framework: Eingabefelder, Matrix-Editor, Slider,
 * Schalter, KaTeX-Rendering und Animations-Helfer.
 */
import katex from 'katex';
import { parseExpr, type Scope } from '../math/parse';

type Child = Node | string | null | undefined | false;

/** Element erzeugen: h('div', { class: 'x', onclick: fn }, kind1, kind2) */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && typeof v !== 'string') (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

/** LaTeX in ein Element rendern (Fehler werden angezeigt statt geworfen). */
export function renderTex(el: HTMLElement, tex: string, display = false) {
  try {
    katex.render(tex, el, { throwOnError: false, displayMode: display, strict: 'ignore', output: 'html' });
  } catch {
    el.textContent = tex;
  }
}

export function tex(texStr: string, display = false, cls = ''): HTMLElement {
  const el = h(display ? 'div' : 'span', { class: `tex ${cls}` });
  renderTex(el, texStr, display);
  return el;
}

export function card(title: string, ...children: Child[]): HTMLElement {
  return h('section', { class: 'card' }, title ? h('h3', {}, title) : null, ...children);
}

export function row(...children: Child[]): HTMLElement {
  return h('div', { class: 'row' }, ...children);
}

export function note(kind: 'info' | 'error' | 'ok' | 'warn' = 'info', text = ''): HTMLElement {
  return h('div', { class: `note note-${kind}` }, text);
}

const SCRUB_HINT = 'Ziehen: Wert ändern (Shift ×10, Alt ÷10) · Klicken: tippen · ↑/↓';

export interface ExprInput extends HTMLInputElement {
  validate(): boolean;
}

/** Zahlenfeld, das Ausdrücke versteht (1/2, sqrt(2), a, ...) und Fehler rot markiert. */
export function exprInput(value: string, onChange: (v: string) => void, scope: () => Scope = () => ({}), placeholder = '0'): ExprInput {
  const inp = h('input', {
    class: 'num',
    type: 'text',
    value,
    placeholder,
    spellcheck: false,
    autocomplete: 'off',
    inputmode: 'decimal',
  }) as ExprInput;
  inp.validate = () => {
    const ok = isFinite(parseExpr(inp.value, scope()));
    inp.classList.toggle('invalid', !ok);
    inp.title = ok ? SCRUB_HINT : 'Ungültige Eingabe';
    return ok;
  };
  inp.addEventListener('input', () => {
    inp.validate();
    onChange(inp.value);
  });
  inp.addEventListener('focus', () => inp.select());
  enableScrub(inp, scope);
  inp.validate();
  return inp;
}

/**
 * "Scrubbing" wie in Premiere/After Effects: Zahlenfeld mit gedrückter Maus
 * nach links/rechts ziehen, um den Wert zu verkleinern/vergrößern.
 *  - normal: Schritt 0.1   - Shift: Schritt 1   - Alt/Strg: Schritt 0.01
 * Ein einfacher Klick ohne Bewegung fokussiert das Feld wie gewohnt zum Tippen.
 * Zusätzlich: Pfeiltasten ↑/↓ im fokussierten Feld (mit denselben Modifikatoren).
 */
export function enableScrub(inp: HTMLInputElement, scope: () => Scope = () => ({})) {
  const PX_PER_STEP = 4;
  const stepOf = (e: { shiftKey: boolean; altKey: boolean; ctrlKey: boolean }) => (e.shiftKey ? 1 : e.altKey || e.ctrlKey ? 0.01 : 0.1);
  const setValue = (v: number, step: number) => {
    const digits = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
    const s = String(+v.toFixed(digits));
    if (s === inp.value) return;
    inp.value = s;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const current = () => {
    const v = parseExpr(inp.value, scope());
    return isFinite(v) ? v : 0;
  };
  if (!inp.title) inp.title = SCRUB_HINT;

  let start: { x: number; v: number; id: number; moved: boolean } | null = null;
  inp.addEventListener('pointerdown', (e) => {
    if (document.activeElement === inp || e.button !== 0) return; // beim Tippen normal markieren
    e.preventDefault(); // Fokus erst nach Klick ohne Bewegung
    start = { x: e.clientX, v: current(), id: e.pointerId, moved: false };
    inp.setPointerCapture(e.pointerId);
  });
  inp.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    if (!start.moved && Math.abs(dx) < 3) return;
    if (!start.moved) {
      start.moved = true;
      inp.classList.add('scrubbing');
      document.body.classList.add('scrubbing');
    }
    const step = stepOf(e);
    setValue(start.v + Math.round(dx / PX_PER_STEP) * step, step);
  });
  const end = (e: PointerEvent) => {
    if (!start || e.pointerId !== start.id) return;
    const wasClick = !start.moved;
    start = null;
    inp.classList.remove('scrubbing');
    document.body.classList.remove('scrubbing');
    if (wasClick && e.type === 'pointerup') inp.focus();
  };
  inp.addEventListener('pointerup', end);
  inp.addEventListener('pointercancel', end);
  inp.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const step = stepOf(e);
    setValue(current() + (e.key === 'ArrowUp' ? step : -step), step);
    inp.select();
  });
}

export interface VecEditor {
  el: HTMLElement;
  inputs: ExprInput[];
  set(values: string[]): void;
  validate(): void;
}

export function vecEditor(values: string[], onChange: (v: string[]) => void, scope?: () => Scope): VecEditor {
  const cur = values.slice();
  const inputs = cur.map((v, i) =>
    exprInput(v, (nv) => {
      cur[i] = nv;
      onChange(cur.slice());
    }, scope),
  );
  const el = h('div', { class: 'vec-editor' }, h('span', { class: 'paren' }, '('), ...inputs, h('span', { class: 'paren' }, ')'));
  return {
    el,
    inputs,
    set(nv) {
      nv.forEach((v, i) => {
        cur[i] = v;
        if (document.activeElement !== inputs[i] && inputs[i].value !== v) inputs[i].value = v;
        inputs[i].validate();
      });
    },
    validate: () => inputs.forEach((i) => i.validate()),
  };
}

export interface MatEditor {
  el: HTMLElement;
  set(values: string[][]): void;
  validate(): void;
}

/** Matrix-Editor (beliebige Größe), optional mit Trennstrich vor der letzten Spalte. */
export function matEditor(values: string[][], onChange: (v: string[][]) => void, opts: { augmented?: boolean; scope?: () => Scope } = {}): MatEditor {
  const cur = values.map((r) => r.slice());
  const cols = cur[0].length;
  const inputs: ExprInput[][] = [];
  const grid = h('div', { class: `mat-grid${opts.augmented ? ' augmented' : ''}`, style: { gridTemplateColumns: `repeat(${cols}, 1fr)` } });
  cur.forEach((r, i) => {
    inputs.push([]);
    r.forEach((v, j) => {
      const inp = exprInput(v, (nv) => {
        cur[i][j] = nv;
        onChange(cur.map((x) => x.slice()));
      }, opts.scope);
      if (opts.augmented && j === cols - 1) inp.classList.add('rhs');
      inputs[i].push(inp);
      grid.append(inp);
    });
  });
  const el = h('div', { class: 'mat-editor' }, grid);
  return {
    el,
    set(nv) {
      nv.forEach((r, i) =>
        r.forEach((v, j) => {
          cur[i][j] = v;
          const inp = inputs[i][j];
          if (document.activeElement !== inp && inp.value !== v) inp.value = v;
          inp.validate();
        }),
      );
    },
    validate: () => inputs.flat().forEach((i) => i.validate()),
  };
}

export interface Slider {
  el: HTMLElement;
  input: HTMLInputElement;
  set(v: number): void;
  value(): number;
}

export function slider(o: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onInput: (v: number) => void;
  format?: (v: number) => string;
}): Slider {
  const out = h('span', { class: 'slider-val' });
  const fmt = o.format ?? ((v: number) => String(+v.toFixed(3)));
  const input = h('input', { type: 'range', min: o.min, max: o.max, step: o.step, value: String(o.value) }) as HTMLInputElement;
  const paint = () => {
    const v = Number(input.value);
    out.textContent = fmt(v);
    const pct = ((v - Number(input.min)) / (Number(input.max) - Number(input.min))) * 100;
    input.style.setProperty('--pct', `${pct}%`);
  };
  input.addEventListener('input', () => {
    paint();
    o.onInput(Number(input.value));
  });
  paint();
  const el = h('label', { class: 'slider' }, h('span', { class: 'slider-label' }, o.label), input, out);
  return {
    el,
    input,
    set(v) {
      input.value = String(v);
      paint();
    },
    value: () => Number(input.value),
  };
}

export function button(label: string, onClick: () => void, cls = ''): HTMLButtonElement {
  return h('button', { class: `btn ${cls}`, type: 'button', onclick: onClick }, label);
}

export function toggle(label: string, checked: boolean, onChange: (v: boolean) => void): HTMLLabelElement {
  const cb = h('input', { type: 'checkbox', checked }) as HTMLInputElement;
  cb.addEventListener('change', () => onChange(cb.checked));
  return h('label', { class: 'switch' }, cb, h('span', { class: 'switch-track' }), h('span', {}, label));
}

export function select<T extends string>(options: { value: T; label: string }[], value: T, onChange: (v: T) => void): HTMLSelectElement {
  const s = h('select', { class: 'select' }, ...options.map((o) => h('option', { value: o.value, selected: o.value === value }, o.label))) as HTMLSelectElement;
  s.addEventListener('change', () => onChange(s.value as T));
  return s;
}

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Zeitbasierte Animation; liefert eine Abbruchfunktion. */
export function animate(duration: number, onUpdate: (k: number) => void, onDone?: () => void): () => void {
  const t0 = performance.now();
  let raf = 0;
  let stopped = false;
  const step = () => {
    if (stopped) return;
    const k = Math.min(1, (performance.now() - t0) / duration);
    onUpdate(easeInOut(k));
    if (k < 1) raf = requestAnimationFrame(step);
    else onDone?.();
  };
  raf = requestAnimationFrame(step);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}

/** Kurze Toast-Meldung unten in der Mitte */
export function toast(msg: string) {
  const t = h('div', { class: 'toast' }, msg);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 400);
  }, 2200);
}
