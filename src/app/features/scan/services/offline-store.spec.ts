import { describe, expect, it } from 'vitest';
import { MemoryStore } from './offline-store';

describe('MemoryStore', () => {
  it('queue mein id se aur cache mein key se rakhta hai', async () => {
    const s = new MemoryStore();
    await s.put('queue', { id: 'a', n: 1 });
    await s.put('cache', { key: 'k', value: 5 });
    expect(await s.get('queue', 'a')).toEqual({ id: 'a', n: 1 });
    expect(await s.get('cache', 'k')).toEqual({ key: 'k', value: 5 });
    expect(await s.get('queue', 'k')).toBeUndefined();
  });

  it('wahi key dobara put karne par badal jati hai', async () => {
    const s = new MemoryStore();
    await s.put('queue', { id: 'a', n: 1 });
    await s.put('queue', { id: 'a', n: 2 });
    expect(await s.getAll('queue')).toEqual([{ id: 'a', n: 2 }]);
  });

  it('delete se hat jata hai', async () => {
    const s = new MemoryStore();
    await s.put('queue', { id: 'a' });
    await s.delete('queue', 'a');
    expect(await s.getAll('queue')).toEqual([]);
  });
});