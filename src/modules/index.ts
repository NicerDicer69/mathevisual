/**
 * Registrierung aller Module (Reihenfolge = Tab-Reihenfolge).
 * Jedes Modul liegt in einem eigenen Ordner mit math.ts (Logik),
 * view.ts (Darstellung) und math.test.ts (Unit-Tests).
 */
import type { ModuleDef } from '../core/module';
import { vectorsModule } from './vectors/view';
import { matrixModule } from './matrix/view';
import { bodiesModule } from './bodies/view';
import { spanModule } from './span/view';
import { eigenModule } from './eigen/view';
import { lgsModule } from './lgs/view';
import { gaussModule } from './gauss/view';
import { kernelModule } from './kernel/view';
import { gramSchmidtModule } from './gramschmidt/view';

export const MODULES: ModuleDef[] = [
  vectorsModule,
  matrixModule,
  bodiesModule,
  spanModule,
  eigenModule,
  lgsModule,
  gaussModule,
  kernelModule,
  gramSchmidtModule,
];
