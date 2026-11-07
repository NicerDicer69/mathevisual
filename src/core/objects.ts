/**
 * Wiederverwendbare 3D-Bausteine: Pfeile, Beschriftungen, Geraden, Ebenen, Punkte.
 * Achtung: Die Szene ist "z nach oben" orientiert (camera.up = (0,0,1)).
 */
import * as THREE from 'three';
import type { Vec3, Matrix } from '../math/linalg';

/** Layer für Beschriftungen – lässt sich global an der Kamera ein-/ausschalten. */
export const LABEL_LAYER = 1;

// Gemeinsame Geometrien (werden nie entsorgt)
const shaftGeo = new THREE.CylinderGeometry(1, 1, 1, 16, 1);
const headGeo = new THREE.ConeGeometry(1, 1, 20, 1);
const sphereGeo = new THREE.SphereGeometry(1, 24, 16);
for (const g of [shaftGeo, headGeo, sphereGeo]) g.userData.shared = true;

const UP = new THREE.Vector3(0, 1, 0);

export const toV3 = (v: Vec3 | number[]) => new THREE.Vector3(v[0], v[1], v[2]);

/** Matrix (3×3, row-major) → THREE.Matrix4 */
export function toMatrix4(M: Matrix): THREE.Matrix4 {
  return new THREE.Matrix4().set(
    M[0][0], M[0][1], M[0][2], 0,
    M[1][0], M[1][1], M[1][2], 0,
    M[2][0], M[2][1], M[2][2], 0,
    0, 0, 0, 1,
  );
}

export function material(color: THREE.ColorRepresentation, opacity = 1): THREE.MeshStandardMaterial {
  const c = new THREE.Color(color);
  return new THREE.MeshStandardMaterial({
    color: c,
    emissive: c.clone().multiplyScalar(0.28),
    roughness: 0.38,
    metalness: 0.08,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
  });
}

export interface ArrowOptions {
  radius?: number;
  opacity?: number;
  label?: string;
}

/** Pfeil von `from` nach `to` mit Zylinder-Schaft und Kegel-Spitze. */
export class Arrow extends THREE.Group {
  private shaft: THREE.Mesh;
  private head: THREE.Mesh;
  private mat: THREE.MeshStandardMaterial;
  private label?: THREE.Sprite;
  private radius: number;

  constructor(from: Vec3, to: Vec3, color: THREE.ColorRepresentation, opts: ArrowOptions = {}) {
    super();
    this.radius = opts.radius ?? 0.035;
    this.mat = material(color, opts.opacity ?? 1);
    this.shaft = new THREE.Mesh(shaftGeo, this.mat);
    this.head = new THREE.Mesh(headGeo, this.mat);
    this.add(this.shaft, this.head);
    if (opts.label) {
      this.label = makeLabel(opts.label, color);
      this.add(this.label);
    }
    this.set(from, to);
  }

  set(from: Vec3, to: Vec3): this {
    const a = toV3(from);
    const d = toV3(to).sub(a);
    const len = d.length();
    this.position.copy(a);
    const visible = len > 1e-6;
    this.shaft.visible = this.head.visible = visible;
    if (this.label) {
      // Beschriftung in Weltkoordinaten etwas hinter die Spitze setzen
      const dir = visible ? d.clone().normalize() : new THREE.Vector3(0, 0, 1);
      this.label.position.copy(dir.multiplyScalar(len + 0.28));
    }
    if (!visible) return this;
    const headLen = Math.min(this.radius * 7, len * 0.4);
    const headR = this.radius * 2.6;
    const q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
    const shaftLen = len - headLen;
    this.shaft.quaternion.copy(q);
    this.head.quaternion.copy(q);
    this.shaft.scale.set(this.radius, Math.max(shaftLen, 1e-4), this.radius);
    this.shaft.position.copy(d.clone().normalize().multiplyScalar(shaftLen / 2));
    this.head.scale.set(headR, headLen, headR);
    this.head.position.copy(d.clone().normalize().multiplyScalar(shaftLen + headLen / 2));
    return this;
  }

  setColor(color: THREE.ColorRepresentation) {
    this.mat.color.set(color);
    this.mat.emissive.set(color).multiplyScalar(0.28);
  }
}

/** Text-Beschriftung als Sprite (landet auch im Screenshot). */
export function makeLabel(
  text: string,
  color: THREE.ColorRepresentation = '#e5e7eb',
  size = 0.32,
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const font = '600 64px Inter, "Segoe UI", system-ui, sans-serif';
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 32;
  canvas.width = w;
  canvas.height = 88;
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(8,10,22,0.85)';
  ctx.strokeText(text, w / 2, 46);
  ctx.fillStyle = '#' + new THREE.Color(color).getHexString();
  ctx.fillText(text, w / 2, 46);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set((size * w) / 88, size, 1);
  sprite.renderOrder = 999;
  sprite.layers.set(LABEL_LAYER);
  return sprite;
}

/** Gerade durch `point` in Richtung `dir` (als dünner, langer Zylinder). */
export function makeLine(point: Vec3, dir: Vec3, color: THREE.ColorRepresentation, length = 14, radius = 0.02, opacity = 0.9) {
  const d = toV3(dir).normalize();
  const mesh = new THREE.Mesh(shaftGeo, material(color, opacity));
  mesh.quaternion.setFromUnitVectors(UP, d);
  mesh.scale.set(radius, length, radius);
  mesh.position.copy(toV3(point));
  return mesh;
}

