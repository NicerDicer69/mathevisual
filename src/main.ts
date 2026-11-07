/**
 * Einstiegspunkt: baut das Layout (Viewport links, Panel rechts), die Toolbar
 * und die Tabs für alle Module auf.
 */
import 'katex/dist/katex.min.css';
import './styles.css';
import { Viewport } from './core/viewport';
import { Store } from './core/store';
import { h, select, toast } from './core/ui';
import type { AppContext, ModuleInstance } from './core/module';
import type { FormatOptions, NumberMode } from './math/format';
import { MODULES } from './modules';

interface Settings {
  mode: NumberMode;
  decimals: number;
  labels: boolean;
  grid: boolean;
  tab: string;
  panelOpen: boolean;
}

const DEFAULT_SETTINGS: Settings = { mode: 'frac', decimals: 3, labels: true, grid: true, tab: MODULES[0].id, panelOpen: true };

const store = new Store();
const settings = () => store.get<Settings>('settings', DEFAULT_SETTINGS);
const setSetting = <K extends keyof Settings>(k: K, v: Settings[K]) => store.update('settings', DEFAULT_SETTINGS, (s) => (s[k] = v));

// ---------------- Layout ----------------
const app = document.getElementById('app')!;
const vpEl = h('div', { class: 'viewport' });
const tabsEl = h('nav', { class: 'tabs', role: 'tablist' });
const bodyEl = h('div', { class: 'panel-body' });
const panelTitle = h('h2', { class: 'panel-title' });
const panel = h('aside', { class: 'panel' }, h('div', { class: 'panel-head' }, panelTitle), tabsEl, bodyEl);
const panelToggle = h('button', { class: 'panel-toggle', title: 'Panel ein-/ausklappen', 'aria-label': 'Panel ein-/ausklappen' }, '❯');
const toolbar = h('div', { class: 'toolbar' });
app.append(vpEl, toolbar, panel, panelToggle);

const viewport = new Viewport(vpEl);

const settingsCbs: (() => void)[] = [];
const ctx: AppContext = {
  viewport,
  store,
  fmt: (): FormatOptions => ({ mode: settings().mode, decimals: settings().decimals }),
  onSettings: (cb) => settingsCbs.push(cb),
};
store.on('settings', () => settingsCbs.forEach((cb) => cb()));

// ---------------- Toolbar ----------------
const iconBtn = (icon: string, title: string, onClick: () => void, cls = '') =>
  h('button', { class: `tool ${cls}`, title, 'aria-label': title, onclick: onClick }, h('span', { class: 'ico' }, icon), h('span', { class: 'tool-label' }, title));

const labelBtn = iconBtn('Aa', 'Beschriftungen', () => {
  setSetting('labels', !settings().labels);
  applyViewSettings();
});
const gridBtn = iconBtn('#', 'Gitter', () => {
  setSetting('grid', !settings().grid);
  applyViewSettings();
});

const modeSel = select<NumberMode>(
  [
    { value: 'frac', label: 'Brüche' },
    { value: 'dec', label: 'Dezimal' },
  ],
  settings().mode,
  (v) => setSetting('mode', v),
);
const decSel = select(
  ['1', '2', '3', '4', '6'].map((d) => ({ value: d, label: `${d} Stellen` })),
  String(settings().decimals),
  (v) => setSetting('decimals', Number(v)),
);

toolbar.append(
  h('div', { class: 'brand' }, h('span', { class: 'logo' }), h('span', {}, 'Mathe', h('b', {}, 'Visual'))),
  h(
    'div',
    { class: 'tools' },
    iconBtn('⌂', 'Kamera zurücksetzen', () => viewport.resetCamera()),
    iconBtn('📷', 'Screenshot', () => viewport.screenshot()),
    labelBtn,
    gridBtn,
    h('div', { class: 'tool-select', title: 'Zahlenformat' }, modeSel, decSel),
    iconBtn('🔗', 'Link teilen', async () => {
      const url = store.shareUrl();
      try {
        await navigator.clipboard.writeText(url);
        toast('Link mit aktuellem Zustand kopiert');
      } catch {
        prompt('Link kopieren:', url);
      }
    }),
    iconBtn('↺', 'Alles zurücksetzen', () => {
      if (confirm('Alle Eingaben auf Standardwerte zurücksetzen?')) store.reset();
    }),
  ),
);

function applyViewSettings() {
  const s = settings();
  viewport.setLabelsVisible(s.labels);
  viewport.setGridVisible(s.grid);
  labelBtn.classList.toggle('active', s.labels);
  gridBtn.classList.toggle('active', s.grid);
  decSel.disabled = false;
  panel.classList.toggle('collapsed', !s.panelOpen);
  panelToggle.classList.toggle('collapsed', !s.panelOpen);
  document.body.classList.toggle('panel-collapsed', !s.panelOpen);
}

panelToggle.addEventListener('click', () => {
  setSetting('panelOpen', !settings().panelOpen);
  applyViewSettings();
});

// ---------------- Module / Tabs ----------------
const instances = new Map<string, ModuleInstance>();
let active: ModuleInstance | null = null;

function showModule(id: string) {
  const def = MODULES.find((m) => m.id === id) ?? MODULES[0];
  if (active) {
    active.deactivate?.();
    active.group.visible = false;
    active.panel.remove();
  }
  let inst = instances.get(def.id);
  if (!inst) {
    try {
      inst = def.create(ctx);
    } catch (e) {
      console.error(e);
      bodyEl.replaceChildren(h('div', { class: 'note note-error' }, `Modul konnte nicht geladen werden: ${String(e)}`));
      return;
    }
    instances.set(def.id, inst);
    viewport.root.add(inst.group);
  }
  active = inst;
  inst.group.visible = true;
  bodyEl.replaceChildren(inst.panel);
  bodyEl.scrollTop = 0;
  inst.activate?.();
  panelTitle.textContent = def.title;
  tabsEl.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', (t as HTMLElement).dataset.id === def.id));
  if (settings().tab !== def.id) setSetting('tab', def.id);
}

MODULES.forEach((m, i) => {
  tabsEl.append(
    h(
      'button',
      { class: 'tab', role: 'tab', 'data-id': m.id, title: m.title, onclick: () => showModule(m.id) },
      h('span', { class: 'tab-num' }, String(i + 1)),
      h('span', { class: 'tab-icon' }, m.icon),
      h('span', { class: 'tab-text' }, m.short),
    ),
  );
});

applyViewSettings();
showModule(settings().tab);

// Rendern bei Bedarf: jede Nutzereingabe fordert einen neuen Frame an.
for (const ev of ['input', 'change', 'click', 'keyup', 'pointerup', 'wheel']) document.addEventListener(ev, viewport.invalidate, { capture: true, passive: true });
// Ziehen im 3D-Fenster (z. B. Vektorspitzen) – nur bei gedrückter Taste
viewport.renderer.domElement.addEventListener('pointermove', (e) => { if (e.buttons) viewport.invalidate(); }, { passive: true });

// Globale Fehlerbehandlung: nie die ganze App abstürzen lassen
window.addEventListener('error', (e) => console.error('Fehler:', e.message));
window.addEventListener('unhandledrejection', (e) => console.error('Fehler:', e.reason));
