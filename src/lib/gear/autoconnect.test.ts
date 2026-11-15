import { describe, expect, it } from 'vitest';
import { TEMPLATES, gearFromTemplate } from './catalog';
import { check, checkProduction, proposeConnections } from './autoconnect';
import type { GearItem } from '@/types/project';

const mk = (id: string, rigOf?: string): GearItem => ({ ...gearFromTemplate(TEMPLATES.find((t) => t.id === id)!), rigOf });
const port = (g: GearItem, name: string) => g.ports.find((p) => p.name === name)!;

describe('auto connect', () => {
  it('builds a sensible single-camera rig', () => {
    const cam = mk('body-sony-fx3');
    const lens = mk('lens-fe-24-70-gm2', cam.id);
    const wrongLens = mk('lens-rf-50-18', cam.id);
    const cage = mk('cage', cam.id);
    const handle = mk('top-handle', cam.id);
    const arm = mk('arm', cam.id);
    const monitor = mk('monitor-5', cam.id);
    const bat = mk('bat-npfz100', cam.id);
    const npf = mk('bat-npf970', cam.id);
    const vnd = mk('vnd-82', cam.id);
    const tripod = mk('tripod-fluid', cam.id);
    const rx = mk('wl-rx', cam.id);
    const tx = mk('wl-tx');
    const lav = mk('lav');
    const shotgun = mk('shotgun');
    const rec = mk('recorder-4');
    const gear = [cam, lens, wrongLens, cage, handle, arm, monitor, bat, npf, vnd, tripod, rx, tx, lav, shotgun, rec];
    const props = proposeConnections(gear, []);
    const has = (from: GearItem, to: GearItem) => props.some((p) => p.fromGear === from.id && p.toGear === to.id);
    expect(has(cam, lens)).toBe(true);
    expect(has(cam, wrongLens)).toBe(false); // RF lens never forced onto an E-mount body
    expect(has(cam, cage)).toBe(true);
    expect(has(cage, handle)).toBe(true);
    expect(has(handle, arm)).toBe(true);
    expect(has(arm, monitor)).toBe(true);
    expect(has(bat, cam)).toBe(true);
    expect(has(npf, monitor)).toBe(true);
    expect(has(lens, vnd)).toBe(true);
    expect(has(cage, tripod)).toBe(true); // tripod goes on the cage, the cage took the camera's socket
    expect(has(cam, monitor)).toBe(true); // HDMI
    expect(has(lav, tx)).toBe(true);
    expect(has(tx, rx)).toBe(true);
    expect(has(rx, cam)).toBe(true);
    expect(has(shotgun, rec)).toBe(true);
    expect(has(shotgun, cam)).toBe(false); // needs phantom; FX3 3.5 mm input cannot
    expect(props.find((p) => p.fromGear === cam.id && p.toGear === monitor.id)?.cable).toBe('HDMI cable');
  });
  it('keeps two cameras separate', () => {
    const a = mk('body-sony-fx3');
    const b = mk('body-sony-a7s3');
    const lensA = mk('lens-fe-50-18', a.id);
    const props = proposeConnections([a, b, lensA], []);
    expect(props.some((p) => p.fromGear === b.id && p.toGear === lensA.id)).toBe(false);
    expect(props.some((p) => p.fromGear === a.id && p.toGear === lensA.id)).toBe(true);
  });
  it('uses an adapter to fit an EF lens on RF', () => {
    const cam = mk('body-canon-r50v');
    const ad = mk('adapter-ef-rf', cam.id);
    const ef = mk('lens-sigma-18-35', cam.id);
    const props = proposeConnections([cam, ad, ef], []);
    expect(props.some((p) => p.fromGear === cam.id && p.toGear === ad.id)).toBe(true);
    expect(props.some((p) => p.fromGear === ad.id && p.toGear === ef.id)).toBe(true);
  });
  it('refuses wrong voltage, wrong mount and missing phantom, and reports problems', () => {
    const vmount = mk('bat-vmount');
    const r50 = mk('body-canon-r50v');
    expect(check(vmount, port(vmount, 'Battery'), r50, port(r50, 'Battery')).ok).toBe(false);
    const shotgun = mk('shotgun');
    expect(check(shotgun, port(shotgun, 'Output'), r50, port(r50, 'Mic in')).ok).toBe(false);
    const issues = checkProduction([r50, shotgun], [{ id: 'x', fromGear: shotgun.id, fromPort: port(shotgun, 'Output').id, toGear: r50.id, toPort: port(r50, 'Mic in').id, notes: '' }]);
    expect(issues.some((i) => i.level === 'error' && i.text.includes('phantom'))).toBe(true);
    expect(issues.some((i) => i.text.includes('no lens'))).toBe(true);
  });
  it('flags payload over the gimbal limit', () => {
    const cam = mk('body-generic-cinema');
    const g = mk('gimbal', cam.id);
    const issues = checkProduction([cam, g], [{ id: 'x', fromGear: cam.id, fromPort: port(cam, 'Tripod socket').id, toGear: g.id, toPort: g.ports[0].id, notes: '' }]);
    expect(issues.some((i) => i.text.includes('payload'))).toBe(true);
  });
});
