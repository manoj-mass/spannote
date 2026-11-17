import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomId } from '../src/factory';

const UUID_V4 = /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('randomId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a v4 UUID when crypto.randomUUID is available', () => {
    expect(randomId()).toMatch(UUID_V4);
  });

  it('builds a v4 UUID from getRandomValues when randomUUID is missing', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
        if (array instanceof Uint8Array) array.fill(0xff);
        return array;
      },
    });
    expect(randomId()).toBe('urn:uuid:ffffffff-ffff-4fff-bfff-ffffffffffff');
  });

  it('throws when no secure random generator is available', () => {
    vi.stubGlobal('crypto', {});
    expect(() => randomId()).toThrow('Secure random generator is unavailable');
  });
});
