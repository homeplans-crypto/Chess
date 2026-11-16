import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { openStore } from './store';
import { Repertoire } from './repertoire';

describe('store', () => {
  it('round-trips moves and deletes them', async () => {
    const store = await openStore('test-roundtrip');
    const rep = new Repertoire();
    const chess = new Chess();
    for (const san of ['e4', 'c5', 'Nf3']) {
      const m = chess.move(san);
      const r = rep.add('white', m.before, m.san, m.after);
      if (r.status === 'added') await store.putMoves([r.move]);
    }
    const loaded = new Repertoire(await store.loadMoves());
    expect(loaded.count('white')).toBe(3);

    const c5 = loaded.all().find((m) => m.san === 'c5')!;
    await store.deleteMoves(loaded.delete(c5.id));
    expect((await store.loadMoves()).map((m) => m.san)).toEqual(['e4']);
  });
});
