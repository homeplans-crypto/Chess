import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { openStore } from './store';
import { Repertoire } from './repertoire';
import { schedule } from './drill';

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

  it('saves review cards with a log entry, and drops a card with its move', async () => {
    const store = await openStore('test-cards');
    const rep = new Repertoire();
    const m = new Chess().move('e4');
    const r = rep.add('white', m.before, m.san, m.after);
    if (r.status !== 'added') throw new Error('not added');
    await store.putMoves([r.move]);
    const now = new Date('2026-03-10T12:00:00');
    await store.putCard(schedule(undefined, r.move, 'good', now), { cardId: r.move.id, grade: 'good', reviewedAt: now, wasNew: true });
    const [card] = await store.loadCards();
    expect(card.card.due instanceof Date).toBe(true);
    expect(await store.loadLog()).toHaveLength(1);
    await store.deleteMoves([r.move.id]);
    expect(await store.loadCards()).toEqual([]);
  });
});
