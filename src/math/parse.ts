/**
 * Sicheres Parsen von Zahlenfeldern mit math.js.
 * Erlaubt Brüche ("1/2"), Wurzeln ("sqrt(2)"), Winkel ("cos(30 deg)"),
 * Dezimalkomma ("0,5") und Parameter wie "a" (z. B. v3 = (1, 2, a)).
 */
import { create, all } from 'mathjs';

const math = create(all, {});

export type Scope = Record<string, number>;

/**
 * Zusätzlicher Schutz (Defense in Depth): Erlaubt sind nur Zahlen, Bezeichner,
 * Rechenzeichen, Klammern und Leerzeichen. Zuweisungen (=), Objekt-/Property-
 * Zugriffe (a.b, a["b"]), Strings und Blöcke werden abgelehnt – so können auch
 * präparierte Teilen-Links keine math.js-Interna verändern.
 */
export function isSafeExpression(s: string): boolean {
  if (!/^[0-9a-zA-Z_.\s+\-*/^()%!]*$/.test(s)) return false;
  if (/\.\s*[a-zA-Z_]/.test(s)) return false; // Property-Zugriff wie x.constructor
  return true;
}

/** Liefert eine Zahl oder NaN, falls die Eingabe ungültig ist. Wirft nie. */
export function parseExpr(input: string, scope: Scope = {}): number {
  const s = String(input ?? '').trim().replace(/,/g, '.');
  if (s === '' || s.length > 200 || !isSafeExpression(s)) return NaN;
  try {
    const v = math.evaluate(s, { ...scope });
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    // math.js kann Brüche, BigNumbers o. Ä. liefern
    if (v && typeof v === 'object' && 'valueOf' in v) {
      const n = Number(v.valueOf());
      return isFinite(n) ? n : NaN;
    }
    return NaN;
  } catch {
    return NaN;
  }
}

export const parseVec = (v: string[], scope: Scope = {}): number[] => v.map((s) => parseExpr(s, scope));
export const parseMat = (m: string[][], scope: Scope = {}): number[][] => m.map((r) => parseVec(r, scope));

export const allFinite = (xs: number[] | number[][]): boolean =>
  (xs as unknown[]).flat().every((x) => typeof x === 'number' && isFinite(x));
