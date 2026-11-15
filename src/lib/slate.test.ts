import { describe, expect, it } from 'vitest';
import { nextShotId } from './slate';

describe('nextShotId', () => {
  it('advances letters, numbers and mixed designations', () => {
    expect(nextShotId('A')).toBe('B');
    expect(nextShotId('y')).toBe('Z');
    expect(nextShotId('Z')).toBe('ZA');
    expect(nextShotId('3')).toBe('4');
    expect(nextShotId('2B')).toBe('2C');
    expect(nextShotId('')).toBe('A');
    expect(nextShotId('12')).toBe('13');
  });
});
