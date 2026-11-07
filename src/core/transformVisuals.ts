/**
 * 3D-Objekte, die von einer linearen Abbildung verformt werden:
 * räumliches Gitter (Lattice) und Einheitswürfel.
 */
import * as THREE from 'three';
import { matVec, det3, type Matrix, type Vec3 } from '../math/linalg';
import { toMatrix4 } from './objects';

/** Räumliches Gitter aus Geraden in x-, y- und z-Richtung, das mitverformt wird. */
export class Lattice {
  readonly object: THREE.LineSegments;
  private base: Vec3[] = [];

  constructor(n = 2, extent = 3) {
    const cols: number[] = [];
    const tint = [new THREE.Color('#f87171'), new THREE.Color('#4ade80'), new THREE.Color('#60a5fa')];
    const steps: number[] = [];
    for (let i = -n; i <= n; i++) steps.push((i * extent) / n);
    for (let axis = 0; axis < 3; axis++) {
      const o1 = (axis + 1) % 3, o2 = (axis + 2) % 3;
      for (const s1 of steps)
        for (const s2 of steps) {
          const a: Vec3 = [0, 0, 0], b: Vec3 = [0, 0, 0];
          a[axis] = -extent; b[axis] = extent;
          a[o1] = b[o1] = s1;
          a[o2] = b[o2] = s2;
          this.base.push(a, b);
          const c = tint[axis];
          cols.push(c.r, c.g, c.b, c.r, c.g, c.b);
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(this.base.length * 3), 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    this.object = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.22, depthWrite: false }),
    );
    this.object.frustumCulled = false;
    this.update([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
  }

  update(M: Matrix) {
    const pos = this.object.geometry.getAttribute('position') as THREE.BufferAttribute;
    this.base.forEach((p, i) => {
      const q = matVec(M, p);
      pos.setXYZ(i, q[0], q[1], q[2]);
    });
    pos.needsUpdate = true;
  }
}

/** Einheitswürfel [0,1]³ – Volumen nach der Abbildung = |det M|. */
export class UnitCube {
  readonly group = new THREE.Group();
  private mesh: THREE.Mesh;
  private edges: THREE.LineSegments;
  private mat: THREE.MeshStandardMaterial;

  constructor(private posColor = '#a78bfa', private negColor = '#fb7185') {
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0.5, 0.5);
    this.mat = new THREE.MeshStandardMaterial({
      color: posColor, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, roughness: 0.5,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: posColor }));
    for (const o of [this.mesh, this.edges]) o.matrixAutoUpdate = false;
    this.group.add(this.mesh, this.edges);
  }

  update(M: Matrix) {
    const m4 = toMatrix4(M);
    this.mesh.matrix.copy(m4);
    this.edges.matrix.copy(m4);
    const neg = det3(M) < -1e-9;
    const c = neg ? this.negColor : this.posColor;
    this.mat.color.set(c);
    this.mat.emissive.set(c).multiplyScalar(0.25);
    (this.edges.material as THREE.LineBasicMaterial).color.set(c);
  }
}

/** Geisterbild des Original-Einheitswürfels (Drahtgitter). */
export function ghostCube(color = '#94a3b8'): THREE.LineSegments {
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0.5, 0.5);
  return new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineDashedMaterial({ color, dashSize: 0.08, gapSize: 0.06, transparent: true, opacity: 0.6 }),
  ).computeLineDistances();
}
