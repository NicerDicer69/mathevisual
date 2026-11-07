/**
 * Zentraler App-Zustand mit Persistenz in localStorage und optionalem
 * Teilen-Link (Zustand Base64-kodiert im URL-Hash "#s=...").
 */

import { requestRender } from './render';

type Listener = () => void;

const STORAGE_KEY = 'mathevisual-state-v1';

function encode(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(s: string): unknown {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export class Store {
  private data: Record<string, unknown> = {};
  private listeners = new Map<string, Set<Listener>>();
  private saveTimer: number | undefined;

  constructor() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.data = JSON.parse(raw) ?? {};
    } catch {
      this.data = {};
    }
    // Ein Teilen-Link hat Vorrang vor dem lokal gespeicherten Zustand
    const m = location.hash.match(/#s=([A-Za-z0-9_-]+)/);
    if (m) {
      try {
        const d = decode(m[1]);
        if (d && typeof d === 'object') this.data = d as Record<string, unknown>;
      } catch {
        console.warn('Ungültiger Teilen-Link – wird ignoriert.');
      }
      history.replaceState(null, '', location.pathname + location.search);
      this.save();
    }
  }

  /** Wert lesen; fehlt er (oder hat er den falschen Typ), wird der Standardwert gesetzt. */
  get<T>(key: string, def: T): T {
    const v = this.data[key];
    if (v === undefined || v === null || typeof v !== typeof def || Array.isArray(v) !== Array.isArray(def)) {
      this.data[key] = structuredClone(def);
      return this.data[key] as T;
    }
    // fehlende Felder in Objekten mit Standardwerten auffüllen
    if (typeof def === 'object' && !Array.isArray(def) && def) {
      const obj = v as Record<string, unknown>;
      for (const [k, dv] of Object.entries(def as Record<string, unknown>)) {
        if (obj[k] === undefined || typeof obj[k] !== typeof dv) obj[k] = structuredClone(dv);
      }
    }
    return v as T;
  }

  set<T>(key: string, value: T) {
    this.data[key] = value;
    this.scheduleSave();
    this.emit(key);
    requestRender();
  }

  /** Bequem: Objekt verändern und speichern */
  update<T>(key: string, def: T, fn: (v: T) => void) {
    const v = this.get(key, def);
    fn(v);
    this.set(key, v);
  }

  on(key: string, cb: Listener): () => void {
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key)!.add(cb);
    return () => this.listeners.get(key)?.delete(cb);
  }

  emit(key: string) {
    this.listeners.get(key)?.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error(e);
      }
    });
  }

  private scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.save(), 250);
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      /* z. B. privater Modus – ignorieren */
    }
  }

  shareUrl(): string {
    return `${location.origin}${location.pathname}#s=${encode(this.data)}`;
  }

  reset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignorieren */
    }
    location.hash = '';
    location.reload();
  }
}