/** Segment von a nach b (dünner Zylinder). */
export function makeSegment(a: Vec3, b: Vec3, color: THREE.ColorRepresentation, radius = 0.015, opacity = 1) {
  const A = toV3(a);
  const d = toV3(b).sub(A);
  const len = d.length();
  const mesh = new THREE.Mesh(shaftGeo, material(color, opacity));
  if (len < 1e-9) {
    mesh.visible = false;
    return mesh;
  }
  mesh.quaternion.setFromUnitVectors(UP, d.clone().normalize());
  mesh.scale.set(radius, len, radius);
  mesh.position.copy(A.add(d.multiplyScalar(0.5)));
  return mesh;
}

/** Gestrichelte Linie von a nach b. */
export function makeDashed(a: Vec3, b: Vec3, color: THREE.ColorRepresentation, dash = 0.12) {
  const geo = new THREE.BufferGeometry().setFromPoints([toV3(a), toV3(b)]);
  const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color, dashSize: dash, gapSize: dash * 0.7, transparent: true, opacity: 0.9 }));
  line.computeLineDistances();
  return line;
}

/** Polyline (z. B. Winkelbogen). */
export function makePolyline(points: Vec3[], color: THREE.ColorRepresentation, opacity = 1) {
  const geo = new THREE.BufferGeometry().setFromPoints(points.map(toV3));
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }));
}

/** Quadratische, halbtransparente Ebene mit Normale n durch `point`. */
export function makePlane(normal: Vec3, point: Vec3, color: THREE.ColorRepresentation, size = 10, opacity = 0.28) {
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(size, size, 1, 1);
  const c = new THREE.Color(color);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: c, emissive: c.clone().multiplyScalar(0.35), transparent: true, opacity,
      side: THREE.DoubleSide, depthWrite: false, roughness: 0.6,
    }),
  );
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: Math.min(1, opacity * 2.5) }),
  );
  // feines Raster auf der Ebene zur besseren Tiefenwahrnehmung
  const gridPts: THREE.Vector3[] = [];
  const h = size / 2;
  for (let i = -h; i <= h + 1e-9; i += 1) {
    gridPts.push(new THREE.Vector3(i, -h, 0), new THREE.Vector3(i, h, 0));
    gridPts.push(new THREE.Vector3(-h, i, 0), new THREE.Vector3(h, i, 0));
  }
  const grid = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(gridPts),
    new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: opacity * 0.7 }),
  );
  group.add(mesh, edges, grid);
  const n = toV3(normal).normalize();
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  group.position.copy(toV3(point));
  return group;
}

/** Kleine Kugel als Punkt. */
export function makePoint(p: Vec3, color: THREE.ColorRepresentation, radius = 0.08) {
  const m = new THREE.Mesh(sphereGeo, material(color));
  m.scale.setScalar(radius);
  m.position.copy(toV3(p));
  return m;
}

/** Halbtransparenter Würfel um den Ursprung (für "ganzer Raum"). */
export function makeSpaceBox(color: THREE.ColorRepresentation, size = 8, opacity = 0.07) {
  const g = new THREE.BoxGeometry(size, size, size);
  const grp = new THREE.Group();
  grp.add(
    new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide })),
    new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 })),
  );
  return grp;
}

/** Winkelbogen zwischen a und b mit Radius r (um den Ursprung). */
export function makeAngleArc(a: Vec3, b: Vec3, color: THREE.ColorRepresentation, r = 0.6) {
  const u = toV3(a).normalize();
  const v = toV3(b).normalize();
  const pts: Vec3[] = [];
  const ang = u.angleTo(v);
  if (ang < 1e-6) return new THREE.Group();
  const axis = new THREE.Vector3().crossVectors(u, v);
  if (axis.lengthSq() < 1e-12) {
    // 180°: beliebige senkrechte Achse
    axis.set(1, 0, 0).cross(u);
    if (axis.lengthSq() < 1e-12) axis.set(0, 1, 0).cross(u);
  }
  axis.normalize();
  for (let i = 0; i <= 32; i++) {
    const w = u.clone().applyAxisAngle(axis, (ang * i) / 32).multiplyScalar(r);
    pts.push([w.x, w.y, w.z]);
  }
  return makePolyline(pts, color);
}

/** Entsorgt alle Kinder einer Gruppe (Geometrien, Materialien, Texturen). */
export function clearGroup(group: THREE.Object3D) {
  for (const child of [...group.children]) {
    disposeObject(child);
    group.remove(child);
  }
}

export function disposeObject(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const any = o as THREE.Mesh;
    if (any.geometry && !any.geometry.userData.shared) any.geometry.dispose();
    const mats = any.material ? (Array.isArray(any.material) ? any.material : [any.material]) : [];
    for (const m of mats) {
      const mm = m as THREE.MeshBasicMaterial;
      mm.map?.dispose();
      mm.dispose();
    }
  });
}

/** Farbpalette für die Module */
export const COLORS = {
  x: '#f87171',
  y: '#4ade80',
  z: '#60a5fa',
  accent: '#a78bfa',
  cyan: '#22d3ee',
  amber: '#fbbf24',
  pink: '#f472b6',
  orange: '#fb923c',
  lime: '#a3e635',
  white: '#f8fafc',
  gray: '#94a3b8',
};
export const PALETTE = ['#f472b6', '#22d3ee', '#fbbf24', '#a78bfa', '#34d399', '#fb923c', '#f87171', '#60a5fa'];
