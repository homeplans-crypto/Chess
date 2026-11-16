import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { legalDests, playMove, turnColor } from './game';

describe('legalDests', () => {
  it('gives the 20 opening moves spread over 10 pieces', () => {
    const dests = legalDests(new Chess());
    expect(dests.size).toBe(10);
    expect([...dests.values()].flat()).toHaveLength(20);
    expect(dests.get('g1')).toEqual(expect.arrayContaining(['f3', 'h3']));
  });
});

describe('playMove', () => {
  it('returns SAN for a legal move and switches the turn', () => {
    const chess = new Chess();
    expect(playMove(chess, 'e2', 'e4')).toBe('e4');
    expect(turnColor(chess)).toBe('black');
  });

  it('returns null for an illegal move and leaves the position alone', () => {
    const chess = new Chess();
    expect(playMove(chess, 'e2', 'e5')).toBeNull();
    expect(chess.history()).toEqual([]);
  });

  it('promotes to a queen', () => {
    const chess = new Chess('8/P7/8/8/8/8/8/k6K w - - 0 1');
    expect(playMove(chess, 'a7', 'a8')).toBe('a8=Q+');
  });
});
