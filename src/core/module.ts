/**
 * Gemeinsame Schnittstelle aller Module. Jedes Modul liegt in einem eigenen
 * Ordner unter src/modules/<name>/ mit
 *   - math.ts       : reine Rechenlogik (optional, oft aus src/math/linalg.ts)
 *   - view.ts       : Panel-UI + 3D-Darstellung
 *   - *.test.ts     : Vitest-Unit-Tests der Mathe-Logik
 */
import type * as THREE from 'three';
import type { Viewport } from './viewport';
import type { Store } from './store';
import type { FormatOptions } from '../math/format';

export interface AppContext {
  viewport: Viewport;
  store: Store;
  /** aktuelle Zahlenformatierung (Brüche/Dezimal) */
  fmt(): FormatOptions;
  /** Callback bei Änderung der globalen Einstellungen */
  onSettings(cb: () => void): void;
}

export interface ModuleInstance {
  /** Inhalt des rechten Panels */
  panel: HTMLElement;
  /** 3D-Objekte des Moduls (nur sichtbar, wenn Modul aktiv) */
  group: THREE.Group;
  activate?(): void;
  deactivate?(): void;
}

export interface ModuleDef {
  id: string;
  title: string;
  /** Kurzbezeichnung für den Tab */
  short: string;
  icon: string;
  create(ctx: AppContext): ModuleInstance;
}
