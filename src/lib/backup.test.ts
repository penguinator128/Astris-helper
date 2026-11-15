import { describe, expect, it } from 'vitest';
import { imageIdsOf, normaliseProject } from './backup';

describe('backup helpers', () => {
  it('fills missing fields on an old or partial project', () => {
    const p = normaliseProject({ name: 'Old film', shots: undefined } as never);
    expect(p.name).toBe('Old film');
    expect(Array.isArray(p.shots)).toBe(true);
    expect(Array.isArray(p.awards)).toBe(true);
    expect(p.callSheet.callTime).toMatch(/^\d{2}:\d{2}$/);
    expect(p.slate.take).toBe(1);
    expect(typeof p.id).toBe('string');
  });
  it('collects image ids from compositions and storyboard frames', () => {
    const p = normaliseProject({ name: 'x' });
    p.compositions = [{ backgroundImageId: 'a' } as never, {} as never];
    p.storyboard = [{ imageId: 'b' } as never, { imageId: 'a' } as never];
    expect(imageIdsOf(p).sort()).toEqual(['a', 'b']);
  });
});
