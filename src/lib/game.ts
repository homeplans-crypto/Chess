import { Chess, SQUARES, type Square } from 'chess.js';
import type { Key } from 'chessground/types';

/** Legal destinations for every piece of the side to move, in chessground's format. */
export function legalDests(chess: Chess): Map<Key, Key[]> {
  const dests = new Map<Key, Key[]>();
  for (const sq of SQUARES) {
    const moves = chess.moves({ square: sq as Square, verbose: true });
    if (moves.length) dests.set(sq as Key, moves.map((m) => m.to as Key));
  }
  return dests;
}

export function turnColor(chess: Chess): 'white' | 'black' {
  return chess.turn() === 'w' ? 'white' : 'black';
}

/** Plays a board move; pawns reaching the last rank become queens for now. Returns the SAN, or null if illegal. */
export function playMove(chess: Chess, from: string, to: string): string | null {
  try {
    return chess.move({ from, to, promotion: 'q' }).san;
  } catch {
    return null;
  }
}

/** Pairs SAN moves into numbered rows: [[1, 'e4', 'e5'], [2, 'Nf3', undefined]]. */
export function moveRows(history: string[]): [number, string, string | undefined][] {
  const rows: [number, string, string | undefined][] = [];
  for (let i = 0; i < history.length; i += 2) rows.push([i / 2 + 1, history[i], history[i + 1]]);
  return rows;
}
