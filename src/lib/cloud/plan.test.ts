import { describe, expect, it } from 'vitest';
import { planSync, mergeLibrary, isBlank, type CloudRow } from './plan';
import { createEmptyProject } from '@/store/projects';
import type { Project } from '@/types/project';

const proj = (id: string, name: string, updatedAt: number): Project => ({ ...createEmptyProject(name), id, updatedAt, shots: [{} as never] });
const row = (p: Project, deleted = false): CloudRow => ({ kind: 'project', id: p.id, data: p, deleted, updated_at: p.updatedAt });
let n = 0;
const mk = () => `new${n++}`;

describe('sync plan', () => {
  it('first sign-in on a new device: downloads plans and skips the blank starter', () => {
    const starter = createEmptyProject('Untitled project');
    expect(isBlank(starter)).toBe(true);
    const a = proj('a', 'Shoot', 100);
    const p = planSync([starter], [row(a)], { projects: {} }, [], mk);
    expect(p.apply.map((x) => x.id)).toEqual(['a']);
    expect(p.push).toHaveLength(0);
    expect(p.base.projects.a).toBe(100);
  });
  it('uploads plans only on this device', () => {
    const a = proj('a', 'Shoot', 100);
    const p = planSync([a], [], { projects: {} }, [], mk);
    expect(p.push.map((x) => x.id)).toEqual(['a']);
  });
  it('the side that changed wins', () => {
    const here = proj('a', 'Shoot', 200);
    const there = proj('a', 'Shoot', 100);
    expect(planSync([here], [row(there)], { projects: { a: 100 } }, [], mk).push.map((x) => x.id)).toEqual(['a']);
    const there2 = proj('a', 'Shoot v2', 300);
    const p = planSync([proj('a', 'Shoot', 100)], [row(there2)], { projects: { a: 100 } }, [], mk);
    expect(p.apply[0].name).toBe('Shoot v2');
    expect(p.push).toHaveLength(0);
  });
  it('both changed: keeps this device and adds the other as a copy', () => {
    const here = proj('a', 'Shoot here', 300);
    const there = proj('a', 'Shoot there', 250);
    const p = planSync([here], [row(there)], { projects: { a: 100 } }, [], mk);
    expect(p.apply).toHaveLength(0);
    expect(p.copies[0].name).toBe('Shoot there (from another device)');
    expect(p.copies[0].id).not.toBe('a');
    expect(p.push[0].name).toBe('Shoot here');
  });
  it('deletes travel both ways, but never take an edited plan', () => {
    const a = proj('a', 'Shoot', 100);
    expect(planSync([a], [row(a, true)], { projects: { a: 100 } }, [], mk).removeLocal).toEqual(['a']);
    const edited = proj('a', 'Shoot', 200);
    const keep = planSync([edited], [row(a, true)], { projects: { a: 100 } }, [], mk);
    expect(keep.removeLocal).toHaveLength(0);
    expect(keep.push).toHaveLength(1);
    expect(planSync([], [row(a)], { projects: { a: 100 } }, [{ id: 'a', at: 150 }], mk).pushDeletes).toEqual([{ id: 'a', at: 150 }]);
  });
});

describe('library merge', () => {
  it('keeps the newer version of each item and remembers deletions', () => {
    const a = { rigs: [{ id: 'r', name: 'Old', updatedAt: 1, camera: {} as never, parts: [], connections: [] }], cameras: [], lenses: [] };
    const b = { rigs: [{ id: 'r', name: 'New', updatedAt: 2, camera: {} as never, parts: [], connections: [], deleted: true }], cameras: [], lenses: [] };
    const m = mergeLibrary(a, b);
    expect(m.rigs).toHaveLength(1);
    expect(m.rigs[0].name).toBe('New');
    expect(m.rigs[0].deleted).toBe(true);
  });
});
