import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { posKey, Repertoire, START_KEY, type Side } from './repertoire';

/** Plays SAN moves from the start into the repertoire, returning the add results. */
function addLine(rep: Repertoire, side: Side, sans: string[], startAt = 0) {
  const chess = new Chess();
  return sans.map((san, i) => {
    const m = chess.move(san);
    return rep.add(side, m.before, m.san, m.after, startAt + i);
  });
}

describe('posKey', () => {
  it('drops the move counters so transpositions match', () => {
    expect(posKey('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe(START_KEY);
  });
});

describe('Repertoire.add', () => {
  it('marks the owner’s moves as mine and the opponent’s as not', () => {
    const rep = new Repertoire();
    const [e4, c5] = addLine(rep, 'white', ['e4', 'c5']);
    expect(e4.status === 'added' && e4.move.mine).toBe(true);
    expect(c5.status === 'added' && c5.move.mine).toBe(false);
  });

  it('lets opponent moves branch', () => {
    const rep = new Repertoire();
    addLine(rep, 'white', ['e4', 'c5']);
    addLine(rep, 'white', ['e4', 'e5'], 10);
    const afterE4 = new Chess();
    afterE4.move('e4');
    expect(rep.movesFrom('white', afterE4.fen()).map((m) => m.san)).toEqual(['c5', 'e5']);
  });

  it('reports an existing move instead of duplicating it', () => {
    const rep = new Repertoire();
    addLine(rep, 'white', ['e4']);
    const [again] = addLine(rep, 'white', ['e4']);
    expect(again.status).toBe('exists');
    expect(rep.count('white')).toBe(1);
  });

  it('refuses a second reply for the owner in the same position', () => {
    const rep = new Repertoire();
    addLine(rep, 'white', ['e4']);
    const [d4] = addLine(rep, 'white', ['d4']);
    expect(d4.status).toBe('conflict');
    expect(d4.status === 'conflict' && d4.existing.san).toBe('e4');
  });

  it('keeps White and Black repertoires apart', () => {
    const rep = new Repertoire();
    addLine(rep, 'white', ['e4']);
    const [asBlack] = addLine(rep, 'black', ['d4']);
    expect(asBlack.status === 'added' && asBlack.move.mine).toBe(false);
    expect(rep.count('white')).toBe(1);
    expect(rep.count('black')).toBe(1);
  });
});

describe('Repertoire.delete', () => {
  it('removes the move and the lines that hang off it', () => {
    const rep = new Repertoire();
    addLine(rep, 'white', ['e4', 'c5', 'Nf3', 'd6']);
    addLine(rep, 'white', ['e4', 'e5', 'Nf3'], 10);
    const c5 = rep.all().find((m) => m.san === 'c5')!;
    const removed = rep.delete(c5.id);
    expect(removed).toHaveLength(3);
    expect(rep.all().map((m) => m.san).sort()).toEqual(['Nf3', 'e4', 'e5']);
  });

  it('keeps a position still reachable by transposition', () => {
    const rep = new Repertoire();
    addLine(rep, 'black', ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4']);
    addLine(rep, 'black', ['c4', 'e6', 'd4', 'Nf6'], 10); // reaches the same position as 1.d4 Nf6 2.c4 e6
    const c4First = rep.all().find((m) => m.san === 'c4' && m.from === START_KEY)!;
    expect(rep.delete(c4First.id)).toHaveLength(4);
    expect(rep.all().map((m) => m.san)).toEqual(['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4']);
  });
});

describe('Repertoire.replace', () => {
  it('swaps the owner’s reply and drops the old line', () => {
    const rep = new Repertoire();
    addLine(rep, 'white', ['e4', 'c5', 'Nf3']);
    const chess = new Chess();
    const d4 = chess.move('d4');
    const e4 = rep.myMoveAt('white', d4.before)!;
    const { removed, added } = rep.replace(e4.id, 'white', d4.before, d4.san, d4.after);
    expect(removed).toHaveLength(3);
    expect(added.san).toBe('d4');
    expect(rep.count('white')).toBe(1);
  });
});
