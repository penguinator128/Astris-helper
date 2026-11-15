import { describe, expect, it } from 'vitest';
import { clean } from './pack';

describe('PDF text cleaning', () => {
  it('keeps Latin text and common punctuation used in the app', () => {
    expect(clean('f/2.8 · 35 mm – 5600 K, 24°, “quote”, ×2')).toBe('f/2.8 · 35 mm – 5600 K, 24°, “quote”, ×2');
  });
  it('replaces symbols missing from the embedded fonts', () => {
    expect(clean('∞')).toBe('inf');
    expect(clean('a → b')).toBe('a -> b');
    expect(clean('emoji 🎬 gone')).toBe('emoji  gone');
  });
});
