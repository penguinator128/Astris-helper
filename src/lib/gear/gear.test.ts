import { describe, expect, it } from 'vitest';
import { cableFor, gearFromTemplate, TEMPLATES, inView, layerOf, nextName } from './catalog';
import { equipmentList, cablesFor } from './equipment';
import { createEmptyProject } from '@/store/projects';
import type { DiagramObject, LightingDiagram } from '@/types/project';

const tpl = (id: string) => TEMPLATES.find((t) => t.id === id)!;

describe('gear catalogue', () => {
  it('names cables from connector pairs', () => {
    expect(cableFor('XLR', 'XLR')).toBe('XLR cable');
    expect(cableFor('Micro HDMI', 'HDMI')).toBe('HDMI to Micro HDMI cable');
    expect(cableFor('HDMI', 'Micro HDMI')).toBe('HDMI to Micro HDMI cable');
    expect(cableFor('Wireless', '3.5 mm TRS')).toBeNull();
  });
  it('creates gear with fresh port ids and sensible names', () => {
    const a = gearFromTemplate(tpl('recorder-4'));
    const b = gearFromTemplate(tpl('recorder-4'));
    expect(a.ports.filter((p) => p.dir === 'in')).toHaveLength(4);
    expect(a.ports[0].id).not.toBe(b.ports[0].id);
    expect(nextName([], 'camera', 'Canon EOS R50 V')).toBe('A cam · Canon EOS R50 V');
    expect(nextName([a], 'recorder', 'Field recorder (4 input)')).toBe('Field recorder (4 input) 2');
    expect(nextName([a], 'recorder', 'Compact recorder (2 input)')).toBe('Compact recorder (2 input)');
  });
  it('sorts plan objects into layers', () => {
    const mic = { id: 'm', type: 'gear', category: 'mic', x: 0, y: 0, rotation: 0, locked: false, label: 'Boom' } as DiagramObject;
    const talent = { id: 't', type: 'subject', subjectKind: 'person', height: 1.7, x: 0, y: 0, rotation: 0, locked: false, label: 'Mara' } as DiagramObject;
    expect(layerOf(mic)).toBe('audio');
    expect(inView(mic, 'lighting')).toBe(false);
    expect(inView(talent, 'lighting')).toBe(true);
  });
});

describe('equipment list', () => {
  it('adds cables, batteries, cards, stands and headphones', () => {
    const p = createEmptyProject('Test');
    const cam = gearFromTemplate(tpl('canon-r50v'));
    const rec = gearFromTemplate(tpl('recorder-4'));
    const shotgun = gearFromTemplate(tpl('shotgun'));
    const monitor = gearFromTemplate(tpl('monitor'));
    p.gear = [cam, rec, shotgun, monitor];
    p.connections = [
      { id: 'c1', fromGear: shotgun.id, fromPort: shotgun.ports[0].id, toGear: rec.id, toPort: rec.ports[0].id, notes: '' },
      { id: 'c2', fromGear: cam.id, fromPort: cam.ports.find((x) => x.connector === 'Micro HDMI')!.id, toGear: monitor.id, toPort: monitor.ports[0].id, notes: '' },
    ];
    const light = (kind: string, id: string): DiagramObject => ({ id, type: 'light', kind, x: 0, y: 0, rotation: 0, locked: false, label: kind, power: 100, kelvin: 5600, size: 1, height: 2, tilt: 0, gel: '', spread: 60 }) as DiagramObject;
    const d1: LightingDiagram = { id: 'd1', name: 'Scene 1', gridSize: 1, showSunPath: false, notes: '', updatedAt: 0, objects: [light('key', 'a'), light('fill', 'b'), light('flag', 'c'), { id: 'cam', type: 'camera', gearId: cam.id, x: 0, y: -3, rotation: 0, locked: false, label: 'A cam' }] };
    const d2: LightingDiagram = { ...d1, id: 'd2', name: 'Scene 2', objects: [light('key', 'd')] };
    p.diagrams = [d1, d2];
    const list = equipmentList(p);
    const find = (name: string) => list.find((r) => r.name === name);
    expect(find('XLR cable')?.qty).toBe(1);
    expect(find('HDMI to Micro HDMI cable')?.qty).toBe(1);
    expect(find('Light stand')?.qty).toBe(2); // peak in scene 1, not 3
    expect(find('C-stand')?.qty).toBe(1);
    expect(find('Sandbag')?.qty).toBe(3);
    expect(find('Key light')?.qty).toBe(1);
    expect(find('LP-E17 battery')?.qty).toBe(2);
    expect(find('AA battery')?.qty).toBe(2);
    expect(find('Memory card')?.qty).toBe(4);
    expect(find('Headphones')?.qty).toBe(1);
    expect(list.find((r) => r.name.startsWith('A cam') || r.name.startsWith('Canon'))?.why).toContain('Scene 1');
    expect(cablesFor(p.gear, p.connections).size).toBe(2);
  });
});
