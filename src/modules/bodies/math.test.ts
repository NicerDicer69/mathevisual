import { describe, it, expect } from 'vitest';
import { parsePointCloud, bodyVolume, samplePointCloud } from './math';

describe('Modul Körper', () => {
  it('parst verschiedene Formate', () => {
    const r = parsePointCloud('1, 2, 3\n(0; 1/2; -1)\n4 5 6\n\n# Kommentar\n1 2');
    expect(r.points).toEqual([[1, 2, 3], [0, 0.5, -1], [4, 5, 6]]);
    expect(r.errors).toEqual([6]);
  });
  it('Volumina', () => {
    expect(bodyVolume('cube')).toBe(1);
    expect(bodyVolume('tetra')).toBeCloseTo(1 / 6);
    expect(bodyVolume('points')).toBeNull();
  });
  it('Beispielwolke ist gültig', () => {
    const r = parsePointCloud(samplePointCloud(10));
    expect(r.points.length).toBe(10);
    expect(r.errors.length).toBe(0);
  });
});
