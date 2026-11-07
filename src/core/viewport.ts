/**
 * 3D-Viewport: Renderer, Kamera, OrbitControls, Achsen mit Pfeilspitzen,
 * Gitter in der xy-Ebene und Beschriftungen. z zeigt nach oben.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Arrow, COLORS, LABEL_LAYER, makeLabel } from './objects';

const AXIS_LEN = 6;
const HOME_POS = new THREE.Vector3(9.5, 7, 6.2);

export class Viewport {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  /** Gruppe, in die die Module ihre Objekte hängen */
  readonly root = new THREE.Group();
  readonly grid: THREE.Group;
  private frameCallbacks = new Set<(dt: number) => void>();
  private clock = new THREE.Clock();
  private camAnim: { from: THREE.Vector3; to: THREE.Vector3; t0: number; tf: THREE.Vector3 } | null = null;

  constructor(readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x070a17, 1);
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 500);
    this.camera.up.set(0, 0, 1);
    this.camera.position.copy(HOME_POS);
    this.camera.layers.enable(LABEL_LAYER);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 60;
    this.controls.target.set(0, 0, 0);

    this.scene.fog = new THREE.Fog(0x070a17, 25, 70);
    this.scene.add(new THREE.HemisphereLight(0xdbeafe, 0x1e1b4b, 1.1));
    const dir = new THREE.DirectionalLight(0xffffff, 1.6);
    dir.position.set(6, 4, 10);
    this.scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0x8b5cf6, 0.5);
    dir2.position.set(-6, -8, -3);
    this.scene.add(dir2);

    this.grid = this.buildGrid();
    this.scene.add(this.grid, this.buildAxes(), this.root);

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** Gitter in der xy-Ebene mit Haupt- und Nebenlinien */
  private buildGrid(): THREE.Group {
    const g = new THREE.Group();
    const minor: THREE.Vector3[] = [];
    const major: THREE.Vector3[] = [];
    const N = 10;
    for (let i = -N; i <= N; i++) {
      const target = i % 5 === 0 ? major : minor;
      if (i === 0) continue;
      target.push(new THREE.Vector3(i, -N, 0), new THREE.Vector3(i, N, 0));
      target.push(new THREE.Vector3(-N, i, 0), new THREE.Vector3(N, i, 0));
    }
    const mk = (pts: THREE.Vector3[], opacity: number) =>
      new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity, depthWrite: false }),
      );
    g.add(mk(minor, 0.16), mk(major, 0.32));
    return g;
  }

  /** Achsen (x rot, y grün, z blau) mit Pfeilspitzen, Strichen und Beschriftungen */
  private buildAxes(): THREE.Group {
    const g = new THREE.Group();
    const axes: [string, string, [number, number, number]][] = [
      ['x', COLORS.x, [1, 0, 0]],
      ['y', COLORS.y, [0, 1, 0]],
      ['z', COLORS.z, [0, 0, 1]],
    ];
    for (const [name, color, d] of axes) {
      const neg: [number, number, number] = [-d[0] * AXIS_LEN, -d[1] * AXIS_LEN, -d[2] * AXIS_LEN];
      const pos: [number, number, number] = [d[0] * AXIS_LEN, d[1] * AXIS_LEN, d[2] * AXIS_LEN];
      // negativer Teil dünn und blasser
      const negLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...neg), new THREE.Vector3()]),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 }),
      );
      g.add(negLine);
      g.add(new Arrow([0, 0, 0], pos, color, { radius: 0.018 }));
      const lbl = makeLabel(name, color, 0.45);
      lbl.position.set(d[0] * (AXIS_LEN + 0.45), d[1] * (AXIS_LEN + 0.45), d[2] * (AXIS_LEN + 0.45));
      g.add(lbl);
      // Teilstriche mit Zahlen
      for (let i = -5; i <= 5; i++) {
        if (i === 0) continue;
        const p = new THREE.Vector3(d[0] * i, d[1] * i, d[2] * i);
        const t = makeLabel(String(i), '#94a3b8', 0.18);
        const off = name === 'z' ? new THREE.Vector3(0.22, -0.22, 0) : new THREE.Vector3(0, 0, -0.22);
        t.position.copy(p).add(off);
        g.add(t);
      }
    }
    const origin = makeLabel('0', '#94a3b8', 0.18);
    origin.position.set(-0.18, -0.18, -0.18);
    g.add(origin);
    return g;
  }

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  onFrame(cb: (dt: number) => void): () => void {
    this.frameCallbacks.add(cb);
    return () => this.frameCallbacks.delete(cb);
  }

  private frame() {
    const dt = this.clock.getDelta();
    if (this.camAnim) {
      const k = Math.min(1, (performance.now() - this.camAnim.t0) / 700);
      const e = 1 - Math.pow(1 - k, 3);
      this.camera.position.lerpVectors(this.camAnim.from, this.camAnim.to, e);
      this.controls.target.lerp(this.camAnim.tf, e);
      if (k >= 1) this.camAnim = null;
    }
    this.controls.update();
    for (const cb of this.frameCallbacks) cb(dt);
    this.renderer.render(this.scene, this.camera);
  }

  /** Kamera weich in die Ausgangsposition zurückfahren */
  resetCamera() {
    this.camAnim = { from: this.camera.position.clone(), to: HOME_POS.clone(), t0: performance.now(), tf: new THREE.Vector3() };
  }

  setLabelsVisible(v: boolean) {
    if (v) this.camera.layers.enable(LABEL_LAYER);
    else this.camera.layers.disable(LABEL_LAYER);
  }

  setGridVisible(v: boolean) {
    this.grid.visible = v;
  }

  /** PNG-Screenshot des aktuellen Bildes herunterladen */
  screenshot() {
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `mathevisual-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    a.click();
  }
}
