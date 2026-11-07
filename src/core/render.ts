/**
 * Zentraler "Bitte neu zeichnen"-Auslöser (Rendern bei Bedarf, schont den Akku).
 * Die 3D-Ansicht zeichnet nur, wenn sich etwas geändert hat – nicht dauerhaft.
 * Aufgerufen von: Animationen (ui.animate), Zustandsänderungen (Store), Eingaben.
 */
const listeners = new Set<() => void>();

export function requestRender() {
  listeners.forEach((cb) => cb());
}

export function onRenderRequest(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
