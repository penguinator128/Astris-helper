import { describe, expect, it } from 'vitest';
import { describeBody, describeLens, inputFromBody, startingInput, startingLens } from './custom';
import { lensFit, vignettes } from './mounts';
import { adapterFor } from './lenses';
import { bodyOf } from './bodies';
import { cameraConfig, derive, normalise, warnings } from './settings';
import { bodyTemplate, gearFromTemplate, lensTemplate } from '@/lib/gear/catalog';

describe('described cameras', () => {
  it('builds a full body from a form and keeps it inside the settings', () => {
    const b = describeBody({ ...startingInput('mirrorless'), manufacturer: 'Nikon', model: 'Z6 III', mount: 'Z', nativeIso: '100, 800' });
    expect(b.custom).toBe(true);
    expect(b.nativeIso).toEqual([100, 800]);
    const g = gearFromTemplate(bodyTemplate(b));
    const c = cameraConfig(g);
    expect(c.body?.model).toBe('Z6 III');
    expect(bodyOf(c).mount).toBe('Z');
    expect(g.ports.find((p) => p.connector === 'Lens mount')?.standard).toBe('Z');
  });
  it('uses a typed sensor size for field of view', () => {
    const b = describeBody({ ...startingInput('action'), model: 'Action cam', sensorId: 'custom', sensorW: 7.6, sensorH: 5.7 });
    const c = normalise({ ...gearFromTemplate(bodyTemplate(b)).camera!, focalLength: 3 });
    expect(derive(c).sensor.width).toBeCloseTo(7.6);
    expect(derive(c).hfov).toBeGreaterThan(100);
  });
  it('round-trips through the form for editing', () => {
    const b = describeBody({ ...startingInput('cinema'), manufacturer: 'RED', model: 'Komodo', mount: 'RF', ports: { sdi: 1, xlr: 2, base: 1 } });
    const again = describeBody(inputFromBody(b), b.id);
    expect(again.ports.filter((p) => p[2] === 'XLR')).toHaveLength(2);
    expect(again.mount).toBe('RF');
    expect(again.id).toBe(b.id);
  });
});

describe('mounts and lenses', () => {
  it('adapts by flange distance, and refuses when the lens must sit closer', () => {
    expect(lensFit('EF', 'RF').kind).toBe('adapter');
    expect(lensFit('F', 'Z').kind).toBe('adapter');
    expect(lensFit('PL', 'E').kind).toBe('adapter');
    expect(lensFit('E', 'EF').kind).toBe('no');
    expect(lensFit('RF', 'RF').kind).toBe('native');
    expect(adapterFor('Leica M', 'X')?.name).toBe('Leica M to X adapter');
    expect(adapterFor('EF', 'RF')?.name).toContain('Canon');
  });
  it('warns when an APS-C lens goes on full frame', () => {
    expect(vignettes('aps-c', 36)).toBe(true);
    expect(vignettes('full-frame', 23.5)).toBe(false);
    const body = describeBody({ ...startingInput('mirrorless'), model: 'FF', sensorId: 'full-frame' });
    const lens = describeLens({ ...startingLens('RF'), format: 'aps-c' });
    expect(warnings(gearFromTemplate(bodyTemplate(body)).camera!, lens).some((w) => /smaller sensor/.test(w.text))).toBe(true);
  });
  it('makes a lens item from any description', () => {
    const l = describeLens({ ...startingLens('L'), prime: false, focalMin: 24, focalMax: 70, maxAperture: 2.8, maxApertureTele: 2.8, model: '' });
    expect(l.model).toBe('24-70mm f/2.8');
    const g = gearFromTemplate(lensTemplate(l));
    expect(g.lens?.focalMax).toBe(70);
    expect(g.ports.find((p) => p.connector === 'Lens mount')?.standard).toBe('L');
  });
});
