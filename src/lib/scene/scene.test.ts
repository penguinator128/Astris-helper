import { describe, expect, it } from 'vitest';
import { bodyExtent, seatPeople } from './pose';
import { framing } from './framing';
import type { DiagramObject, DiagramSubject, DiagramZone } from '@/types/project';

const person = (p: Partial<DiagramSubject> = {}): DiagramSubject => ({ id: 's', type: 'subject', subjectKind: 'person', height: 1.7, x: 0, y: 0, rotation: 180, locked: false, label: 'S', ...p });

describe('poses', () => {
  it('seated eyes sit lower than standing eyes', () => {
    const stand = bodyExtent(person());
    const sit = bodyExtent(person({ pose: 'chair', seatHeight: 0.46 }));
    expect(stand.eye).toBeCloseTo(1.58, 2);
    expect(sit.eye).toBeGreaterThan(1.0);
    expect(sit.eye).toBeLessThan(1.3);
    expect(bodyExtent(person({ pose: 'lying', seatHeight: 0 })).top).toBeLessThan(0.3);
  });
  it('seats four people evenly along a couch, facing its front', () => {
    const couch: DiagramZone = { id: 'c', type: 'zone', zoneKind: 'couch', x: 0, y: 0, rotation: 180, w: 2.4, h: 0.9, locked: false, label: 'Couch' };
    let n = 0;
    const ppl = seatPeople(couch, 4, () => `p${n++}`, 0.55);
    expect(ppl).toHaveLength(4);
    expect(ppl.every((p) => p.pose === 'couch' && p.rotation === 180)).toBe(true);
    const xs = ppl.map((p) => p.x).sort((a, b) => a - b);
    expect(xs[1] - xs[0]).toBeCloseTo(0.55, 2);
    expect(xs[0] + xs[3]).toBeCloseTo(0, 5);
  });
});

describe('framing', () => {
  const cam = { x: 0, y: -3, rotation: 0 };
  it('a 38° lens sees a standing person head to toe at 5 m but cuts them at 3 m; a long lens crops', () => {
    const objs: DiagramObject[] = [person()];
    expect(framing(objs, { x: 0, y: -5, rotation: 0 }, { height: 1.5, tilt: 0, hfov: 63, vfov: 38 })[0].shot).toBe('WS');
    expect(framing(objs, cam, { height: 1.5, tilt: 0, hfov: 63, vfov: 38 })[0].shot).toBe('MWS');
    const tight = framing(objs, cam, { height: 1.6, tilt: 0, hfov: 10, vfov: 5.7 })[0].shot;
    expect(['CU', 'MCU', 'ECU']).toContain(tight);
  });
  it('people outside the angle of view are out of frame', () => {
    const objs: DiagramObject[] = [person({ id: 'a' }), person({ id: 'b', x: 4 })];
    const f = framing(objs, cam, { height: 1.5, tilt: 0, hfov: 40, vfov: 23 });
    expect(f.find((x) => x.id === 'a')!.inFrame).toBe(true);
    expect(f.find((x) => x.id === 'b')!.inFrame).toBe(false);
  });
});
